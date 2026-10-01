import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EventService from "#/api/event-service/event-service.api";
import { useSetAutoMode } from "#/hooks/mutation/use-set-auto-mode";
import { usePolicyStore } from "#/stores/policy-store";

vi.mock("#/api/event-service/event-service.api");

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);
const target = {
  id: "conv-1",
  conversation_url: "http://localhost:40000/sb/1/api/conversations/conv-1",
  session_api_key: "k",
};

describe("useSetAutoMode", () => {
  let held: Record<string, unknown>;
  beforeEach(() => {
    vi.clearAllMocks();
    usePolicyStore.setState({ byConversation: {} });
    held = { kind: "LlmkitAnalyzer", grants: ["cmd:make"] };
    vi.mocked(EventService.getConversationInfo).mockImplementation(
      async () => ({ security_analyzer: { ...held } }) as never,
    );
  });

  it("switches auto on and keeps the grants", async () => {
    vi.mocked(EventService.setSecurityAnalyzer).mockImplementation(
      async (_id, _url, a) => {
        held = a as Record<string, unknown>;
      },
    );
    const { result } = renderHook(() => useSetAutoMode(), { wrapper });
    result.current.mutate({ targets: [target], auto: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(held).toEqual({
      kind: "LlmkitAnalyzer",
      grants: ["cmd:make"],
      auto: true,
    });
    expect(usePolicyStore.getState().byConversation["conv-1"]).toEqual({
      kind: "LlmkitAnalyzer",
      grants: ["cmd:make"],
      auto: true,
    });
    expect(EventService.setConfirmationPolicy).not.toHaveBeenCalled();
  });

  it("fails, and does not show Auto, when the sandbox drops the field", async () => {
    // an image from before auto mode: the field is not part of its analyzer
    vi.mocked(EventService.setSecurityAnalyzer).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSetAutoMode(), { wrapper });
    result.current.mutate({ targets: [target], auto: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("predates auto mode");
    expect(usePolicyStore.getState().byConversation["conv-1"]?.auto).toBe(
      false,
    );
  });
});
