import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OHEvent, useEventStore } from "#/stores/use-event-store";
import {
  ActionEvent,
  MessageEvent,
  ObservationEvent,
  SecurityRisk,
} from "#/types/v1/core";
import { StreamingDeltaEvent } from "#/types/v1/core/events/streaming-delta-event";

const mockUserMessageEvent: MessageEvent = {
  id: "test-event-1",
  timestamp: Date.now().toString(),
  source: "user",
  llm_message: {
    role: "user",
    content: [{ type: "text", text: "Hello, world!" }],
  },
  activated_microagents: [],
  extended_content: [],
};

const mockActionEvent: ActionEvent = {
  id: "test-action-1",
  timestamp: Date.now().toString(),
  source: "agent",
  thought: [{ type: "text", text: "I need to execute a bash command" }],
  thinking_blocks: [],
  action: {
    kind: "ExecuteBashAction",
    command: "echo hello",
    is_input: false,
    timeout: null,
    reset: false,
  },
  tool_name: "execute_bash",
  tool_call_id: "call_123",
  tool_call: {
    id: "call_123",
    type: "function",
    function: {
      name: "execute_bash",
      arguments: '{"command": "echo hello"}',
    },
  },
  llm_response_id: "response_123",
  security_risk: SecurityRisk.UNKNOWN,
};

const mockObservationEvent: ObservationEvent = {
  id: "test-observation-1",
  timestamp: Date.now().toString(),
  source: "environment",
  tool_name: "execute_bash",
  tool_call_id: "call_123",
  observation: {
    kind: "ExecuteBashObservation",
    content: [{ type: "text", text: "hello\n" }],
    command: "echo hello",
    exit_code: 0,
    error: false,
    timeout: false,
    metadata: {
      exit_code: 0,
      pid: 12345,
      username: "user",
      hostname: "localhost",
      working_dir: "/home/user",
      py_interpreter_path: null,
      prefix: "",
      suffix: "",
    },
  },
  action_id: "test-action-1",
};

describe("useEventStore", () => {
  it("should render initial state correctly", () => {
    const { result } = renderHook(() => useEventStore());
    expect(result.current.events).toEqual([]);
  });

  it("should add an event to the store", () => {
    const { result } = renderHook(() => useEventStore());

    act(() => {
      result.current.addEvent(mockUserMessageEvent);
    });

    expect(result.current.events).toEqual([mockUserMessageEvent]);
  });

  it("should retrieve events whose actions are replaced by their observations", () => {
    const { result } = renderHook(() => useEventStore());

    act(() => {
      result.current.addEvent(mockUserMessageEvent);
      result.current.addEvent(mockActionEvent);
      result.current.addEvent(mockObservationEvent);
    });

    expect(result.current.uiEvents).toEqual([
      mockUserMessageEvent,
      mockObservationEvent,
    ]);
  });

  it("should clear all events when clearEvents is called", () => {
    const { result } = renderHook(() => useEventStore());

    // Add some events first
    act(() => {
      result.current.addEvent(mockUserMessageEvent);
      result.current.addEvent(mockActionEvent);
    });

    // Verify events were added
    expect(result.current.events).toHaveLength(2);
    expect(result.current.uiEvents).toHaveLength(2);

    // Clear events
    act(() => {
      result.current.clearEvents();
    });

    // Verify events were cleared
    expect(result.current.events).toEqual([]);
    expect(result.current.uiEvents).toEqual([]);
  });
});

describe("useEventStore.addEvents (jentic)", () => {
  const at = (second: number) =>
    `2026-09-23T00:00:${String(second).padStart(2, "0")}.000000`;
  const delta = (id: string, second: number, content: string) =>
    ({
      id,
      timestamp: at(second),
      source: "agent",
      kind: "StreamingDeltaEvent",
      content,
      reasoning_content: null,
    }) as StreamingDeltaEvent;

  // A replayed history with everything the one-at-a-time path has to handle: streamed
  // deltas that merge, an action its observation replaces, a duplicate, and an event
  // that arrives after later ones.
  const user = { ...mockUserMessageEvent, id: "u1", timestamp: at(1) };
  const action = { ...mockActionEvent, id: "a1", timestamp: at(5) };
  const observation = {
    ...mockObservationEvent,
    id: "o1",
    timestamp: at(6),
    action_id: "a1",
  };
  const late = {
    ...mockUserMessageEvent,
    id: "u0",
    timestamp: at(0),
    llm_message: {
      role: "user" as const,
      content: [{ type: "text" as const, text: "first" }],
    },
  };
  const history: OHEvent[] = [
    user,
    delta("d1", 2, "I need to "),
    delta("d2", 3, "execute"),
    action,
    observation,
    action, // replayed twice
    late,
  ];

  const lists = () => {
    const { events, eventIds, uiEvents } = useEventStore.getState();
    return { events, eventIds: [...eventIds], uiEvents };
  };

  beforeEach(() => {
    useEventStore.getState().clearEvents();
  });

  it("ends with exactly the lists that adding one at a time produces", () => {
    history.forEach((event) => useEventStore.getState().addEvent(event));
    const oneAtATime = lists();
    expect(oneAtATime.events.length).toBeGreaterThan(3); // the history did land

    useEventStore.getState().clearEvents();
    useEventStore.getState().addEvents(history);

    expect(lists()).toEqual(oneAtATime);
  });

  it("notifies subscribers once for the whole history", () => {
    // One notification is one re-render of the chat. Adding a replayed history one event
    // at a time re-rendered it once per event: 20 s for 422 events.
    const listener = vi.fn();
    const unsubscribe = useEventStore.subscribe(listener);
    useEventStore.getState().addEvents(history);
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify at all when a reconnect replays events already there", () => {
    useEventStore.getState().addEvents(history);
    const listener = vi.fn();
    const unsubscribe = useEventStore.subscribe(listener);
    useEventStore.getState().addEvents(history);
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });
});
