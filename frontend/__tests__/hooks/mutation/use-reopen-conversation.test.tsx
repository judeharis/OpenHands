import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useReopenConversation } from "#/hooks/mutation/use-reopen-conversation";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";

vi.mock("#/api/conversation-service/v1-conversation-service.api");

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const task = (status: string, extra: Record<string, unknown> = {}) =>
  ({ id: "task-1", status, app_conversation_id: "conv-1", ...extra }) as never;

describe("useReopenConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V1ConversationService.reopenConversation).mockResolvedValue(
      task("WORKING"),
    );
    vi.mocked(V1ConversationService.updateConversationTitle).mockResolvedValue(
      {} as never,
    );
  });

  it("starts a sandbox for the same conversation id, waits for READY, and restores the title", async () => {
    vi.mocked(V1ConversationService.batchGetAppConversations).mockResolvedValue(
      [{ id: "conv-1", title: "🚀 Execute Plan" } as never],
    );
    vi.mocked(V1ConversationService.getStartTask)
      .mockResolvedValueOnce(task("WAITING_FOR_SANDBOX"))
      .mockResolvedValueOnce(task("READY"));

    const { result } = renderHook(() => useReopenConversation(), { wrapper });
    result.current.mutate({ conversationId: "conv-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), {
      timeout: 5000,
    });
    expect(V1ConversationService.reopenConversation).toHaveBeenCalledWith(
      "conv-1",
    );
    expect(V1ConversationService.updateConversationTitle).toHaveBeenCalledWith(
      "conv-1",
      "🚀 Execute Plan",
    );
  });

  it("leaves a placeholder title alone", async () => {
    vi.mocked(V1ConversationService.batchGetAppConversations).mockResolvedValue(
      [{ id: "conv-1", title: "Conversation 0e896" } as never],
    );
    vi.mocked(V1ConversationService.getStartTask).mockResolvedValue(
      task("READY"),
    );

    const { result } = renderHook(() => useReopenConversation(), { wrapper });
    result.current.mutate({ conversationId: "conv-1" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      V1ConversationService.updateConversationTitle,
    ).not.toHaveBeenCalled();
  });

  it("fails with the task's detail when the sandbox does not start", async () => {
    vi.mocked(V1ConversationService.batchGetAppConversations).mockResolvedValue(
      [{ id: "conv-1", title: "x" } as never],
    );
    vi.mocked(V1ConversationService.getStartTask).mockResolvedValue(
      task("ERROR", { detail: "Sandbox status: ERROR" }),
    );

    const { result } = renderHook(() => useReopenConversation(), { wrapper });
    result.current.mutate({ conversationId: "conv-1" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Sandbox status: ERROR");
    expect(
      V1ConversationService.updateConversationTitle,
    ).not.toHaveBeenCalled();
  });
});
