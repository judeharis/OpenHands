import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShellSocketUrl, withCtrl } from "#/utils/shell-terminal";

describe("buildShellSocketUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reaches the sandbox through the proxy, from a phone on the tailnet", () => {
    vi.stubGlobal("location", {
      protocol: "https:",
      host: "jude.example.ts.net",
      hostname: "jude.example.ts.net",
    });

    const url = buildShellSocketUrl(
      "http://localhost:40000/sb/33835/api/conversations/abc",
      { cwd: "/workspace/project", cols: 50, rows: 30 },
    );

    expect(url).toBe(
      "wss://jude.example.ts.net:40000/sb/33835/sockets/llmkit-terminal?cols=50&rows=30&cwd=%2Fworkspace%2Fproject",
    );
  });

  it("has no URL without a conversation URL", () => {
    expect(buildShellSocketUrl(null, { cols: 80, rows: 24 })).toBeNull();
  });
});

describe("withCtrl", () => {
  it.each([
    ["c", "\x03"],
    ["C", "\x03"],
    ["d", "\x04"],
    ["z", "\x1a"],
    ["[", "\x1b"],
    ["1", "1"],
    ["ab", "ab"],
  ])("Ctrl+%j sends %j", (key, sent) => {
    expect(withCtrl(key)).toBe(sent);
  });
});
