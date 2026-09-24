import { describe, expect, it } from "vitest";
import { getCombinedMetrics } from "#/utils/conversation-metrics";
import type { V1RuntimeConversationInfo } from "#/api/conversation-service/v1-conversation-service.types";

const usage = (prompt: number, perTurn: number, contextWindow: number) => ({
  accumulated_cost: 0,
  max_budget_per_task: null,
  accumulated_token_usage: {
    prompt_tokens: prompt,
    completion_tokens: 10,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    context_window: contextWindow,
    per_turn_token: perTurn,
  },
});

const info = (usageToMetrics: Record<string, unknown>) =>
  ({
    stats: { usage_to_metrics: usageToMetrics },
  }) as unknown as V1RuntimeConversationInfo;

describe("getCombinedMetrics", () => {
  // Fork: measured on a live conversation -- agent 29,764 of 30,000, condenser idle.
  it("shows the agent's last turn, not an idle condenser's zero", () => {
    const combined = getCombinedMetrics(
      info({ agent: usage(460054, 29764, 30000), condenser: usage(0, 0, 0) }),
    );
    expect(combined.accumulated_token_usage?.per_turn_token).toBe(29764);
    expect(combined.accumulated_token_usage?.context_window).toBe(30000);
    expect(combined.accumulated_token_usage?.prompt_tokens).toBe(460054);
  });

  it("shows the agent's turn even after the condenser has run", () => {
    const combined = getCombinedMetrics(
      info({
        agent: usage(1000, 900, 30000),
        condenser: usage(5000, 4000, 30000),
      }),
    );
    expect(combined.accumulated_token_usage?.per_turn_token).toBe(900);
    expect(combined.accumulated_token_usage?.prompt_tokens).toBe(6000);
  });

  it("keeps the old behaviour when there is no agent entry", () => {
    const combined = getCombinedMetrics(info({ other: usage(10, 7, 100) }));
    expect(combined.accumulated_token_usage?.per_turn_token).toBe(7);
  });
});
