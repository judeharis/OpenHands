import { describe, expect, it } from "vitest";
import {
  conversationStats,
  duration,
  tokens,
} from "#/utils/conversation-stats";

const iso = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second)).toISOString();

const action = (id: string, kind: string, second: number) => ({
  id,
  kind: "ActionEvent",
  source: "agent",
  timestamp: iso(second),
  action: { kind },
  tool_name: kind,
  tool_call_id: id,
});

const observation = (actionId: string, second: number) => ({
  id: `obs-${actionId}`,
  kind: "ObservationEvent",
  source: "environment",
  timestamp: iso(second),
  action_id: actionId,
  tool_name: "t",
  tool_call_id: actionId,
  observation: { kind: "TerminalObservation" },
});

// An action's timestamp is when the model finished deciding; its observation's is when the
// tool finished. Everything between the previous observation and the next action is the
// model. On a local model that is usually most of the turn.
const events = [
  action("a1", "TerminalAction", 0),
  observation("a1", 10), // tool 10 s
  action("a2", "FileEditorAction", 14), // model 4 s
  observation("a2", 15), // tool 1 s
  action("a3", "TerminalAction", 20), // model 5 s
  observation("a3", 50), // tool 30 s
] as never[];

describe("what a conversation cost (jentic)", () => {
  it("splits the clock into the model's share and the tools'", () => {
    const stats = conversationStats(events);
    expect(stats.steps).toBe(3);
    expect(stats.toolSeconds).toBe(41);
    expect(stats.modelSeconds).toBe(9);
  });

  it("does not count the run-up to the first action as model time", () => {
    // Nothing is known about what happened before the first step, so it is null, not zero.
    const stats = conversationStats(events.slice(0, 2));
    expect(stats.steps).toBe(1);
    expect(stats.modelSeconds).toBe(0);
    expect(stats.toolSeconds).toBe(10);
  });

  it("groups tools slowest first and averages them", () => {
    const [first, second] = conversationStats(events).byTool;
    expect(first).toEqual({ tool: "TerminalAction", calls: 2, seconds: 40 });
    expect(second).toEqual({ tool: "FileEditorAction", calls: 1, seconds: 1 });
  });

  it("names the slowest single call, which is what a slow conversation waits on", () => {
    expect(conversationStats(events).slowest).toMatchObject({
      tool: "TerminalAction",
      toolSeconds: 30,
    });
  });

  it("ignores an action whose observation never arrived", () => {
    const pending = [...events, action("a4", "TerminalAction", 60)] as never[];
    expect(conversationStats(pending).steps).toBe(3);
  });

  it("survives an empty conversation", () => {
    const stats = conversationStats([]);
    expect(stats).toMatchObject({ steps: 0, modelSeconds: 0, toolSeconds: 0, slowest: null });
  });

  it("writes durations a person reads", () => {
    expect(duration(4.23)).toBe("4.2 s");
    expect(duration(41)).toBe("41 s");
    expect(duration(192)).toBe("3 min 12 s");
    expect(duration(3860)).toBe("1 h 04 min");
  });

  it("writes tokens short enough for a phone", () => {
    expect(tokens(940)).toBe("940");
    expect(tokens(1500)).toBe("1.5k");
    expect(tokens(24100)).toBe("24k");
    expect(tokens(1875850)).toBe("1.9M");
  });
});
