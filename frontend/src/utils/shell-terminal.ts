/**
 * Fork-only: the interactive shell behind the Terminal tab. The sandbox side is
 * llmkit_policy/terminal.py in the jentic kit: a websocket on the agent-server's own port,
 * at /sockets/llmkit-terminal, reached the same way as /sockets/events.
 */
import { extractBaseHost, extractPathPrefix } from "#/utils/websocket-url";

export const SHELL_SOCKET_PATH = "/sockets/llmkit-terminal";

/** What the phone's key row sends. The rest of a line is typed in the input box. */
export const SHELL_KEYS = {
  esc: "\x1b",
  tab: "\t",
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  left: "\x1b[D",
  interrupt: "\x03",
} as const;

export function buildShellSocketUrl(
  conversationUrl: string | null | undefined,
  { cwd, cols, rows }: { cwd?: string | null; cols: number; rows: number },
): string | null {
  if (!conversationUrl) return null;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({
    cols: String(cols),
    rows: String(rows),
  });
  if (cwd) params.set("cwd", cwd);
  const host = extractBaseHost(conversationUrl);
  const prefix = extractPathPrefix(conversationUrl);
  return `${protocol}//${host}${prefix}${SHELL_SOCKET_PATH}?${params}`;
}

const CTRL_PUNCTUATION: Record<string, string> = {
  "@": "\x00",
  " ": "\x00",
  "[": "\x1b",
  "\\": "\x1c",
  "]": "\x1d",
  "^": "\x1e",
  _: "\x1f",
  "?": "\x7f",
};

/** The character a key makes with Ctrl held: Ctrl+C is \x03. Anything else is sent as typed. */
export function withCtrl(key: string): string {
  if (key.length !== 1) return key;
  const lower = key.toLowerCase();
  if (lower >= "a" && lower <= "z") {
    return String.fromCharCode(lower.charCodeAt(0) - 96);
  }
  return CTRL_PUNCTUATION[key] ?? key;
}
