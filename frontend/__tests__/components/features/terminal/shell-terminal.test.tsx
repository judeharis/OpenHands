import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- the terminal screen and the sandbox, faked

const term = vi.hoisted(() => ({
  cols: 50,
  rows: 20,
  open: vi.fn(),
  write: vi.fn(),
  reset: vi.fn(),
  dispose: vi.fn(),
  loadAddon: vi.fn(),
  onDataCallback: null as null | ((d: string) => void),
  onData: vi.fn(),
  textarea: null as HTMLTextAreaElement | null,
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(function FakeTerminal() {
    term.textarea = document.createElement("textarea");
    term.onData.mockImplementation((cb: (d: string) => void) => {
      term.onDataCallback = cb;
      return { dispose: vi.fn() };
    });
    return term;
  }),
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(function FakeFit() {
    return { fit: vi.fn() };
  }),
}));

const state = vi.hoisted(() => ({
  phone: true,
  sandbox: "RUNNING" as string,
}));
vi.mock("#/hooks/use-breakpoint", () => ({ useBreakpoint: () => state.phone }));
vi.mock("#/hooks/use-conversation-id", () => ({
  useConversationId: () => ({ conversationId: "c1" }),
}));
vi.mock("#/hooks/query/use-settings", () => ({
  useSettings: () => ({ data: {} }),
}));
vi.mock("#/hooks/query/use-active-conversation", () => ({
  useActiveConversation: () => ({
    data: {
      conversation_url: "http://localhost:40000/sb/1/api/conversations/c1",
      session_api_key: "key-1",
      sandbox_status: state.sandbox,
      selected_repository: null,
    },
  }),
}));
vi.mock("react-i18next", async () => ({
  ...(await vi.importActual<object>("react-i18next")),
  useTranslation: () => ({ t: (key: string) => key }),
}));

class FakeSocket {
  static OPEN = 1;

  static all: FakeSocket[] = [];

  readyState = 0;

  binaryType = "blob";

  sent: string[] = [];

  onopen: (() => void) | null = null;

  onmessage: ((e: { data: unknown }) => void) | null = null;

  onclose: (() => void) | null = null;

  constructor(public url: string) {
    FakeSocket.all.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    act(() => this.onopen?.());
  }

  inputs() {
    return this.sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.type === "input")
      .map((m) => m.data);
  }
}

import { ShellTerminal } from "#/components/features/terminal/shell-terminal";

const socket = () => FakeSocket.all[FakeSocket.all.length - 1];
const box = () =>
  screen.getByTestId("shell-terminal-input") as HTMLInputElement;
const typeLine = (text: string) =>
  fireEvent.change(box(), { target: { value: text } });

describe("ShellTerminal", () => {
  beforeEach(() => {
    FakeSocket.all = [];
    state.phone = true;
    state.sandbox = "RUNNING";
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn().mockImplementation(function FakeObserver() {
        return { observe: vi.fn(), disconnect: vi.fn() };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("authenticates first, then sends its size", () => {
    render(<ShellTerminal />);
    expect(socket().url).toContain(
      "/sb/1/sockets/llmkit-terminal?cols=50&rows=20",
    );
    expect(socket().url).not.toContain("key-1"); // the key never goes in a URL
    socket().open();
    const [first, second] = socket().sent.map((s) => JSON.parse(s));
    expect(first).toEqual({ type: "auth", session_api_key: "key-1" });
    expect(second).toEqual({ type: "resize", cols: 50, rows: 20 });
  });

  it("sends a typed line with Enter and empties the box", () => {
    render(<ShellTerminal />);
    socket().open();
    typeLine("ls -la");
    fireEvent.submit(box().form!);
    expect(socket().inputs()).toEqual(["ls -la\r"]);
    expect(box().value).toBe("");
  });

  it("sends what is in the box before a key, so Tab completes it", () => {
    render(<ShellTerminal />);
    socket().open();
    typeLine("cd pro");
    fireEvent.click(screen.getByRole("button", { name: "Tab" }));
    fireEvent.click(screen.getByRole("button", { name: "Up" }));
    expect(socket().inputs()).toEqual(["cd pro\t", "\x1b[A"]);
  });

  it("turns the next letter into a control character with Ctrl", () => {
    render(<ShellTerminal />);
    socket().open();
    const ctrl = screen.getByRole("button", { name: "Ctrl" });
    fireEvent.click(ctrl);
    expect(ctrl).toHaveAttribute("aria-pressed", "true");
    typeLine("r");
    expect(socket().inputs()).toEqual(["\x12"]);
    expect(box().value).toBe("");
    expect(ctrl).toHaveAttribute("aria-pressed", "false");
  });

  it("interrupts with ^C and drops the unsent line", () => {
    render(<ShellTerminal />);
    socket().open();
    typeLine("half a comm");
    fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));
    expect(socket().inputs()).toEqual(["\x03"]);
    expect(box().value).toBe("");
  });

  it("writes the sandbox's output to the screen as bytes", () => {
    render(<ShellTerminal />);
    socket().open();
    const bytes = new TextEncoder().encode("hello\r\n");
    act(() => socket().onmessage?.({ data: bytes.buffer }));
    expect(term.write).toHaveBeenCalledWith(new Uint8Array(bytes));
  });

  it("says when the shell exits, and starts a new one on request", () => {
    render(<ShellTerminal />);
    socket().open();
    act(() =>
      socket().onmessage?.({ data: JSON.stringify({ type: "exit", code: 0 }) }),
    );
    act(() => socket().onclose?.());
    expect(screen.getByTestId("shell-terminal-status")).toHaveTextContent(
      "The shell has exited.",
    );
    expect(FakeSocket.all).toHaveLength(1); // no reconnect loop after an exit
    fireEvent.click(screen.getByTestId("shell-terminal-restart"));
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("reconnects when the connection drops, and redraws from the replay", () => {
    vi.useFakeTimers();
    render(<ShellTerminal />);
    socket().open();
    act(() => socket().onclose?.()); // the phone locked
    expect(screen.getByTestId("shell-terminal-status")).toHaveTextContent(
      "Reconnecting",
    );
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(FakeSocket.all).toHaveLength(2);
    term.reset.mockClear();
    socket().open();
    expect(term.reset).toHaveBeenCalled();
  });

  it("on a desktop, types straight into the terminal and shows no key row", () => {
    state.phone = false;
    render(<ShellTerminal />);
    socket().open();
    expect(screen.queryByTestId("shell-terminal-keys")).not.toBeInTheDocument();
    act(() => term.onDataCallback?.("q"));
    expect(socket().inputs()).toEqual(["q"]);
  });

  it("waits for the sandbox rather than connecting to nothing", () => {
    state.sandbox = "STARTING";
    render(<ShellTerminal />);
    expect(
      screen.getByText("DIFF_VIEWER$WAITING_FOR_RUNTIME"),
    ).toBeInTheDocument();
    expect(FakeSocket.all).toHaveLength(0);
  });

  it("stays above the phone keyboard while typing", () => {
    const listeners: Record<string, () => void> = {};
    vi.stubGlobal("visualViewport", {
      height: 400,
      offsetTop: 12,
      addEventListener: (name: string, cb: () => void) => {
        listeners[name] = cb;
      },
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("innerHeight", 780);
    render(<ShellTerminal />);
    const root = screen.getByTestId("shell-terminal");
    expect(root).not.toHaveClass("fixed");
    fireEvent.focus(box());
    expect(root).toHaveClass("fixed");
    expect(root).toHaveStyle({ top: "12px", height: "400px" });
    fireEvent.blur(box());
    expect(root).not.toHaveClass("fixed");
  });
});
