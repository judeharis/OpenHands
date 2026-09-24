import { beforeEach, describe, expect, it } from "vitest";
import {
  takeThinkingNote,
  useThinkingNoteStore,
} from "#/stores/thinking-note-store";

describe("thinking notes from the sandbox (llmkit_live)", () => {
  beforeEach(() => useThinkingNoteStore.getState().clear());

  it("takes a note out of the event stream and keeps the latest", () => {
    expect(
      takeThinkingNote(
        { kind: "ThinkingNoteEvent", note: "weighing range() against a list", elapsed_s: 120, chars: 5000 },
        true,
      ),
    ).toBe(true);
    expect(useThinkingNoteStore.getState().current).toEqual({
      note: "weighing range() against a list",
      elapsedS: 120,
      chars: 5000,
      fromPlanner: true,
    });
  });

  it("clears when the call ends or the agent acts", () => {
    takeThinkingNote({ kind: "ThinkingNoteEvent", note: "x", elapsed_s: 60 }, false);
    takeThinkingNote({ kind: "ThinkingNoteEvent", done: true }, false);
    expect(useThinkingNoteStore.getState().current).toBeNull();

    takeThinkingNote({ kind: "ThinkingNoteEvent", note: "x", elapsed_s: 60 }, false);
    expect(takeThinkingNote({ kind: "ActionEvent", source: "agent" }, false)).toBe(false);
    expect(useThinkingNoteStore.getState().current).toBeNull();
  });

  it("leaves every other event to the chat", () => {
    expect(takeThinkingNote({ kind: "MessageEvent", source: "user" }, false)).toBe(false);
    expect(takeThinkingNote({ kind: "StreamingDeltaEvent", source: "agent" }, false)).toBe(false);
  });
});
