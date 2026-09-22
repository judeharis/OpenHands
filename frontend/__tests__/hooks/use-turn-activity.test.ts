import { describe, expect, it } from "vitest";
import { streamedTokens } from "#/hooks/use-turn-activity";
import { compact } from "#/components/features/controls/turn-activity";

describe("what the activity strip shows (jentic)", () => {
  it("estimates tokens from streamed text, never claiming zero while text is arriving", () => {
    // The delta carries characters, not tokens; four per token is the rule of thumb, and
    // anything that has arrived at all must read as at least one token.
    expect(streamedTokens("a")).toBe(1);
    expect(streamedTokens("x".repeat(400))).toBe(100);
  });

  it("keeps big numbers short enough for a phone", () => {
    expect(compact(940)).toBe("940");
    expect(compact(1500)).toBe("1.5k");
    expect(compact(24100)).toBe("24k");
    expect(compact(131072)).toBe("131k");
    // A real conversation reached 1,875,850 prompt tokens: "1876k" is not a number
    // anyone reads at a glance.
    expect(compact(1875850)).toBe("1.9M");
  });
});
