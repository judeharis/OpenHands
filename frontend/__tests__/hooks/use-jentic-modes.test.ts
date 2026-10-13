import { describe, expect, it } from "vitest";
import { modeSuffix } from "#/hooks/use-jentic-modes";

// The app reads this marker (jentic/sandbox-image/llmkit_policy/modes.py MARK).
describe("modeSuffix", () => {
  it("marks a chat and carries its instructions", () => {
    expect(modeSuffix("chat", "  Be brief. ")).toBe(
      "<jentic-mode>chat</jentic-mode>\nBe brief.",
    );
    expect(modeSuffix("chat")).toBe("<jentic-mode>chat</jentic-mode>");
  });

  it("marks a glue conversation, without instructions", () => {
    expect(modeSuffix("glue", "Be brief.")).toBe(
      "<jentic-mode>glue</jentic-mode>",
    );
  });

  it("never sends instructions with an agent conversation", () => {
    expect(modeSuffix("agent", "Be brief.")).toBe(
      "<jentic-mode>agent</jentic-mode>",
    );
  });
});
