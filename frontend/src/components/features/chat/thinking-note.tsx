import { useThinkingNoteStore } from "#/stores/thinking-note-store";
import { useAgentState } from "#/hooks/use-agent-state";
import { AgentState } from "#/types/agent-state";

/* eslint-disable i18next/no-literal-string */
const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

/**
 * Fork: one line on what the agent is thinking about, refreshed every minute of a long
 * think (llmkit_live summarises its reasoning with the utility model). Without it the
 * phone showed three dots for as long as ten minutes.
 */
export function ThinkingNote() {
  const note = useThinkingNoteStore((s) => s.current);
  const { curAgentState } = useAgentState();
  if (!note || curAgentState !== AgentState.RUNNING) return null;
  return (
    <div
      data-testid="thinking-note"
      className="flex items-start gap-2 px-3 py-2 mb-2 rounded-lg bg-tertiary text-xs text-neutral-300"
    >
      <span aria-hidden>💭</span>
      <span className="min-w-0 break-words">
        <span className="text-neutral-400">
          {note.fromPlanner ? "Planner" : "Agent"} thinking ·{" "}
          {minutes(note.elapsedS)}:{" "}
        </span>
        {note.note}
      </span>
    </div>
  );
}
