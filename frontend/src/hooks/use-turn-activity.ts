import React from "react";
import { useEventStore } from "#/stores/use-event-store";
import { useV1ConversationStateStore } from "#/stores/v1-conversation-state-store";
import useMetricsStore from "#/stores/metrics-store";
import {
  isMessageEvent,
  isStreamingDeltaEvent,
  isV1Event,
} from "#/types/v1/type-guards";

/**
 * What the agent is doing right now, for the strip under the composer.
 *
 * A local model on a shared box can spend a minute reading a long prompt before it writes
 * a word, and until now the UI showed nothing in that gap -- no way to tell a thinking
 * agent from a dead socket.
 *
 * Two sources, because they answer different questions:
 *
 *  - `StreamingDeltaEvent` is live but approximate. It carries text, not a token count, and
 *    the store merges consecutive deltas into one growing event. Characters over four is
 *    the usual rule of thumb for English; code runs denser. It is labelled with a ~ for
 *    that reason.
 *  - The metrics store holds the server's own exact figures, but only updates when a call
 *    finishes, so it is the wrong thing to watch for liveness.
 *
 * What the metrics are NOT is the size of the current prompt. `accumulated_token_usage`
 * is the running total for the whole conversation -- a real one read 1,875,850 prompt
 * tokens against a `context_window` of 30,000 -- so showing them as a context gauge said
 * "context 1876k/30k", which is nonsense. Nothing in this payload gives the current
 * prompt size, so the strip reports what the numbers actually are: the conversation's
 * totals, and how much of the input came back from the prompt cache instead of being
 * read again.
 */
const CHARS_PER_TOKEN = 4;

export interface TurnActivity {
  running: boolean;
  /** Seconds since this turn started, or null when idle. */
  elapsed: number | null;
  /** Approximate tokens streamed so far this turn; null before anything arrives. */
  streamed: number | null;
  /** Exact conversation totals, accumulated over every call so far. */
  totalIn: number | null;
  totalOut: number | null;
  /** Share of input served from the prompt cache rather than read again, 0-1. */
  cachedShare: number | null;
}

export function streamedTokens(text: string): number {
  return Math.max(1, Math.round(text.length / CHARS_PER_TOKEN));
}

export function useTurnActivity(): TurnActivity {
  const status = useV1ConversationStateStore((s) => s.execution_status);
  const events = useEventStore((s) => s.events);
  const usage = useMetricsStore((s) => s.usage);

  const running = status === "running";

  // The clock has to tick on its own: no event arrives while the model reads the prompt.
  const startedAt = React.useRef<number | null>(null);
  const [, setNow] = React.useState(0);
  if (running && startedAt.current === null) startedAt.current = Date.now();
  if (!running && startedAt.current !== null) startedAt.current = null;

  React.useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const delta = React.useMemo(() => {
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      if (isV1Event(event) && isStreamingDeltaEvent(event)) {
        return (event.content ?? "") + (event.reasoning_content ?? "");
      }
      // Only the delta of the current turn counts: anything durable ends it.
      if (isV1Event(event) && isMessageEvent(event)) return null;
    }
    return null;
  }, [events]);

  return {
    running,
    elapsed:
      running && startedAt.current !== null
        ? Math.floor((Date.now() - startedAt.current) / 1000)
        : null,
    streamed: running && delta ? streamedTokens(delta) : null,
    totalIn: usage?.prompt_tokens ?? null,
    totalOut: usage?.completion_tokens ?? null,
    cachedShare:
      usage && usage.prompt_tokens > 0
        ? usage.cache_read_tokens / usage.prompt_tokens
        : null,
  };
}
