import { useEventStore } from "#/stores/use-event-store";
import { isMessageEvent } from "#/types/v1/type-guards";
import type { OpenHandsEvent } from "#/types/v1/core";

/** The text of an agent message or of its finish action (the two ways an agent replies). */
function agentText(e: OpenHandsEvent): string | null {
  if (isMessageEvent(e)) {
    if (e.llm_message.role !== "assistant") return null;
    return (e.llm_message.content as { type: string; text?: string }[])
      .map((c) => (c.type === "text" ? (c.text ?? "") : ""))
      .join("\n");
  }
  const a = (e as { action?: { kind?: string; message?: string } }).action;
  return a?.kind === "FinishAction" && typeof a.message === "string" ? a.message : null;
}

/** Whether `raw` is in the newest agent reply: only that one's choices can still be answered. */
export function isLatestReply(raw: string): boolean {
  const { events } = useEventStore.getState();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i] as OpenHandsEvent;
    if (isMessageEvent(e) && e.llm_message.role === "user") return false;
    const t = agentText(e);
    if (t && t.trim()) return t.includes(raw.trim());
  }
  return false;
}

