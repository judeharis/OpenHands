import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { SandboxService } from "#/api/sandbox-service/sandbox-service.api";
import { openHands } from "#/api/open-hands-axios";
import V1ConversationService from "#/api/conversation-service/v1-conversation-service.api";
import { V1AppConversation } from "#/api/conversation-service/v1-conversation-service.types";
import { useDeleteConversationSandbox } from "#/hooks/mutation/use-delete-conversation-sandbox";

describe("useDeleteConversationSandbox", () => {
  let queryClient: QueryClient;

  const conversation: V1AppConversation = {
    id: "test-conv-id",
    created_by_user_id: null,
    sandbox_id: "oh-agent-server-abc",
    conversation_url: "http://localhost:3000",
    session_api_key: "test-key",
    selected_repository: null,
    selected_branch: null,
    git_provider: null,
    title: "Test",
    public: false,
    sandbox_status: "RUNNING",
    execution_status: null,
    trigger: null,
    pr_number: [],
    llm_model: null,
    metrics: null,
    sub_conversation_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("deletes the conversation's sandbox and marks the conversation archived", async () => {
    queryClient.setQueryData(
      ["user", "conversation", conversation.id],
      conversation,
    );
    vi.spyOn(
      V1ConversationService,
      "batchGetAppConversations",
    ).mockResolvedValue([conversation]);
    const deleteSandbox = vi
      .spyOn(SandboxService, "deleteSandbox")
      .mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteConversationSandbox(), {
      wrapper,
    });
    result.current.mutate({ conversationId: conversation.id });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteSandbox).toHaveBeenCalledWith("oh-agent-server-abc");
    expect(
      queryClient.getQueryData<V1AppConversation>([
        "user",
        "conversation",
        conversation.id,
      ])?.sandbox_status,
    ).toBe("MISSING");
  });

  it("sends the sandbox id in the query string, where the app reads it", async () => {
    const del = vi
      .spyOn(openHands, "delete")
      .mockResolvedValue({ data: { success: true } });

    await SandboxService.deleteSandbox("oh-agent-server-abc");

    expect(del).toHaveBeenCalledWith("/api/v1/sandboxes/oh-agent-server-abc", {
      params: { sandbox_id: "oh-agent-server-abc" },
    });
  });
});
