import React from "react";
import { useEventStore } from "#/stores/use-event-store";
import useMetricsStore from "#/stores/metrics-store";
import {
  conversationStats,
  duration,
  tokens,
} from "#/utils/conversation-stats";

// Fork-only copy; not in translation.json, which upstream keeps complete.
const TITLE = "Where this conversation's time and tokens went";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-[132px]">
      <div className="text-xs leading-4 text-[#A3A3A3]">{label}</div>
      <div className="text-2xl leading-8 tabular-nums">{value}</div>
      {sub && <div className="text-xs leading-4 text-[#A3A3A3]">{sub}</div>}
    </div>
  );
}

/**
 * One bar of a known total, labelled in text beside it.
 *
 * Two steps of one colour rather than two hues: this is a share of one quantity, not two
 * categories, and the numbers are written out so the colour is never the only thing saying
 * which is which.
 */
function Split({ model, tool }: { model: number; tool: number }) {
  const total = model + tool;
  if (total <= 0) return null;
  const modelShare = Math.round((model / total) * 100);
  return (
    <div>
      <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded">
        <div className="bg-[#5B8DEF]" style={{ width: `${modelShare}%` }} />
        <div className="bg-[#5B8DEF]/45" style={{ width: `${100 - modelShare}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-4 text-xs leading-4 text-[#A3A3A3]">
        <span>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[#5B8DEF] align-[-1px]" />
          waiting on the model <b className="text-white tabular-nums">{duration(model)}</b> ({modelShare}%)
        </span>
        <span>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[#5B8DEF]/45 align-[-1px]" />
          running tools <b className="text-white tabular-nums">{duration(tool)}</b> ({100 - modelShare}%)
        </span>
      </div>
    </div>
  );
}

export default function StatsTab() {
  const events = useEventStore((state) => state.events);
  const usage = useMetricsStore((state) => state.usage);
  const cost = useMetricsStore((state) => state.cost);

  const stats = React.useMemo(() => conversationStats(events), [events]);
  const cachedShare =
    usage && usage.prompt_tokens > 0
      ? Math.round((usage.cache_read_tokens / usage.prompt_tokens) * 100)
      : null;
  const longest = stats.byTool[0]?.seconds ?? 0;

  return (
    <main className="h-full overflow-y-auto custom-scrollbar-always p-4 flex flex-col gap-6">
      <p className="text-xs leading-4 text-[#A3A3A3]">{TITLE}</p>

      {stats.steps === 0 && !usage ? (
        <p className="text-sm text-[#A3A3A3]">
          Nothing measured yet. Numbers appear once the agent has taken a step.
        </p>
      ) : null}

      {usage && (
        <section className="flex flex-wrap gap-6" data-testid="stats-tokens">
          <Tile label="tokens in" value={tokens(usage.prompt_tokens)} sub="every call, summed" />
          <Tile label="tokens out" value={tokens(usage.completion_tokens)} />
          {cachedShare !== null && (
            <Tile
              label="served from cache"
              value={`${cachedShare}%`}
              sub={`${tokens(usage.cache_read_tokens)} not read again`}
            />
          )}
          {cost !== null && cost > 0 && <Tile label="cost" value={`$${cost.toFixed(2)}`} />}
        </section>
      )}

      {stats.steps > 0 && (
        <>
          <section className="flex flex-wrap gap-6" data-testid="stats-time">
            <Tile label="steps" value={String(stats.steps)} sub="action and result" />
            <Tile
              label="total"
              value={duration(stats.modelSeconds + stats.toolSeconds)}
              sub="from first step to last"
            />
            {stats.slowest && (
              <Tile
                label="slowest call"
                value={duration(stats.slowest.toolSeconds)}
                sub={stats.slowest.tool}
              />
            )}
          </section>

          <section data-testid="stats-split">
            <h2 className="mb-2 text-sm font-semibold">Time</h2>
            <Split model={stats.modelSeconds} tool={stats.toolSeconds} />
          </section>

          <section data-testid="stats-tools">
            <h2 className="mb-2 text-sm font-semibold">Tools, slowest first</h2>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-xs text-[#A3A3A3]">
                  <th className="text-left font-semibold">tool</th>
                  <th className="text-right font-semibold">calls</th>
                  <th className="text-right font-semibold">total</th>
                  <th className="text-right font-semibold">mean</th>
                  <th className="w-[28%]" />
                </tr>
              </thead>
              <tbody>
                {stats.byTool.map((row) => (
                  <tr key={row.tool}>
                    <td className="py-1 pr-2">{row.tool}</td>
                    <td className="py-1 pr-2 text-right">{row.calls}</td>
                    <td className="py-1 pr-2 text-right">{duration(row.seconds)}</td>
                    <td className="py-1 pr-2 text-right">{duration(row.seconds / row.calls)}</td>
                    <td className="py-1">
                      <div
                        className="h-2 rounded-[2px] bg-[#5B8DEF]"
                        style={{ width: `${longest > 0 ? Math.max(2, (row.seconds / longest) * 100) : 0}%` }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
