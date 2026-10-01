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
  hostsIn,
  networkEffect,
  irreversible,
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
    ...(raw?.auto !== undefined ? { auto: raw.auto as boolean } : {}),
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

describe("llmkit-policy auto mode helpers (as in test_core.py)", () => {
  it.each([
    ["curl https://example.com/x", ["example.com"]],
    ["curl localhost:3000/api", ["localhost"]],
    ["git clone git@github.com:x/y.git", ["github.com"]],
    ['curl -d \'{"user.name": 1}\' localhost', ["localhost"]],
    ["cat package.json App.jsx", []],
    ["python3 -m http.server", []],
    ["wget --header=x http://[::1]:8000/", ["[::1]"]],
  ])("hosts in %s", (cmd, hosts) => {
    expect(hostsIn(cmd)).toEqual(hosts);
  });

  it.each([
    ["git -C app push", "send"],
    ["cargo publish", "send"],
    ["echo hi | nc example.com 80", "send"],
    ["curl -T f.zip https://transfer.sh/f.zip", "send"],
    ["curl --json '{}' http://localhost:8000/", ""],
    ["aws s3 sync dist s3://bucket", "send"],
    ["curl -Z https://a.example/1 https://a.example/2", "flood"],
    ["seq 100 | xargs -I{} curl -s https://example.com/{}", "flood"],
    ["npm ci", "fetch"],
    ["npm view react version", "fetch"],
    ["uvx ruff check", "fetch"],
    ["yarn", "fetch"],
    ["yarn test", ""],
    ["curl -s localhost:5173 | head", ""],
  ])("network effect of %s", (cmd, effect) => {
    expect(networkEffect(cmd)[0]).toBe(effect);
  });

  it.each([
    ["rm -rf dist", false],
    ["rm -f *.log", false],
    ["rm -rf ./*", true],
    ["rm -rf /workspace", true],
    ["rm --recursive --force .", true],
    ["git checkout -- .", true],
    ["git checkout -b feature", false],
  ])("irreversible: %s", (cmd, hit) => {
    expect(!!irreversible(cmd)).toBe(hit);
  });

  it("marks downloads for the sandbox's budget", () => {
    const auto = defaultPolicyConfig({ auto: true });
    const term = (command: string) => ({
      tool_name: "terminal",
      action: { kind: "TerminalAction", command },
    });
    expect(classify(term("npm install"), auto).net).toBe("fetch");
    expect(classify(term("npm run build"), auto).net).toBe("");
  });
});
