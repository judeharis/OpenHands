import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanReplyBuildButton } from "#/components/features/chat/plan-reply-build-button";
import { useEventStore } from "#/stores/use-event-store";

const { mockBuild, st } = vi.hoisted(() => ({ mockBuild: vi.fn(), st: { plan: true, agent: "finished" } }));
vi.mock("#/hooks/use-build-in-code-agent", () => ({ useBuildInCodeAgent: () => ({ isPlanConversation: st.plan, isPending: false }) }));
vi.mock("#/hooks/use-handle-build-plan-click", () => ({ useHandleBuildPlanClick: () => ({ handleBuildPlanClick: mockBuild }) }));
vi.mock("#/hooks/use-agent-state", () => ({ useAgentState: () => ({ curAgentState: st.agent }) }));

const reply = (text: string, role = "assistant") => ({
  id: text, timestamp: "t", source: role === "user" ? "user" : "agent",
  llm_message: { role, content: [{ type: "text", text }] }, activated_microagents: [], extended_content: [],
});
const NOTE = "Your plan looks complete. Click the Build button below the plan preview.";

describe("PlanReplyBuildButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    st.plan = true;
    st.agent = "finished";
    useEventStore.setState({ events: [reply(NOTE)] as never });
  });

  it("sits under the planner's newest reply and runs Build", async () => {
    render(<PlanReplyBuildButton raw={NOTE} isFromPlanningAgent={false} />);
    await userEvent.click(screen.getByTestId("plan-reply-build-button"));
    expect(mockBuild).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("plan-reply-build-button")).toBeDisabled();
  });

  it("also for a planner sub-conversation inside a code conversation", () => {
    st.plan = false;
    render(<PlanReplyBuildButton raw={NOTE} isFromPlanningAgent />);
    expect(screen.getByTestId("plan-reply-build-button")).toBeInTheDocument();
  });

  it("not in a code agent's reply, not under an older reply, not while the agent works", () => {
    st.plan = false;
    const { unmount } = render(<PlanReplyBuildButton raw={NOTE} isFromPlanningAgent={false} />);
    expect(screen.queryByTestId("plan-reply-build-button")).toBeNull();
    unmount();
    st.plan = true;
    useEventStore.setState({ events: [reply(NOTE), reply("yes build it", "user")] as never });
    const second = render(<PlanReplyBuildButton raw={NOTE} isFromPlanningAgent={false} />);
    expect(screen.queryByTestId("plan-reply-build-button")).toBeNull();
    second.unmount();
    useEventStore.setState({ events: [reply(NOTE)] as never });
    st.agent = "running";
    render(<PlanReplyBuildButton raw={NOTE} isFromPlanningAgent={false} />);
    expect(screen.queryByTestId("plan-reply-build-button")).toBeNull();
  });
});
