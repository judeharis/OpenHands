import { describe, expect, it } from "vitest";
import { shouldRenderEvent } from "#/components/v1/chat/event-content-helpers/should-render-event";
import {
  createPlanningFileEditorActionEvent,
  createOtherActionEvent,
  createPlanningObservationEvent,
  createUserMessageEvent,
} from "test-utils";
import { ACPToolCallEvent } from "#/types/v1/core/events/acp-tool-call-event";
import { HookExecutionEvent } from "#/types/v1/core/events/hook-execution-event";
import { BUILD_PREAMBLE } from "#/utils/build-step";

const makeACPEvent = (
  overrides: Partial<ACPToolCallEvent> = {},
): ACPToolCallEvent => ({
  id: "acp-1",
  kind: "ACPToolCallEvent",
  timestamp: "2024-01-01T00:00:00Z",
  source: "agent",
  tool_call_id: "tc-1",
  title: "Run command",
  status: "completed",
  tool_kind: "execute",
  raw_input: { command: "ls" },
  raw_output: "file.txt",
  content: null,
  is_error: false,
  ...overrides,
});

describe("shouldRenderEvent - PlanningFileEditorAction", () => {
  it("should return false for PlanningFileEditorAction", () => {
    const event = createPlanningFileEditorActionEvent("action-1");

    expect(shouldRenderEvent(event)).toBe(false);
  });

  it("should return true for other action types", () => {
    const event = createOtherActionEvent("action-1");

    expect(shouldRenderEvent(event)).toBe(true);
  });

  it("should return true for PlanningFileEditorObservation", () => {
    const event = createPlanningObservationEvent("obs-1");

    // Observations should still render (they're handled separately in event-message)
    expect(shouldRenderEvent(event)).toBe(true);
  });

  it("should return true for user message events", () => {
    const event = createUserMessageEvent("msg-1");

    expect(shouldRenderEvent(event)).toBe(true);
  });
});

describe("shouldRenderEvent - ACPToolCallEvent", () => {
  it("should return false for in_progress events (suppress empty-args flash)", () => {
    const event = makeACPEvent({ status: "in_progress", raw_input: {} });

    expect(shouldRenderEvent(event)).toBe(false);
  });

  it("should return true for completed events", () => {
    const event = makeACPEvent({ status: "completed" });

    expect(shouldRenderEvent(event)).toBe(true);
  });

  it("should return true for failed events", () => {
    const event = makeACPEvent({ status: "failed", is_error: true });

    expect(shouldRenderEvent(event)).toBe(true);
  });

  it("should return false for null status (pre-terminal — no production events yet)", () => {
    // ACP feature flag has never shipped to production with the GUI, so
    // there are no legacy null-status events in the wild. Treat null as
    // pre-terminal and suppress to avoid flashing an empty card during
    // the intermediate updates some ACP servers emit before settling.
    const event = makeACPEvent({ status: null });

    expect(shouldRenderEvent(event)).toBe(false);
  });
});

describe("shouldRenderEvent - HookExecutionEvent", () => {
  const makeHookEvent = (
    overrides: Partial<HookExecutionEvent> = {},
  ): HookExecutionEvent => ({
    id: "hook-1",
    kind: "HookExecutionEvent",
    timestamp: "2024-01-01T00:00:00Z",
    source: "hook",
    hook_event_type: "PreToolUse",
    hook_command: "/opt/llmkit/guard/guard.sh",
    success: true,
    blocked: false,
    exit_code: 0,
    reason: null,
    tool_name: "terminal",
    action_id: "action-1",
    message_id: null,
    stdout: "",
    stderr: "",
    error: null,
    additional_context: null,
    hook_input: null,
    ...overrides,
  });

  it("hides a hook that passed", () => {
    expect(shouldRenderEvent(makeHookEvent())).toBe(false);
  });

  it("shows a hook that blocked the action", () => {
    expect(
      shouldRenderEvent(
        makeHookEvent({ success: false, blocked: true, exit_code: 2, reason: "privilege escalation" }),
      ),
    ).toBe(true);
  });

  it("shows a hook that failed", () => {
    expect(
      shouldRenderEvent(makeHookEvent({ success: false, exit_code: 1 })),
    ).toBe(true);
  });

  it("shows a hook that errored", () => {
    expect(
      shouldRenderEvent(makeHookEvent({ error: "timed out" })),
    ).toBe(true);
  });
});

describe("shouldRenderEvent - the Build step", () => {
  const userText = (text: string) =>
    ({
      ...createUserMessageEvent("m1"),
      llm_message: { role: "user", content: [{ type: "text", text }] },
    }) as never;

  it("hides the message that switches a conversation from planning to building", () => {
    expect(shouldRenderEvent(userText(`${BUILD_PREAMBLE}\n\nExecute the plan in .agents_tmp/PLAN.md.`))).toBe(false);
  });

  it("still shows what the user wrote", () => {
    expect(shouldRenderEvent(userText("build it"))).toBe(true);
  });
});
