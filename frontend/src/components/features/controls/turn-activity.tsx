import React from "react";
import { useTurnActivity } from "#/hooks/use-turn-activity";
import { useEventStore } from "#/stores/use-event-store";
import { useAgentState } from "#/hooks/use-agent-state";
import { AgentState } from "#/types/agent-state";
import { isV1Event, isActionEvent } from "#/types/v1/type-guards";
import type { OpenHandsEvent } from "#/types/v1/core";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

const ATTEMPTS = /^\W*attempts?\W*:?\s*(\d+)/im;
// jentic's JENTIC_BEST_OF_MAX: a brief asks for at most this many attempts
const MAX_ATTEMPTS = 2;

/**
 * The sub-agents at work: every `task` call (a brief handed to a worker) that has no result
 * yet. A brief with `Attempts: 2` is two workers. jentic's automatic repair attempts after a
 * failed check run inside the same call and are not counted separately.
 */
export function runningSubAgents(events: OpenHandsEvent[]): {
  briefs: number;
  workers: number;
} {
  const answered = new Set<string>();
  events.forEach((ev) => {
    const actionId = (ev as { action_id?: string }).action_id;
    if (ev.source === "environment" && actionId) answered.add(actionId);
  });
  let briefs = 0;
  let workers = 0;
  events.forEach((ev) => {
    if (
      ev.source === "agent" &&
      isActionEvent(ev) &&
      ev.tool_name === "task" &&
      !answered.has(ev.id)
    ) {
      briefs += 1;
      const prompt = String((ev.action as { prompt?: string }).prompt ?? "");
      const m = ATTEMPTS.exec(prompt);
      workers += m ? Math.max(1, Math.min(Number(m[1]), MAX_ATTEMPTS)) : 1;
    }
  });
  return { briefs, workers };
}

/** "2 sub-agents running", "3 sub-agents running (2 briefs)" when a brief has two attempts. */
export function subAgentLabel({
  briefs,
  workers,
}: {
  briefs: number;
  workers: number;
}): string {
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(workers, "sub-agent")} running${workers > briefs ? ` (${plural(briefs, "brief")})` : ""}`;
}

/**
 * Proof that something is happening, under the composer.
 *
 * The spinner turns on a timer rather than on events, because the quiet stretch while the
 * model reads a long prompt is exactly when the user most needs to know the thing is alive
 * and is exactly when no events arrive.
 */
export function TurnActivity() {
  const { running, elapsed, streamed, totalIn, totalOut, cachedShare } =
    useTurnActivity();
  const [frame, setFrame] = React.useState(0);
  const events = useEventStore((state) => state.events);
  const { curAgentState } = useAgentState();
  // A task call waiting for the user's approval is not running yet.
  const subAgents = React.useMemo(
    () =>
      curAgentState === AgentState.RUNNING
        ? runningSubAgents(events.filter(isV1Event))
        : { briefs: 0, workers: 0 },
    [events, curAgentState],
  );

  React.useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setFrame((f) => f + 1), 120);
    return () => clearInterval(timer);
  }, [running]);

  if (!running && totalIn === null) return null;

  return (
    <div
      data-testid="turn-activity"
      className="w-full min-w-0 flex items-center gap-2 text-xs leading-4 text-[#A3A3A3] whitespace-nowrap overflow-hidden"
    >
      {running && (
        <>
          <span aria-hidden className="w-3 shrink-0 text-center">
            {SPINNER[frame % SPINNER.length]}
          </span>
          <span data-testid="turn-activity-state" className="shrink-0">
            {streamed === null ? "reading the conversation" : "writing"}
            {elapsed !== null ? ` · ${elapsed}s` : ""}
          </span>
          {streamed !== null && (
            <span data-testid="turn-activity-streamed" className="shrink-0">
              ~{compact(streamed)} tokens
            </span>
          )}
        </>
      )}
      {subAgents.workers > 0 && (
        <span
          data-testid="turn-activity-subagents"
          className="shrink-0 text-amber-400"
          title="Workers doing briefs the main agent handed out; each reports back when its brief is done"
        >
          {subAgentLabel(subAgents)}
        </span>
      )}
      {totalIn !== null ? (
        <span
          data-testid="turn-activity-totals"
          className="truncate"
          title="Tokens this conversation has used in total, and the share of input served from the prompt cache rather than read again"
        >
          {compact(totalIn)} in
          {totalOut !== null ? ` · ${compact(totalOut)} out` : ""}
          {cachedShare !== null
            ? ` · ${Math.round(cachedShare * 100)}% cached`
            : ""}
        </span>
      ) : null}
    </div>
  );
}
