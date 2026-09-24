import { create } from "zustand";

/**
 * Fork: what the agent is thinking about during a long LLM call. The sandbox (llmkit_live)
 * summarises the model's reasoning into one line every minute and sends it as a live-only
 * ThinkingNoteEvent; it is never stored, so a reload shows the next one. Cleared when the
 * call ends (done) or the agent's next action or message arrives.
 */
export interface ThinkingNote {
  note: string;
  elapsedS: number;
  chars: number;
  fromPlanner: boolean;
}

interface ThinkingNoteStore {
  current: ThinkingNote | null;
  set: (note: ThinkingNote) => void;
  clear: () => void;
}

export const useThinkingNoteStore = create<ThinkingNoteStore>((set) => ({
  current: null,
  set: (current) => set({ current }),
  clear: () => set({ current: null }),
}));

/**
 * Takes a socket event if it is a thinking note, and clears the note on the agent's next
 * action or message. Returns true when the event was a note (and so is not a chat event).
 */
export function takeThinkingNote(
  event: {
    kind?: string;
    source?: string;
    note?: string;
    elapsed_s?: number;
    chars?: number;
    done?: boolean;
  },
  fromPlanner: boolean,
): boolean {
  const store = useThinkingNoteStore.getState();
  if (event?.kind === "ThinkingNoteEvent") {
    if (event.done || !event.note) store.clear();
    else
      store.set({
        note: event.note,
        elapsedS: event.elapsed_s ?? 0,
        chars: event.chars ?? 0,
        fromPlanner,
      });
    return true;
  }
  if (
    event?.source === "agent" &&
    (event.kind === "ActionEvent" || event.kind === "MessageEvent")
  )
    store.clear();
  return false;
}
