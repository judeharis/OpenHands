import { describe, expect, it } from "vitest";
import {
  countReplayed,
  replayComplete,
  ReplayWindow,
} from "#/utils/history-replay";

const opened = (expected: number | null = null): ReplayWindow => ({
  active: true,
  firstMessage: true,
  received: 0,
  expected,
  onEnd: () => {},
});

const stateUpdate = { id: "s", kind: "ConversationStateUpdateEvent" };
const delta = { id: "d", kind: "StreamingDeltaEvent", content: "tok" };
const message = (id: string) => ({ id, kind: "MessageEvent" });

// The replay window closes when the stored events received reach the sandbox's count.
// What the server sends is more than the stored events: counting the extra messages
// closed the window early, and the conversation's last event then landed after the chat
// had appeared (an error banner moving the view by 96 px, 2026-09-23).
describe("history replay counting (jentic)", () => {
  it("does not count the state snapshot the server sends before the replay", () => {
    const replay = opened(2);
    countReplayed(replay, stateUpdate);
    countReplayed(replay, message("stored-1"));
    expect(replayComplete(replay)).toBe(false); // one stored event of two

    countReplayed(replay, message("stored-2"));
    expect(replayComplete(replay)).toBe(true);
  });

  it("counts a state update that is not the first message: those are stored", () => {
    const replay = opened(2);
    countReplayed(replay, message("stored-1"));
    countReplayed(replay, stateUpdate);
    expect(replayComplete(replay)).toBe(true);
  });

  it("does not count streaming deltas, which are never stored", () => {
    const replay = opened(2);
    countReplayed(replay, stateUpdate);
    countReplayed(replay, message("stored-1"));
    countReplayed(replay, delta);
    countReplayed(replay, delta);
    expect(replayComplete(replay)).toBe(false);

    countReplayed(replay, message("stored-2"));
    expect(replayComplete(replay)).toBe(true);
  });

  it("is not complete before the count is known", () => {
    const replay = opened(null);
    countReplayed(replay, message("stored-1"));
    expect(replayComplete(replay)).toBe(false);
  });

  it("claims nothing once the window has closed: later messages are live", () => {
    const replay = { ...opened(1), active: false };
    expect(countReplayed(replay, message("live-1"))).toBe(false);
    expect(replay.received).toBe(0);
  });

  it("survives a message that is not an object", () => {
    const replay = opened(1);
    expect(countReplayed(replay, "not json object")).toBe(true);
    expect(countReplayed(replay, null)).toBe(true);
  });
});
