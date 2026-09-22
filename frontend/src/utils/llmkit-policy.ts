/**
 * TypeScript port of local-llm-kit's llmkit_policy.core: what an OpenHands action
 * needs before it runs. The sandbox decides for real (LlmkitAnalyzer); the UI uses
 * this copy to colour the confirmation panel, suggest "allow for session" grants and
 * explain a deny. The two are kept in step by the shared vectors file
 * (__tests__/utils/llmkit-policy.vectors.json, copied from the kit).
 *
 * Verdicts: "auto" runs without a tap, "ask" waits for one, "deny" reaches outside
 * the workspace (the guard hook refuses it; show it red).
 */

export type Verdict = "auto" | "ask" | "deny";

export interface Decision {
  verdict: Verdict;
  reason: string;
  suggestedGrants: string[];
}

export interface PolicyConfig {
  allowTools: string[];
  allowView: boolean;
  allowCommands: string[];
  allowWritePrefixes: string[];
  grants: string[];
  workspace: string;
  projectDir: string;
}

export const DEFAULT_WORKSPACE = "/workspace";
export const DEFAULT_PROJECT_DIR = "/workspace/project";

export const DEFAULT_ALLOW_TOOLS = [
  "glob",
  "grep",
  "think",
  "task_tracker",
  "invoke_skill",
  "planning_file_editor",
  "browser_get_state",
  "browser_get_content",
  "browser_list_tabs",
  "finish",
];

export const DEFAULT_ALLOW_COMMANDS = [
  "ls(\\s|$)",
  "cat(\\s|$)",
  "head(\\s|$)",
  "tail(\\s|$)",
  "wc(\\s|$)",
  "pwd$",
  "which(\\s|$)",
  "echo(\\s|$)",
  "true$",
  "sleep [0-9.]+$",
  "find(\\s|$)",
  "tree(\\s|$)",
  "du(\\s|$)",
  "df(\\s|$)",
  "git (status|diff|log|show|branch|rev-parse|remote -v|ls-files)(\\s|$)",
  "npm (ls|view|--version|-v)(\\s|$)",
  "node (--version|-v)$",
  "python3? (--version|-V)$",
];

const FIND_UNSAFE = new Set([
  "-delete",
  "-exec",
  "-execdir",
  "-ok",
  "-okdir",
  "-fprint",
  "-fprintf",
  "-fls",
  "-fprint0",
]);
const SPLIT = /\s*(?:\|\||&&|(?<!\\);|\n|\||&)\s*/;
const SHELL_UNSAFE = ["`", "$(", "<(", ">(", ">", "<"];
const GRANT_FORMS = ["tool:", "kind:", "write:", "cmd:", "view:"];
const WRITE_COMMANDS = new Set([
  "create",
  "str_replace",
  "insert",
  "undo_edit",
]);

export function defaultPolicyConfig(
  overrides: Partial<PolicyConfig> = {},
): PolicyConfig {
  return {
    allowTools: [...DEFAULT_ALLOW_TOOLS],
    allowView: true,
    allowCommands: [...DEFAULT_ALLOW_COMMANDS],
    allowWritePrefixes: [],
    grants: [],
    workspace: DEFAULT_WORKSPACE,
    projectDir: DEFAULT_PROJECT_DIR,
    ...overrides,
  };
}

/** posixpath.normpath */
export function normPath(path: string): string {
  const absolute = path.startsWith("/");
  const out: string[] = [];
  path.split("/").forEach((part) => {
    if (part === "" || part === ".") return;
    if (part === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (!absolute) out.push("..");
      return;
    }
    out.push(part);
  });
  const joined = out.join("/");
  if (absolute) return `/${joined}`;
  return joined === "" ? "." : joined;
}

function resolvePath(path: string, projectDir: string): string {
  return normPath(path.startsWith("/") ? path : `${projectDir}/${path}`);
}

export function pathUnder(
  path: string,
  prefix: string,
  projectDir = DEFAULT_PROJECT_DIR,
): boolean {
  const p = resolvePath(path, projectDir);
  const q = normPath(prefix);
  return p === q || p.startsWith(`${q.replace(/\/+$/, "")}/`);
}

/** A small POSIX shlex.split: quotes and backslashes, throws on an open quote. */
export function shlexSplit(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inWord = false;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else cur += ch;
    } else if (quote === '"') {
      if (ch === '"') quote = null;
      else if (
        ch === "\\" &&
        i + 1 < text.length &&
        '"\\$`\n'.includes(text[i + 1])
      ) {
        i += 1;
        cur += text[i];
      } else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
    } else if (ch === "\\") {
      if (i + 1 >= text.length) throw new Error("No escaped character");
      i += 1;
      cur += text[i];
      inWord = true;
    } else if (/\s/.test(ch)) {
      if (inWord) {
        out.push(cur);
        cur = "";
        inWord = false;
      }
    } else {
      cur += ch;
      inWord = true;
    }
  }
  if (quote) throw new Error("No closing quotation");
  if (inWord) out.push(cur);
  return out;
}

export function commandAllowed(
  cmd: string,
  allow: string[] = DEFAULT_ALLOW_COMMANDS,
  workspace = DEFAULT_WORKSPACE,
  projectDir = DEFAULT_PROJECT_DIR,
  cmdGrants: string[] = [],
): [boolean, string] {
  if (!cmd?.trim()) return [false, "empty command"];
  const bad = SHELL_UNSAFE.find((op) => cmd.includes(op));
  if (bad) return [false, `shell operator '${bad}'`];
  const segments = cmd
    .trim()
    .split(SPLIT)
    .filter((s) => s.trim());
  if (segments.length === 0) return [false, "empty command"];
  for (let s = 0; s < segments.length; s += 1) {
    let argv: string[];
    try {
      argv = shlexSplit(segments[s]);
    } catch (e) {
      return [false, `unparseable: ${(e as Error).message}`];
    }
    if (argv.length === 0) return [false, "empty segment"];
    if (argv[0].includes("=")) return [false, "environment assignment"];
    for (let t = 0; t < argv.length; t += 1) {
      const tok = argv[t];
      if (tok.startsWith("~")) return [false, "outside workspace"];
      if (tok.startsWith("/") && !pathUnder(tok, workspace, projectDir))
        return [false, "outside workspace"];
    }
    if (argv[0] === "cd") {
      const target = argv.length > 1 ? argv[1] : projectDir;
      if (!pathUnder(target, workspace, projectDir))
        return [false, "outside workspace"];
    } else {
      if (argv[0] === "find" && argv.some((a) => FIND_UNSAFE.has(a)))
        return [false, "find with an action flag"];
      const joined = argv.join(" ");
      const granted = cmdGrants.some(
        (g) => joined === g || joined.startsWith(`${g} `),
      );
      if (
        !granted &&
        !allow.some((rx) => new RegExp(`^(?:${rx})`).test(joined))
      )
        return [false, `${argv[0]} is not on the allow-list`];
    }
  }
  return [true, "allow-listed"];
}

export function parseGrant(
  text: string,
  workspace = DEFAULT_WORKSPACE,
): string {
  const t = (text || "").trim();
  const form = GRANT_FORMS.find((f) => t.startsWith(f));
  if (!form)
    throw new Error(
      `grant must start with one of ${GRANT_FORMS.join(", ")}: ${JSON.stringify(t)}`,
    );
  const value = t.slice(form.length).trim();
  if (form === "view:") {
    if (value !== "*") throw new Error("the only view grant is view:*");
    return "view:*";
  }
  if (!value) throw new Error(`empty ${form} grant`);
  if (form === "write:") {
    if (!value.startsWith("/"))
      throw new Error("write: needs an absolute directory");
    const norm = normPath(value);
    if (!pathUnder(norm, workspace))
      throw new Error(`write: must stay under ${workspace}`);
    return `write:${norm.replace(/\/+$/, "")}/`;
  }
  if (form === "cmd:") {
    let words: string[];
    try {
      words = shlexSplit(value);
    } catch (e) {
      throw new Error(`cmd: grant is unparseable: ${(e as Error).message}`);
    }
    if (
      words.length === 0 ||
      words.some((w) => w.startsWith("/") || w.startsWith("~"))
    )
      throw new Error("cmd: takes a command name and options, not paths");
    return `cmd:${words.join(" ")}`;
  }
  if (/\s/.test(value)) throw new Error(`${form} takes a single name`);
  return form + value;
}

function splitGrants(grants: string[], workspace: string) {
  const out: Record<string, string[]> = {
    tool: [],
    kind: [],
    write: [],
    cmd: [],
    view: [],
  };
  grants.forEach((g) => {
    let parsed: string;
    try {
      parsed = parseGrant(g, workspace);
    } catch {
      return; // a malformed grant grants nothing
    }
    const idx = parsed.indexOf(":");
    out[parsed.slice(0, idx)].push(parsed.slice(idx + 1));
  });
  return out;
}

/** The JSON shape of an ActionEvent, as far as the policy reads it. */
export interface ActionLike {
  tool_name?: string | null;
  action?: {
    kind?: string;
    command?: string | null;
    path?: string | null;
    is_input?: boolean;
    [key: string]: unknown;
  } | null;
}

const isFileEditor = (tool: string, kind: string) =>
  tool === "file_editor" ||
  tool === "str_replace_editor" ||
  kind === "FileEditorAction" ||
  kind === "StrReplaceEditorAction";
const isTerminal = (tool: string, kind: string) =>
  tool === "terminal" ||
  kind === "TerminalAction" ||
  kind === "ExecuteBashAction";

export function suggestGrants(
  action: ActionLike,
  cfg: PolicyConfig = defaultPolicyConfig(),
): string[] {
  const tool = String(action.tool_name || "");
  const a = action.action || {};
  const kind = String(a.kind || "");
  const out: string[] = [];
  const path = typeof a.path === "string" ? a.path : "";
  if (isFileEditor(tool, kind) && path) {
    if (a.command === "view") return ["view:*"];
    const resolved = resolvePath(path, cfg.projectDir);
    const dir = resolved.slice(0, resolved.lastIndexOf("/")) || "/";
    out.push(`write:${dir.replace(/\/+$/, "")}/`);
    const proj = cfg.projectDir.replace(/\/+$/, "");
    if (dir !== proj && dir.startsWith(`${proj}/`)) {
      const top = `write:${proj}/${dir.slice(proj.length + 1).split("/")[0]}/`;
      if (!out.includes(top)) out.push(top);
    }
    const projGrant = `write:${proj}/`;
    if (!out.includes(projGrant)) out.push(projGrant);
    return out;
  }
  if (isTerminal(tool, kind)) {
    const command = String(a.command || "");
    const first =
      command
        .trim()
        .split(SPLIT)
        .find((s) => s.trim()) || "";
    let argv: string[];
    try {
      argv = shlexSplit(first);
    } catch {
      argv = first.split(/\s+/).filter(Boolean);
    }
    const words: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const w = argv[i];
      const plainWord = /^[A-Za-z][\w-]*$/.test(w);
      const commandName =
        words.length === 0 && /^[A-Za-z0-9_.@+][\w.@+-]*$/.test(w);
      if (!plainWord && !commandName) break;
      words.push(w);
      if (words.length === 2) break;
    }
    if (words.length > 0) {
      out.push(`cmd:${words.join(" ")}`);
      if (words.length > 1) out.push(`cmd:${words[0]}`);
    }
    return out;
  }
  if (tool) out.push(`tool:${tool}`);
  else if (kind) out.push(`kind:${kind}`);
  return out;
}

export function classify(
  action: ActionLike,
  cfg: PolicyConfig = defaultPolicyConfig(),
): Decision {
  const tool = String(action.tool_name || "");
  const a = action.action || {};
  const kind = String(a.kind || "");
  const grants = splitGrants(cfg.grants, cfg.workspace);
  const path = typeof a.path === "string" ? a.path : "";

  if (path && !pathUnder(path, cfg.workspace, cfg.projectDir)) {
    return {
      verdict: "deny",
      reason: `path outside ${cfg.workspace}: ${path}`,
      suggestedGrants: [],
    };
  }
  // The planner's editor is allow-listed as a whole: its tool refuses every path but
  // PLAN.md by itself; asking about a write it then refuses cost a tap for nothing.
  if (
    cfg.allowTools.includes(tool) ||
    grants.tool.includes(tool) ||
    grants.kind.includes(kind)
  ) {
    return {
      verdict: "auto",
      reason: `${tool || kind} is allow-listed`,
      suggestedGrants: [],
    };
  }
  if (isFileEditor(tool, kind)) {
    const command = String(a.command || "");
    if (command === "view") {
      if (cfg.allowView || grants.view.length > 0)
        return {
          verdict: "auto",
          reason: "read-only view",
          suggestedGrants: [],
        };
      return { verdict: "ask", reason: "view", suggestedGrants: ["view:*"] };
    }
    if (WRITE_COMMANDS.has(command) && path) {
      const prefixes = [...cfg.allowWritePrefixes, ...grants.write];
      const hit = prefixes.find((p) => pathUnder(path, p, cfg.projectDir));
      if (hit)
        return {
          verdict: "auto",
          reason: `write under ${hit}`,
          suggestedGrants: [],
        };
      return {
        verdict: "ask",
        reason: `${command} ${path}`,
        suggestedGrants: suggestGrants(action, cfg),
      };
    }
    return {
      verdict: "ask",
      reason: `${tool} ${command}`,
      suggestedGrants: suggestGrants(action, cfg),
    };
  }
  if (isTerminal(tool, kind)) {
    const command = String(a.command || "");
    if (a.is_input)
      return {
        verdict: "ask",
        reason: "input to a running command",
        suggestedGrants: [],
      };
    const [ok, reason] = commandAllowed(
      command,
      cfg.allowCommands,
      cfg.workspace,
      cfg.projectDir,
      grants.cmd,
    );
    if (ok) return { verdict: "auto", reason, suggestedGrants: [] };
    if (reason === "outside workspace")
      return {
        verdict: "deny",
        reason: `command reaches outside ${cfg.workspace}`,
        suggestedGrants: [],
      };
    return {
      verdict: "ask",
      reason,
      suggestedGrants: suggestGrants(action, cfg),
    };
  }
  return {
    verdict: "ask",
    reason: `${tool || kind} is not read-only`,
    suggestedGrants: suggestGrants(action, cfg),
  };
}
