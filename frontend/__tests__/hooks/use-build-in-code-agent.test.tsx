import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BUILD_PREAMBLE, buildMessage, planFromReplies, useBuildInCodeAgent } from "#/hooks/use-build-in-code-agent";
import { useConversationStore } from "#/stores/conversation-store";
import { useEventStore } from "#/stores/use-event-store";

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
const mockCreate = vi.fn();
const state = { agentType: "plan" as "plan" | "default" };

vi.mock("react-router", async () => {
  const React = await import("react");
  return { UNSAFE_NavigationContext: React.createContext({ navigator: { push: mockNavigate } }) };
});
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({ data: { id: "planner1", sandbox_id: "oh-agent-server-abc" } }),
}));
vi.mock("#/hooks/query/use-conversation-agent-type", () => ({
  useConversationAgentType: () => ({ data: state.agentType }),
}));
const fileState = { plan: "" };
vi.mock("#/api/conversation-service/v1-conversation-service.api", () => ({
  default: { readConversationFile: async () => { if (!fileState.plan) throw new Error("404"); return fileState.plan; } },
}));
vi.mock("#/hooks/mutation/use-create-conversation", () => ({
  useCreateConversation: () => ({ mutate: mockCreate, isPending: false }),
}));

const reply = (text: string) => ({
  id: text, timestamp: "t", source: "agent",
  llm_message: { role: "assistant", content: [{ type: "text", text }] },
  activated_microagents: [], extended_content: [],
});

describe("useBuildInCodeAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.agentType = "plan";
    fileState.plan = "";
    useConversationStore.setState({ planContent: "# PLAN" });
    useEventStore.setState({ events: [] });
  });

  it("starts a code conversation in the planner's sandbox with PLAN.md as its task, then opens it", async () => {
    const { result } = renderHook(() => useBuildInCodeAgent());
    expect(result.current.isPlanConversation).toBe(true);

    await act(() => result.current.buildInCodeAgent());

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [vars, opts] = mockCreate.mock.calls[0];
    expect(vars).toEqual({
      query: `${BUILD_PREAMBLE}\n\nExecute the plan in .agents_tmp/PLAN.md (written by planning conversation planner1).`,
      agentType: "default",
      sandboxId: "oh-agent-server-abc",
    });
    opts.onSuccess({ conversation_id: "task-xyz" });
    expect(mockNavigate).toHaveBeenCalledWith("/conversations/task-xyz");
  });

  it("finds PLAN.md on the sandbox when the preview never rendered (a conversation opened fresh)", async () => {
    useConversationStore.setState({ planContent: null });
    fileState.plan = "# PLAN\n1. write the report";
    const { result } = renderHook(() => useBuildInCodeAgent());
    await act(() => result.current.buildInCodeAgent());
    expect(mockCreate.mock.calls[0][0].query).toContain("Execute the plan in .agents_tmp/PLAN.md");
  });

  it("with no PLAN.md, hands over the planner's longest reply, not its hand-off note", async () => {
    useConversationStore.setState({ planContent: null });
    useEventStore.setState({ events: [
      reply("1. OBJECTIVE: a 15 page report\n2. APPROACH: one section per topic\n3. STEPS: ..."),
      reply("Click the Build button below the plan preview."),
    ] as never });
    const { result } = renderHook(() => useBuildInCodeAgent());

    await act(() => result.current.buildInCodeAgent());

    const q = mockCreate.mock.calls[0][0].query as string;
    expect(q.startsWith(BUILD_PREAMBLE)).toBe(true);
    expect(q).toContain("(its PLAN.md was not written):\n\n1. OBJECTIVE: a 15 page report");
    expect(q).not.toContain("Click the Build button");
  });

  it("is not a planner for a conversation started in code mode", () => {
    state.agentType = "default";
    const { result } = renderHook(() => useBuildInCodeAgent());
    expect(result.current.isPlanConversation).toBe(false);
  });
});

describe("buildMessage / planFromReplies", () => {
  it("caps a long fallback plan", () => {
    const msg = buildMessage("p", false, "x".repeat(20_000));
    expect(msg.endsWith("…(truncated)")).toBe(true);
    expect(msg.length).toBeLessThan(12_600);
  });

  it("skips user messages and picks the longest reply", () => {
    const user = { ...reply("do it all, and much more than that"), source: "user", llm_message: { role: "user", content: [{ type: "text", text: "do it all, and much more than that" }] } };
    expect(planFromReplies([reply("the plan, in detail"), user, reply("ok")])).toBe("the plan, in detail");
  });
});
