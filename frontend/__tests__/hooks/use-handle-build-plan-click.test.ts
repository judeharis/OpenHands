import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useHandleBuildPlanClick } from "#/hooks/use-handle-build-plan-click";
import { useConversationStore } from "#/stores/conversation-store";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";
import { useEventStore } from "#/stores/use-event-store";
import { createChatMessage } from "#/services/chat-service";
import { BUILD_PREAMBLE } from "#/utils/build-step";

// Mock the send message hook - we'll mock the underlying WebSocket services
vi.mock("#/hooks/use-send-message", () => ({
  useSendMessage: vi.fn(),
}));

// Mock the chat service
vi.mock("#/services/chat-service", () => ({
  createChatMessage: vi.fn(),
}));

// The plan-conversation handover (queries, router) is tested in use-build-in-code-agent.test;
// here the conversation is a normal one unless a test says otherwise.
const mockBuildInCodeAgent = vi.fn();
const buildState = { isPlanConversation: false };
vi.mock("#/hooks/use-build-in-code-agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#/hooks/use-build-in-code-agent")>()),
  useBuildInCodeAgent: () => ({
    isPlanConversation: buildState.isPlanConversation,
    buildInCodeAgent: mockBuildInCodeAgent,
    isPending: false,
  }),
}));

// PLAN.md is asked for on the active conversation's sandbox.
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({ data: { id: "conv1" } }),
}));
const readConversationFile = vi.fn();
vi.mock("#/api/conversation-service/v1-conversation-service.api", () => ({
  default: {
    readConversationFile: (...a: unknown[]) => readConversationFile(...a),
  },
}));

// Import mocked modules
import { useSendMessage } from "#/hooks/use-send-message";

const BUILD_STEP = `${BUILD_PREAMBLE}\n\nExecute the plan in .agents_tmp/PLAN.md, which the planning agent wrote.`;

const reply = (text: string, isFromPlanningAgent: boolean) => ({
  id: text,
  timestamp: "",
  source: "agent",
  isFromPlanningAgent,
  llm_message: { role: "assistant", content: [{ type: "text", text }] },
});

describe("useHandleBuildPlanClick", () => {
  const mockSend = vi.fn();

  const click = async (event?: unknown) => {
    const { result } = renderHook(() => useHandleBuildPlanClick());
    await act(async () => {
      await result.current.handleBuildPlanClick(
        event as React.MouseEvent<HTMLButtonElement>,
      );
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useConversationStore.setState({
      conversationMode: "plan",
      planContent: "# Plan",
    });
    useOptimisticUserMessageStore.setState({ optimisticUserMessage: null });
    useEventStore.setState({ events: [] });
    readConversationFile.mockResolvedValue("");
    (useSendMessage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      send: mockSend,
    });
    (createChatMessage as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (content: string) => ({ action: "message", args: { content } }),
    );
  });

  afterEach(() => {
    buildState.isPlanConversation = false;
    useConversationStore.setState({ conversationMode: "code" });
  });

  it("switches the same conversation from plan to code mode", async () => {
    await click();
    expect(useConversationStore.getState().conversationMode).toBe("code");
  });

  it("tells the code agent to build, in a message the chat does not show", async () => {
    await click();

    expect(createChatMessage).toHaveBeenCalledWith(
      BUILD_STEP,
      [],
      [],
      expect.any(String),
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
    // not shown as if the user had typed it
    expect(
      useOptimisticUserMessageStore.getState().optimisticUserMessage,
    ).toBeNull();
  });

  it("inlines the planner's longest reply when PLAN.md was never written", async () => {
    useConversationStore.setState({ planContent: null });
    useEventStore.setState({
      events: [
        reply("step 1, step 2, step 3", true),
        reply("click Build", true),
        reply("a much longer reply from the code agent itself", false),
      ] as never,
    });

    await click();

    expect(readConversationFile).toHaveBeenCalledWith("conv1");
    const text = (createChatMessage as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as string;
    expect(text.startsWith(BUILD_PREAMBLE)).toBe(true);
    expect(text).toContain("step 1, step 2, step 3");
    expect(text).not.toContain("code agent itself");
  });

  it("prevents default and stops propagation of a click or key", async () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    await click(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(useConversationStore.getState().conversationMode).toBe("code");
  });

  it("hands over to a code agent instead when the conversation was started as a planner", async () => {
    buildState.isPlanConversation = true;
    await click();

    expect(mockBuildInCodeAgent).toHaveBeenCalledTimes(1);
    expect(mockSend).not.toHaveBeenCalled();
    expect(useConversationStore.getState().conversationMode).toBe("plan");
  });
});
