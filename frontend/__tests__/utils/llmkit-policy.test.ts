import { describe, it, expect } from "vitest";
import vectors from "./llmkit-policy.vectors.json";
import {
  classify,
  commandAllowed,
  defaultPolicyConfig,
  parseGrant,
  suggestGrants,
  shlexSplit,
  normPath,
} from "#/utils/llmkit-policy";

type Vector = {
  name: string;
  action: Parameters<typeof classify>[0];
  verdict: string;
  suggested?: string[];
  config?: Record<string, unknown>;
};

const toConfig = (raw: Record<string, unknown> | undefined) =>
  defaultPolicyConfig({
    ...(raw?.grants ? { grants: raw.grants as string[] } : {}),
    ...(raw?.allow_view !== undefined
      ? { allowView: raw.allow_view as boolean }
      : {}),
    ...(raw?.allow_write_prefixes
      ? { allowWritePrefixes: raw.allow_write_prefixes as string[] }
      : {}),
  });

describe("llmkit-policy (port of llmkit_policy.core)", () => {
  it.each((vectors as Vector[]).map((v) => [v.name, v] as const))(
    "%s",
    (_name, v) => {
      const d = classify(v.action, toConfig(v.config));
      expect(d.verdict, d.reason).toBe(v.verdict);
      if (v.suggested) expect(d.suggestedGrants).toEqual(v.suggested);
    },
  );

  it("splits commands like shlex", () => {
    expect(shlexSplit("find . -name '*.jsx'")).toEqual([
      "find",
      ".",
      "-name",
      "*.jsx",
    ]);
    expect(shlexSplit('echo "a b" c')).toEqual(["echo", "a b", "c"]);
    expect(() => shlexSplit("cat 'open")).toThrow();
  });

  it("normalises paths like posixpath", () => {
    expect(normPath("/workspace/../etc/x")).toBe("/etc/x");
    expect(normPath("/workspace/project/t3//")).toBe("/workspace/project/t3");
    expect(normPath("src/./App.jsx")).toBe("src/App.jsx");
  });

  it("refuses the same commands as the sandbox", () => {
    expect(commandAllowed("ls; rm -rf .")[0]).toBe(false);
    expect(commandAllowed("FOO=1 ls")[1]).toBe("environment assignment");
    expect(commandAllowed("cat /etc/passwd")[1]).toBe("outside workspace");
    expect(commandAllowed("find . -exec rm {} \;")[1]).toBe(
      "find with an action flag",
    );
    expect(commandAllowed("cd src && ls")[0]).toBe(true);
  });

  it("normalises and rejects grants like the sandbox", () => {
    expect(parseGrant("write:/workspace/project/t3")).toBe(
      "write:/workspace/project/t3/",
    );
    expect(parseGrant("cmd:  npm   run ")).toBe("cmd:npm run");
    expect(() => parseGrant("write:/etc/")).toThrow();
    expect(() => parseGrant("cmd:/bin/sh")).toThrow();
    expect(() => parseGrant("banana")).toThrow();
  });

  it("suggests the same grants", () => {
    expect(
      suggestGrants({
        tool_name: "file_editor",
        action: {
          kind: "FileEditorAction",
          command: "create",
          path: "/workspace/project/t3/src/App.jsx",
        },
      }),
    ).toEqual([
      "write:/workspace/project/t3/src/",
      "write:/workspace/project/t3/",
      "write:/workspace/project/",
    ]);
    expect(
      suggestGrants({
        tool_name: "terminal",
        action: { kind: "TerminalAction", command: "ls > out.txt" },
      }),
    ).toEqual(["cmd:ls"]);
  });
});
