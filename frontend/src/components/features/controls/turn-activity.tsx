import React from "react";
import { useTurnActivity } from "#/hooks/use-turn-activity";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
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
