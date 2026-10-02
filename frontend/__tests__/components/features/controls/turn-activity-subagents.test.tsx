import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TurnActivity,
  runningSubAgents,
  subAgentLabel,
} from "#/components/features/controls/turn-activity";
import { useEventStore } from "#/stores/use-event-store";
import { AgentState } from "#/types/agent-state";

let agentState = AgentState.RUNNING;
vi.mock("#/hooks/use-agent-state", () => ({
  useAgentState: () => ({ curAgentState: agentState }),
}));
vi.mock("#/hooks/use-turn-activity", () => ({
  useTurnActivity: () => ({
    running: true,
    elapsed: 12,
    streamed: null,
    totalIn: 64000,
    totalOut: 757,
    cachedShare: 0.64,
  }),
}));

const task = (
  id: string,
  prompt = "Goal: x\nGrants:\n- write:/workspace/project/a/",
) =>
  ({
    id,
    timestamp: "2026-10-02T00:00:00Z",
    source: "agent",
    thought: [],
    action: { kind: "TaskAction", prompt, subagent_type: "worker" },
    tool_name: "task",
    tool_call_id: `call-${id}`,
    tool_call: { id: `call-${id}`, name: "task", arguments: "{}" },
    llm_response_id: "resp-1",
    security_risk: "UNKNOWN",
  }) as never;
const done = (actionId: string) =>
  ({
    id: `obs-${actionId}`,
    timestamp: "2026-10-02T00:00:01Z",
    source: "environment",
    action_id: actionId,
    tool_name: "task",
    tool_call_id: `call-${actionId}`,
    observation: { kind: "TaskObservation" },
  }) as never;
const terminal = (id: string) =>
  ({
    ...(task(id) as object),
    tool_name: "terminal",
    action: { kind: "TerminalAction", command: "ls" },
  }) as never;

describe("running sub-agents", () => {
  it("counts task calls without a result, two for a brief with two attempts", () => {
    expect(runningSubAgents([])).toEqual({ briefs: 0, workers: 0 });
    expect(
      runningSubAgents([task("a"), task("b"), done("a"), terminal("c")]),
    ).toEqual({ briefs: 1, workers: 1 });
    expect(
      runningSubAgents([task("a"), task("b", "Goal: y\nAttempts: 2\n")]),
    ).toEqual({ briefs: 2, workers: 3 });
    expect(runningSubAgents([task("a", "Attempts: 9")])).toEqual({
      briefs: 1,
      workers: 2,
    }); // jentic caps it at 2
  });

  it("words it for the line", () => {
    expect(subAgentLabel({ briefs: 1, workers: 1 })).toBe(
      "1 sub-agent running",
    );
    expect(subAgentLabel({ briefs: 2, workers: 2 })).toBe(
      "2 sub-agents running",
    );
    expect(subAgentLabel({ briefs: 2, workers: 3 })).toBe(
      "3 sub-agents running (2 briefs)",
    );
  });

  beforeEach(() => {
    agentState = AgentState.RUNNING;
    useEventStore.setState({ events: [task("a"), task("b")] } as never);
  });

  it("shows under the composer while the agent works", () => {
    render(<TurnActivity />);
    expect(screen.getByTestId("turn-activity-subagents").textContent).toBe(
      "2 sub-agents running",
    );
    expect(screen.getByTestId("turn-activity-totals").textContent).toContain(
      "64k in",
    );
  });

  it("is not shown while the briefs wait for approval, or when none are running", () => {
    agentState = AgentState.AWAITING_USER_CONFIRMATION;
    const { unmount } = render(<TurnActivity />);
    expect(screen.queryByTestId("turn-activity-subagents")).toBeNull();
    unmount();
    agentState = AgentState.RUNNING;
    useEventStore.setState({ events: [task("a"), done("a")] } as never);
    render(<TurnActivity />);
    expect(screen.queryByTestId("turn-activity-subagents")).toBeNull();
  });
});
