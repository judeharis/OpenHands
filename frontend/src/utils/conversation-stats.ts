import { isActionEvent, isObservationEvent, isV1Event } from "#/types/v1/type-guards";

/** The store holds v0 and v1 events side by side while the migration finishes; this walks
 *  whatever is there and takes the v1 action/observation pairs. */
type AnyEvent = Parameters<typeof isV1Event>[0];

/**
 * Where a conversation's wall clock went, from its own events.
 *
 * The model's share and the tools' share are different problems with different fixes, and
 * only the event stream separates them: an action's timestamp is when the model finished
 * deciding, and its observation's is when the tool finished running. Everything between the
 * previous tool finishing and the next action appearing is the model reading the
 * conversation and writing its reply -- on a local model that is usually most of the turn.
 *
 * This is the same derivation as `jentic metrics turns` on the kit side, done here so a
 * conversation can be looked at without leaving the UI.
 */
export interface Step {
  tool: string;
  modelSeconds: number | null;
  toolSeconds: number;
}

export interface ToolTotal {
  tool: string;
  calls: number;
  seconds: number;
}

export interface ConversationStats {
  steps: number;
  modelSeconds: number;
  toolSeconds: number;
  byTool: ToolTotal[];
  /** Longest single tool call, which is usually what a slow conversation is waiting on. */
  slowest: Step | null;
}

const at = (event: { timestamp?: string }): number | null => {
  if (!event.timestamp) return null;
  const parsed = Date.parse(event.timestamp);
  return Number.isNaN(parsed) ? null : parsed / 1000;
};

export function conversationStats(events: readonly AnyEvent[]): ConversationStats {
  const actions = new Map<string, { kind: string; at: number }>();
  const steps: Step[] = [];
  let previousEnd: number | null = null;

  for (const event of events) {
    if (!isV1Event(event)) continue;
    if (isActionEvent(event) && event.source === "agent") {
      const started = at(event);
      if (started !== null && event.id) {
        actions.set(event.id, { kind: event.action?.kind ?? "action", at: started });
      }
      continue;
    }
    if (!isObservationEvent(event)) continue;
    const action = event.action_id ? actions.get(event.action_id) : undefined;
    const ended = at(event);
    if (!action || ended === null) continue;
    actions.delete(event.action_id!);
    steps.push({
      tool: action.kind,
      modelSeconds: previousEnd === null ? null : Math.max(0, action.at - previousEnd),
      toolSeconds: Math.max(0, ended - action.at),
    });
    previousEnd = ended;
  }

  const byTool = new Map<string, ToolTotal>();
  for (const step of steps) {
    const total = byTool.get(step.tool) ?? { tool: step.tool, calls: 0, seconds: 0 };
    total.calls += 1;
    total.seconds += step.toolSeconds;
    byTool.set(step.tool, total);
  }

  return {
    steps: steps.length,
    modelSeconds: steps.reduce((sum, s) => sum + (s.modelSeconds ?? 0), 0),
    toolSeconds: steps.reduce((sum, s) => sum + s.toolSeconds, 0),
    byTool: [...byTool.values()].sort((a, b) => b.seconds - a.seconds),
    slowest: steps.reduce<Step | null>(
      (worst, s) => (worst === null || s.toolSeconds > worst.toolSeconds ? s : worst),
      null,
    ),
  };
}

/** "4.2 s", "3 min 12 s", "1 h 04 min" -- a duration someone reads, not a float. */
export function duration(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)} s`;
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${String(Math.round(seconds % 60)).padStart(2, "0")} s`;
  return `${Math.floor(seconds / 3600)} h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")} min`;
}

/** Tokens, short enough for a phone: 940, 24k, 1.9M. */
export function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}
