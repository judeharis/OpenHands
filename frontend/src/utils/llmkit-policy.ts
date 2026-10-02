/**
 * TypeScript port of jentic's llmkit_policy.core: what an OpenHands action
 * needs before it runs. The sandbox decides for real (LlmkitAnalyzer); the UI uses
 * this copy to colour the confirmation panel, suggest "allow for session" grants and
 * explain a deny. The two are kept in step by the shared vectors file
 * (__tests__/utils/llmkit-policy.vectors.json, copied from the kit).
 *
 * Verdicts: "auto" runs without a tap, "ask" waits for one, "deny" reaches outside
 * the workspace (the guard hook refuses it; show it red).
 *
 * Auto mode (cfg.auto) turns most "ask" into "auto"; only what reaches past the
 * sandbox still asks (see autoMode below). Its network budget and the browser's
 * current page are the analyzer's state and are not modelled here.
 */

export type Verdict = "auto" | "ask" | "deny";

export interface Decision {
  verdict: Verdict;
  reason: string;
  suggestedGrants: string[];
  /** auto mode: "fetch" (counted by the sandbox's budget) or "page" */
  net?: string;
}

export interface PolicyConfig {
  allowTools: string[];
  allowView: boolean;
  allowCommands: string[];
  allowWritePrefixes: string[];
  grants: string[];
  workspace: string;
  projectDir: string;
  auto: boolean;
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
  "grep(\\s|$)",
  "rg(\\s|$)",
  "ps(\\s|$)",
  "ss(\\s|$)",
  "netstat(\\s|$)",
  "find(\\s|$)",
  "tree(\\s|$)",
  "du(\\s|$)",
  "df(\\s|$)",
  "git (status|diff|log|show|branch|rev-parse|remote -v|ls-files)(\\s|$)",
  "npm (ls|view|--version|-v)(\\s|$)",
  "node (--version|-v)$",
  "python3? (--version|-V)$",
  "jentic-snapshot (list|show|diff)(\\s|$)",
  "jentic-share (list|stop)(\\s|$)",
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
// throwing output away is not writing
const NULL_REDIRECT = /\s*(?:[12]?>>?|&>)\s*\/dev\/null|\s*2>&1/g;
const SAFE_PATHS = new Set(["/dev/null", "/dev/stdout", "/dev/stderr"]);
const CURL_UNSAFE = new Set([
  "-o",
  "-O",
  "--output",
  "--remote-name",
  "-T",
  "-d",
  "-F",
  "--form",
  "-X",
  "--request",
  "-K",
  "--config",
]);
const SHELL_UNSAFE = ["`", "$(", "<(", ">(", ">", "<"];
const GRANT_FORMS = ["tool:", "kind:", "write:", "cmd:", "view:"];
// ps options that take a value: that value is not a cluster of BSD flags
const PS_VALUE_OPTIONS = new Set([
  "-o",
  "-O",
  "-p",
  "-q",
  "-u",
  "-U",
  "-g",
  "-G",
  "-t",
  "-C",
  "-s",
  "-k",
  "o",
  "O",
  "p",
  "U",
  "t",
  "--pid",
  "--ppid",
  "--sort",
  "--format",
  "--user",
  "--group",
  "--cols",
  "--rows",
  "--width",
]);

/** The token, and the path an option carries in it: --file=/x, -f/x. */
function pathCandidates(tok: string): string[] {
  const out = [tok];
  if (tok.startsWith("-")) {
    if (tok.includes("=")) out.push(tok.slice(tok.indexOf("=") + 1));
    else if (!tok.startsWith("--") && tok.length > 2) out.push(tok.slice(2));
  }
  return out;
}

/** ps's BSD `e` flag (ps e, ps auxe, ps eww) prints every process's environment. */
function psShowsEnvironment(args: string[]): boolean {
  return args.some(
    (tok, i) =>
      !(i > 0 && PS_VALUE_OPTIONS.has(args[i - 1])) &&
      /^[A-Za-z]+$/.test(tok) &&
      tok.includes("e"),
  );
}
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
    auto: false,
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
  const cleaned = cmd.replace(NULL_REDIRECT, "");
  const bad = SHELL_UNSAFE.find((op) => cleaned.includes(op));
  if (bad) return [false, `shell operator '${bad}'`];
  const segments = cleaned
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
      const candidates = pathCandidates(argv[t]);
      for (let c = 0; c < candidates.length; c += 1) {
        const cand = candidates[c];
        if (cand.startsWith("~")) return [false, "outside workspace"];
        if (cand.startsWith("/")) {
          if (!SAFE_PATHS.has(cand) && !pathUnder(cand, workspace, projectDir))
            return [false, "outside workspace"];
        } else if (cand.split("/").includes("..")) {
          // judged from the project dir, but the shell may be anywhere under the
          // workspace: `..` is never automatic (see llmkit_policy/core.py)
          if (!pathUnder(cand, workspace, projectDir))
            return [false, "outside workspace"];
          return [false, "relative path with .."];
        } else if (cand.startsWith("$")) {
          return [false, "variable in an argument"];
        }
      }
    }
    if (argv[0] === "cd") {
      // a bare cd goes to $HOME
      if (argv.length === 1 || !pathUnder(argv[1], workspace, projectDir))
        return [false, "outside workspace"];
    } else if (argv[0] === "ps" && psShowsEnvironment(argv.slice(1))) {
      return [false, "ps showing process environments"];
    } else {
      if (argv[0] === "find" && argv.some((a) => FIND_UNSAFE.has(a)))
        return [false, "find with an action flag"];
      if (argv[0] === "curl") {
        const rest = argv.filter(
          (t, i) =>
            !(
              (t === "-o" || t === "--output") &&
              argv[i + 1] === "/dev/null"
            ) &&
            !(
              i > 0 &&
              (argv[i - 1] === "-o" || argv[i - 1] === "--output") &&
              t === "/dev/null"
            ),
        );
        if (
          rest.some(
            (t) =>
              CURL_UNSAFE.has(t) ||
              t.startsWith("--data") ||
              t.startsWith("--upload"),
          )
        )
          return [false, "curl that sends or saves"];
        const urls = argv.filter((t) => /^https?:\/\//.test(t));
        if (
          urls.length === 0 ||
          !urls.every((u) =>
            /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(u),
          )
        )
          return [false, "curl beyond this sandbox"];
        // eslint-disable-next-line no-continue
        continue;
      }
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
  if (form === "tool:" && value.endsWith("*") && !/^[\w-]+\*$/.test(value))
    throw new Error("a tool: wildcard is <prefix>*");
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
  if (tool.startsWith("browser_")) out.push("tool:browser_*");
  if (tool) out.push(`tool:${tool}`);
  else if (kind) out.push(`kind:${kind}`);
  return out;
}

function classifyStrict(action: ActionLike, cfg: PolicyConfig): Decision {
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
  const toolGranted = grants.tool.some(
    (g) => tool === g || (g.endsWith("*") && tool.startsWith(g.slice(0, -1))),
  );
  if (
    cfg.allowTools.includes(tool) ||
    toolGranted ||
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

// ---------------------------------------------------------------- auto mode
// A port of llmkit_policy.core's auto mode; tests/vectors.json holds both to it.

// "Local" is this sandbox and the desktop it runs on (the docker bridge). The LAN
// and the tailnet are other people's machines: off the box.
const LOCAL_HOST =
  /^(localhost|127(\.\d+){3}|0\.0\.0\.0|\[?::1\]?|host\.docker\.internal|172\.(1[6-9]|2\d|3[01])(\.\d+){2})$/i;
const SCHEME_URL = /[a-z][a-z0-9+.-]*:\/\/[^\s'"<>|;&)]+/gi;
const BARE_HOST =
  /^(?:([\w.+-]+@)?(localhost|(\d+\.){3}\d+|[\w-]+(\.[\w-]+)*\.[a-z]{2,})(:\d+)?([/:]\S*)?)$/i;
const FILEISH =
  /\.(js|jsx|ts|tsx|mjs|cjs|py|json|md|txt|html|css|scss|sh|yml|yaml|toml|lock|log|cfg|ini|conf|xml|csv|png|jpe?g|gif|svg|webp|wav|mp3|mp4|pdf|zip|gz|tgz|tar|whl|so|c|h|cpp|rs|go|java|rb|php|vue|svelte|env|map|pyc|server|tmpl|example|sample|bak|old|orig)$/i;
// a command word starts the command or follows a separator
const B = "(?:^|(?<=[\\s;&|(`'\"]))";
const GIT_OPTS = "(?:-[Cc]\\s+\\S+\\s+|--?[\\w-]+(?:=\\S+)?\\s+)*";

const SEND: Array<[string, string]> = [
  [`${B}git\\s+${GIT_OPTS}(push|send-email|request-pull)\\b`, "git push"],
  [
    `${B}(npm|pnpm|yarn|bun)\\s+(publish|unpublish|deprecate|adduser|login|owner|dist-tag|access|team|token|hook)\\b`,
    "publishes a package",
  ],
  [
    `${B}(twine\\s+upload|cargo\\s+(publish|yank|owner|login)|poetry\\s+publish|uv\\s+publish|flit\\s+publish|hatch\\s+publish|gem\\s+(push|yank)|python3?\\s+setup\\.py\\s+\\S*\\s*(upload|register)|dotnet\\s+nuget\\s+push|mvn\\s+\\S*\\s*deploy|\\S*gradlew?\\s+\\S*publish)\\b`,
    "publishes a package",
  ],
  [
    `${B}gh\\s+(\\S+\\s+)?(create|edit|merge|close|reopen|comment|delete|upload|review|ready|fork|sync|archive|rename|transfer|set|add|remove|lock|unlock|cancel|rerun|run|enable|disable|login)\\b`,
    "writes to GitHub",
  ],
  [
    `${B}gh\\s+api\\b.*\\s(-X|--method|-f|-F|--field|--raw-field|--input)\\b`,
    "writes to GitHub",
  ],
  [
    `${B}(ssh|sshpass|scp|sftp|ftp|lftp|telnet|nc|ncat|netcat|socat|sendmail|mail|mailx|mutt|swaks)(\\s|$)`,
    "talks to another machine",
  ],
  [
    `${B}rsync\\b[^;&|\\n]*(\\s[\\w.@-]+:|::|rsync://)`,
    "copies to another machine",
  ],
  [
    `${B}(docker|podman)\\s+(push|login)\\b|${B}skopeo\\s+copy\\b`,
    "pushes an image",
  ],
  [
    `${B}(aws\\s+s3\\s+(cp|mv|sync|rm|rb|mb)|aws\\s+\\S+\\s+(put|create|delete|update|upload|send|publish)[\\w-]*|gsutil\\s+(cp|mv|rsync|rm)|gcloud\\s+.*\\b(deploy|create|delete|update)|az\\s+\\S+\\s+.*\\b(create|delete|upload|deploy)|rclone\\s+(copy|sync|move|delete|purge|copyto|moveto)` +
      `|vercel|netlify\\s+deploy|firebase\\s+deploy|flyctl|fly\\s+deploy|wrangler\\s+(publish|deploy)|surge|heroku|kubectl\\s+(apply|create|delete|patch|replace)|terraform\\s+(apply|destroy)|pulumi\\s+up|ansible(-playbook)?` +
      `|huggingface-cli\\s+upload|hf\\s+upload)(\\s|$)`,
    "deploys or uploads",
  ],
];
// Sending only counts when it goes off the box: a POST to the dev server is testing.
const SEND_IF_REMOTE: Array<[string, string]> = [
  [
    `${B}curl\\b[^;&|\\n]*\\s(-d|--data[\\w-]*|-F|--form[\\w-]*|-T|--upload-file|--json|-X\\s*(POST|PUT|PATCH|DELETE)|--request\\s+(POST|PUT|PATCH|DELETE))(\\s|=|$)`,
    "curl sends data",
  ],
  [
    `${B}wget\\b[^;&|\\n]*\\s--(post-data|post-file|body-data|body-file|method)\\b`,
    "wget sends data",
  ],
  [`${B}(http|https|xh|xhs)\\s+(POST|PUT|PATCH|DELETE)\\b`, "sends data"],
  [
    `\\b(requests|httpx|aiohttp|session)\\.(post|put|patch|delete)\\(|urlopen\\([^)]*data=|method=['"](POST|PUT|PATCH|DELETE)`,
    "sends data",
  ],
];
// Downloads from off the box: allowed, and counted against the sandbox's budget.
const FETCH: string[] = [
  `${B}(aria2c|yt-dlp|youtube-dl)\\b`,
  `${B}git\\s+${GIT_OPTS}(clone|fetch|pull|ls-remote|submodule\\s+update|lfs\\s+(pull|fetch))\\b`,
  `${B}(pip3?|python3?\\s+-m\\s+pip)\\s+(install|download)\\b`,
  `${B}uv\\s+(pip\\s+install|add|sync|lock|tool\\s+install|run\\s+.*--with)\\b|${B}(uvx|pipx)(\\s|$)`,
  `${B}(npm|pnpm|yarn)\\s+(view|info|show|outdated|search|audit)(\\s|$)|${B}pip3?\\s+index\\b`,
  `${B}(npm|pnpm)\\s+(install|i|ci|add|update|upgrade|up|exec|create|dlx)(\\s|$)|${B}(npx|bunx|pnpx)\\s`,
  `${B}yarn(\\s*$|\\s*[;&|]|\\s+(install|add|dlx|upgrade|up)\\b)`,
  `${B}bun\\s+(install|i|add|x|create)(\\s|$)`,
  `${B}(cargo\\s+(install|fetch|update|add)|go\\s+(get|install|mod\\s+download)|gem\\s+install|composer\\s+(install|require|update)|poetry\\s+(install|add|update|lock)|(conda|mamba|micromamba)\\s+(install|create|update)|apt(-get)?\\s+(install|update|upgrade)|apk\\s+add|playwright\\s+install|(huggingface-cli|hf)\\s+download|(docker|podman)\\s+pull)\\b`,
];
// Many requests at once, or a request that never stops.
const FLOOD: Array<[string, string]> = [
  [
    `${B}wget\\b[^;&|\\n]*\\s(-r|--recursive|-m|--mirror|-l\\s*\\d+|--level)\\b`,
    "mirrors a site",
  ],
  [`${B}curl\\b[^;&|\\n]*\\s(-Z|--parallel)\\b`, "parallel downloads"],
  [
    `${B}(httrack|nmap|masscan|zmap|hping3?|nikto|sqlmap|gobuster|ffuf|dirb|wfuzz|dirsearch)(\\s|$)`,
    "scans hosts",
  ],
];
const LOAD_TOOLS = new RegExp(
  `${B}(ab|wrk|hey|siege|vegeta|locust|k6|artillery|autocannon|bombardier)\\s`,
  "m",
);
const LOOP = new RegExp(`${B}(for|while|until|xargs|parallel|watch|seq)\\b`);
const PING_FOREVER = new RegExp(`${B}ping\\b(?![^;&|\\n]*\\s-c\\s*\\d)`);
const CURL_OR_WGET = new RegExp(`${B}(curl|wget)\\b`, "m");
// Local damage that cannot be undone from inside the sandbox.
const IRREVERSIBLE: Array<[string, string]> = [
  [
    `${B}git\\s+(reset\\s+(\\S+\\s+)*--hard|clean\\s+(\\S+\\s+)*-\\w*f|checkout\\s+(--\\s+)?\\.(\\s|$)|restore\\s+(--\\S+\\s+)*\\.(\\s|$)|stash\\s+(drop|clear)|branch\\s+-D|reflog\\s+expire|filter-branch|filter-repo|update-ref\\s+-d)`,
    "discards git history or work",
  ],
];
const BROWSER_PAGE_TOOLS = new Set([
  "browser_click",
  "browser_type",
  "browser_set_storage",
  "browser_scroll",
]);
const SEND_TOOL =
  /(^|_)(send|post|push|publish|upload|create|update|delete|comment|merge|reply|share|tweet|email|deploy)(_|$)/i;
const FETCH_TOOL =
  /(^searxng_|url_read|(^|_)fetch(_|$)|web_search|(^|_)download(_|$))/i;

const searchIM = (rx: string, text: string) => new RegExp(rx, "im").test(text);

function hostOf(url: string): string {
  let u = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  if (u.split("/")[0].includes("@")) u = u.slice(u.lastIndexOf("@") + 1);
  [u] = u.split("/");
  if (u.startsWith("[")) return `${u.split("]")[0]}]`;
  return u.split(":")[0];
}

/** Every host a command names (see hosts_in in core.py). */
export function hostsIn(text: string): string[] {
  const t = text || "";
  const out = Array.from(t.matchAll(SCHEME_URL), (m) => hostOf(m[0]));
  let toks: string[];
  try {
    toks = shlexSplit(t);
  } catch {
    toks = t.split(/\s+/).filter(Boolean);
  }
  toks.forEach((raw) => {
    let tok = raw;
    if (tok.startsWith("-") && tok.includes("="))
      tok = tok.slice(tok.indexOf("=") + 1);
    if (tok.includes("://") || !BARE_HOST.test(tok)) return;
    const h = hostOf(tok);
    if (!FILEISH.test(h)) out.push(h);
  });
  return out;
}

export const isLocalHost = (host: string) => LOCAL_HOST.test(host || "");
export const offBox = (text: string) =>
  hostsIn(text).some((h) => !isLocalHost(h));

/** [effect, what]: effect is "send", "flood", "fetch" or "". */
export function networkEffect(command: string): [string, string] {
  const cmd = command || "";
  const send = SEND.find(([rx]) => searchIM(rx, cmd));
  if (send) return ["send", send[1]];
  const remote = SEND_IF_REMOTE.find(([rx]) => searchIM(rx, cmd));
  if (remote && (offBox(cmd) || hostsIn(cmd).length === 0))
    return ["send", remote[1]];
  const flood = FLOOD.find(([rx]) => searchIM(rx, cmd));
  if (flood) return ["flood", flood[1]];
  if (LOAD_TOOLS.test(cmd) && offBox(cmd))
    return ["flood", "load-tests a remote host"];
  if (PING_FOREVER.test(cmd) && offBox(cmd))
    return ["flood", "pings without a count"];
  let fetch = FETCH.some((rx) => searchIM(rx, cmd));
  if (!fetch && CURL_OR_WGET.test(cmd))
    fetch = offBox(cmd) || hostsIn(cmd).length === 0;
  if (fetch && LOOP.test(cmd)) return ["flood", "fetches in a loop"];
  return fetch ? ["fetch", "downloads"] : ["", ""];
}

function splitArgv(seg: string): string[] {
  try {
    return shlexSplit(seg);
  } catch {
    return seg.split(/\s+/).filter(Boolean);
  }
}

/** What irreversible local damage a command does, or "". */
export function irreversible(
  command: string,
  projectDir = DEFAULT_PROJECT_DIR,
): string {
  const cmd = command || "";
  const hit = IRREVERSIBLE.find(([rx]) => searchIM(rx, cmd));
  if (hit) return hit[1];
  const segments = cmd.trim().split(SPLIT);
  for (let s = 0; s < segments.length; s += 1) {
    const argv = splitArgv(segments[s]);
    // eslint-disable-next-line no-continue
    if (argv.length === 0 || argv[0] !== "rm") continue;
    const flags = argv
      .slice(1)
      .filter((t) => t.startsWith("-") && !t.startsWith("--"))
      .map((t) => t.slice(1))
      .join("");
    const recursive =
      flags.toLowerCase().includes("r") || argv.includes("--recursive");
    // eslint-disable-next-line no-continue
    if (!recursive) continue;
    const targets = argv.slice(1).filter((t) => !t.startsWith("-"));
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i];
      if (["*", ".*", "./*", "~", "/"].includes(t) || t.startsWith("~"))
        return "deletes the whole project";
      const target = resolvePath(
        t.replace(/\*+$/, "").replace(/\/+$/, "") || ".",
        projectDir,
      );
      const base = target.split("/").pop();
      if (base === ".git") return "deletes git history";
      if (pathUnder(projectDir, target)) return "deletes the whole project";
    }
  }
  return "";
}

function absPaths(cmd: string): string[] {
  return Array.from(
    (cmd || "").matchAll(/(?:^|(?<=[\s=<>'"(]))(~?\/[^\s'"<>|;&)]*)/g),
    (m) => m[1],
  );
}

function autoMode(
  action: ActionLike,
  cfg: PolicyConfig,
  d: Decision,
): Decision {
  const tool = String(action.tool_name || "");
  const a = action.action || {};
  const kind = String(a.kind || "");
  const terminal = isTerminal(tool, kind);
  const cmd = terminal ? String(a.command || "") : "";

  let net = "";
  if (terminal) {
    const [effect, what] = networkEffect(cmd);
    if ((effect === "send" || effect === "flood") && d.verdict !== "deny")
      return {
        verdict: "ask",
        reason: `auto mode still asks: ${what}`,
        suggestedGrants: d.verdict === "ask" ? d.suggestedGrants : [],
      };
    net = effect === "fetch" ? "fetch" : "";
  } else if (tool === "browser_navigate") {
    net = offBox(String((a as { url?: string }).url || "")) ? "fetch" : "";
  } else if (BROWSER_PAGE_TOOLS.has(tool)) {
    net = "page";
  } else if (FETCH_TOOL.test(tool)) {
    net = "fetch";
  }

  if (d.verdict !== "ask") return { ...d, net };
  const ask = (why: string): Decision => ({
    verdict: "ask",
    reason: `auto mode still asks: ${why}`,
    suggestedGrants: d.suggestedGrants,
  });
  const run = (why: string): Decision => ({
    verdict: "auto",
    reason: `auto mode: ${why}`,
    suggestedGrants: [],
    net,
  });

  if (terminal) {
    if (a.is_input) return run("input to a running command");
    if (d.reason === "ps showing process environments") return ask(d.reason);
    const what = irreversible(cmd, cfg.projectDir);
    if (what) return ask(what);
    const paths = absPaths(cmd);
    for (let i = 0; i < paths.length; i += 1) {
      const p = paths[i];
      if (p.startsWith("~")) return ask("a path outside the workspace");
      // eslint-disable-next-line no-continue
      if (SAFE_PATHS.has(p) || p.startsWith("/dev/fd/")) continue;
      if (!pathUnder(p, cfg.workspace, cfg.projectDir))
        return ask(`a path outside the workspace: ${p}`);
      if (!pathUnder(p, cfg.projectDir, cfg.projectDir))
        return ask(`a path outside the project: ${p}`);
    }
    const segments = cmd.trim().split(SPLIT);
    for (let s = 0; s < segments.length; s += 1) {
      const argv = splitArgv(segments[s]);
      for (let t = 0; t < argv.length; t += 1) {
        const outside = pathCandidates(argv[t]).find(
          (cand) =>
            cand.split("/").includes("..") &&
            !cand.startsWith("/") &&
            !pathUnder(cand, cfg.projectDir, cfg.projectDir),
        );
        if (outside) return ask(`a path outside the project: ${outside}`);
      }
    }
    return run("stays in the sandbox");
  }
  if (isFileEditor(tool, kind)) {
    const path = typeof a.path === "string" ? a.path : "";
    if (path && pathUnder(path, cfg.projectDir, cfg.projectDir))
      return run("a write in the project");
    return ask(`a write outside ${cfg.projectDir}`);
  }
  if (SEND_TOOL.test(tool) && !tool.startsWith("media_"))
    return ask(`${tool} may send something off the box`);
  return run(tool || kind);
}

export function classify(
  action: ActionLike,
  cfg: PolicyConfig = defaultPolicyConfig(),
): Decision {
  const d = classifyStrict(action, cfg);
  return cfg.auto ? autoMode(action, cfg, d) : d;
}
