/* eslint-disable i18next/no-literal-string -- fork-only copy; not in translation.json, which upstream keeps complete */
/**
 * Fork-only: a real shell in the sandbox, for the person rather than the agent. The sandbox
 * keeps it running between connections and replays its recent output to whoever connects,
 * so leaving the tab or locking the phone loses nothing.
 *
 * On a phone, typing goes through an ordinary text box and a row of keys (Esc, Tab, Ctrl,
 * arrows, ^C), not into the terminal: xterm's hidden textarea and a phone keyboard's
 * autocorrect and composition do not get on. The box is a compose buffer -- Enter and every
 * key send what is in it first -- so Tab completion and history work as in a real terminal.
 */
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import React from "react";
import { useActiveConversation } from "#/hooks/query/use-active-conversation";
import { useSettings } from "#/hooks/query/use-settings";
import { useBreakpoint } from "#/hooks/use-breakpoint";
import { useConversationId } from "#/hooks/use-conversation-id";
import { getGitPath } from "#/utils/get-git-path";
import {
  buildShellSocketUrl,
  SHELL_KEYS,
  withCtrl,
} from "#/utils/shell-terminal";
import { attachTouchScroll } from "#/utils/terminal-touch-scroll";
import { cn } from "#/utils/utils";
import { WaitingForRuntimeMessage } from "../chat/waiting-for-runtime-message";

type Status = "connecting" | "open" | "reconnecting" | "exited";

const RECONNECT_MS = 1500;
// A phone keyboard covers well over this; browser chrome appearing and going does not.
const KEYBOARD_MIN_PX = 120;

const KEYS: { label: string; aria: string; send: string }[] = [
  { label: "Esc", aria: "Escape", send: SHELL_KEYS.esc },
  { label: "Tab", aria: "Tab", send: SHELL_KEYS.tab },
  { label: "↑", aria: "Up", send: SHELL_KEYS.up },
  { label: "↓", aria: "Down", send: SHELL_KEYS.down },
  { label: "←", aria: "Left", send: SHELL_KEYS.left },
  { label: "→", aria: "Right", send: SHELL_KEYS.right },
];

/**
 * The area the keyboard leaves visible, while it is open. Chrome on Android shrinks only
 * the visual viewport for the keyboard, so a box at the foot of a full-height sheet ends up
 * under it; the shell pins itself to this area instead, with the box just above the keys.
 */
function useKeyboardArea(active: boolean) {
  const [area, setArea] = React.useState<{
    top: number;
    height: number;
  } | null>(null);
  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) {
      setArea(null);
      return undefined;
    }
    const update = () => {
      const covered = window.innerHeight - viewport.height;
      setArea(
        covered > KEYBOARD_MIN_PX
          ? { top: viewport.offsetTop, height: viewport.height }
          : null,
      );
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);
  return area;
}

// Keeps the text box focused, and the keyboard up, when a key in the row is tapped.
const keepFocus = (event: React.SyntheticEvent) => event.preventDefault();

export function ShellTerminal() {
  const { conversationId } = useConversationId();
  const { data: conversation } = useActiveConversation();
  const { data: settings } = useSettings();
  const isPhone = useBreakpoint();
  const touch = React.useMemo(
    () => isPhone || !!window.matchMedia?.("(pointer: coarse)").matches,
    [isPhone],
  );

  const conversationUrl = conversation?.conversation_url;
  const sessionApiKey = conversation?.session_api_key;
  const running = conversation?.sandbox_status === "RUNNING";
  const grouping =
    settings?.sandbox_grouping_strategy !== undefined &&
    settings?.sandbox_grouping_strategy !== "NO_GROUPING";
  const cwd = getGitPath(
    conversationId,
    conversation?.selected_repository,
    grouping,
  );

  const hostRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const termRef = React.useRef<XTerm | null>(null);
  const socketRef = React.useRef<WebSocket | null>(null);
  const [status, setStatus] = React.useState<Status>("connecting");
  const [attempt, setAttempt] = React.useState(0);
  const [line, setLine] = React.useState("");
  const [ctrl, setCtrl] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const keyboardArea = useKeyboardArea(touch && typing);

  const send = React.useCallback((data: string) => {
    const socket = socketRef.current;
    if (data && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input", data }));
    }
  }, []);

  const sendSize = React.useCallback(() => {
    const term = termRef.current;
    const socket = socketRef.current;
    if (term && socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
      );
    }
  }, []);

  // The screen. Created once per mount; the connection below writes into it.
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !running) return undefined;
    const term = new XTerm({
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: touch ? 12 : 14,
      scrollback: 5000,
      cursorBlink: !touch,
      disableStdin: touch,
      theme: { background: "#25272D" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    if (touch && term.textarea) {
      // Tapping the screen must not raise a second keyboard for xterm's own textarea.
      term.textarea.setAttribute("inputmode", "none");
      term.textarea.readOnly = true;
    }
    const fitNow = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      try {
        fit.fit();
      } catch {
        return; // not laid out yet
      }
      sendSize();
    };
    termRef.current = term;
    fitNow();
    const observer = new ResizeObserver(() => requestAnimationFrame(fitNow));
    observer.observe(host);
    const typed = term.onData(send);
    // a full-screen program gets arrow keys for a drag, through the same socket as typing
    const detachTouch = attachTouchScroll(term, host, send);
    return () => {
      detachTouch();
      observer.disconnect();
      typed.dispose();
      term.dispose();
      termRef.current = null;
    };
  }, [running, touch, send, sendSize]);

  // The connection. A dropped socket reconnects; the sandbox replays what was missed.
  React.useEffect(() => {
    if (!running) return undefined;
    const term = termRef.current;
    const url = buildShellSocketUrl(conversationUrl, {
      cwd,
      cols: term?.cols ?? 80,
      rows: term?.rows ?? 24,
    });
    if (!url) return undefined;

    let leaving = false;
    let exited = false;
    let retry: number | undefined;
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;
    setStatus(attempt === 0 ? "connecting" : "reconnecting");

    socket.onopen = () => {
      socket.send(
        JSON.stringify({ type: "auth", session_api_key: sessionApiKey ?? "" }),
      );
      termRef.current?.reset(); // the replay redraws everything
      setStatus("open");
      sendSize();
    };
    socket.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") {
        termRef.current?.write(new Uint8Array(event.data as ArrayBuffer));
        return;
      }
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "exit") {
          exited = true;
          setStatus("exited");
          const code = message.code == null ? "" : ` with code ${message.code}`;
          termRef.current?.write(`\r\n\x1b[2m[shell exited${code}]\x1b[0m\r\n`);
        }
      } catch {
        // not a message this client knows
      }
    };
    socket.onclose = () => {
      if (socketRef.current === socket) socketRef.current = null;
      if (leaving || exited) return;
      setStatus("reconnecting");
      retry = window.setTimeout(() => setAttempt((n) => n + 1), RECONNECT_MS);
    };

    return () => {
      leaving = true;
      if (retry !== undefined) window.clearTimeout(retry);
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
    // touch: a new screen is made when it changes, and only a reconnect refills it
  }, [running, touch, conversationUrl, sessionApiKey, cwd, attempt, sendSize]);

  const sendLineThen = (sequence: string) => {
    send(line + sequence);
    setLine("");
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    if (ctrl && value.length === line.length + 1 && value.startsWith(line)) {
      sendLineThen(withCtrl(value.slice(-1)));
      setCtrl(false);
      return;
    }
    setLine(value);
  };

  if (!running) {
    return <WaitingForRuntimeMessage className="pt-16" />;
  }

  return (
    <div
      data-testid="shell-terminal"
      className={cn(
        "h-full flex flex-col bg-[#25272D]",
        keyboardArea && "fixed inset-x-0 z-50",
      )}
      style={
        keyboardArea
          ? { top: keyboardArea.top, height: keyboardArea.height }
          : undefined
      }
    >
      <div
        ref={hostRef}
        data-testid="shell-terminal-screen"
        className="flex-1 min-h-0 px-2 pt-2"
        onClick={touch ? () => inputRef.current?.focus() : undefined}
      />
      {status !== "open" && (
        <div
          data-testid="shell-terminal-status"
          className="flex items-center gap-3 px-3 py-1 text-xs text-neutral-400"
        >
          {status === "connecting" && "Connecting to the sandbox shell…"}
          {status === "reconnecting" && "Reconnecting…"}
          {status === "exited" && (
            <>
              The shell has exited.
              <button
                type="button"
                data-testid="shell-terminal-restart"
                className="rounded bg-neutral-700 px-3 py-1 text-white"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Start a new shell
              </button>
            </>
          )}
        </div>
      )}
      {touch && (
        <>
          <div
            data-testid="shell-terminal-keys"
            className="flex gap-1 px-2 pt-1"
          >
            {KEYS.map((key) => (
              <button
                key={key.aria}
                type="button"
                aria-label={key.aria}
                className="h-9 flex-1 rounded bg-neutral-700 text-sm text-white active:bg-neutral-500"
                onPointerDown={keepFocus}
                onMouseDown={keepFocus}
                onClick={() => sendLineThen(key.send)}
              >
                {key.label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Ctrl"
              aria-pressed={ctrl}
              className={cn(
                "h-9 flex-1 rounded text-sm",
                ctrl ? "bg-white text-black" : "bg-neutral-700 text-white",
              )}
              onPointerDown={keepFocus}
              onMouseDown={keepFocus}
              onClick={() => setCtrl((on) => !on)}
            >
              Ctrl
            </button>
            <button
              type="button"
              aria-label="Interrupt"
              className="h-9 flex-1 rounded bg-red-900 text-sm text-white active:bg-red-700"
              onPointerDown={keepFocus}
              onMouseDown={keepFocus}
              onClick={() => {
                send(SHELL_KEYS.interrupt);
                setLine("");
              }}
            >
              ^C
            </button>
          </div>
          <form
            className="flex gap-2 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              sendLineThen("\r");
            }}
          >
            <input
              ref={inputRef}
              data-testid="shell-terminal-input"
              aria-label="Shell input"
              value={line}
              onChange={onChange}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              placeholder={ctrl ? "Ctrl + a key…" : "Type a command"}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="send"
              className="min-w-0 flex-1 rounded bg-[#1b1c20] px-3 py-2 font-mono text-sm text-white outline-none"
            />
            <button
              type="submit"
              aria-label="Send"
              className="h-10 w-12 rounded bg-neutral-600 text-white"
              onPointerDown={keepFocus}
              onMouseDown={keepFocus}
            >
              ↵
            </button>
          </form>
        </>
      )}
    </div>
  );
}
