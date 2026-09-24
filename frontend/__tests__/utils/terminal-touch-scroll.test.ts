import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Terminal } from "@xterm/xterm";
import { attachTouchScroll } from "#/utils/terminal-touch-scroll";

// 20 rows on a 400 px screen: one line is 20 px of finger travel.
function fakeTerm({
  type = "normal",
  appCursor = false,
  viewportY = 100,
  baseY = 100,
} = {}) {
  const state = { viewportY };
  const term = {
    rows: 20,
    modes: { applicationCursorKeysMode: appCursor },
    buffer: {
      active: {
        type,
        get viewportY() {
          return state.viewportY;
        },
      },
    },
    scrollLines: vi.fn((n: number) => {
      state.viewportY = Math.max(0, Math.min(baseY, state.viewportY + n));
    }),
  };
  return { term: term as unknown as Terminal, spy: term.scrollLines, state };
}

function makeHost() {
  const host = document.createElement("div");
  const screen = document.createElement("div");
  screen.className = "xterm-screen";
  Object.defineProperty(screen, "clientHeight", { value: 400 });
  host.appendChild(screen);
  return host;
}

function touch(host: HTMLElement, type: string, ys: number[], time: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: ys.map((clientY) => ({ clientY })),
  });
  Object.defineProperty(event, "timeStamp", { value: time });
  host.dispatchEvent(event);
  return event;
}

let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
  vi.spyOn(performance, "now").mockReturnValue(1000);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("attachTouchScroll", () => {
  it("scrolls back with one finger dragged down", () => {
    const host = makeHost();
    const { term, spy } = fakeTerm();
    attachTouchScroll(term, host);
    touch(host, "touchstart", [100], 0);
    const move = touch(host, "touchmove", [200], 400); // slow: no flick
    expect(spy).toHaveBeenCalledWith(-5);
    expect(move.defaultPrevented).toBe(true); // no page scroll or zoom
  });

  it("follows the average of two fingers, both ways", () => {
    const host = makeHost();
    const { term, spy } = fakeTerm({ viewportY: 50 });
    attachTouchScroll(term, host);
    touch(host, "touchstart", [100, 300], 0);
    touch(host, "touchmove", [140, 340], 400);
    expect(spy).toHaveBeenLastCalledWith(-2);
    touch(host, "touchmove", [60, 260], 800);
    expect(spy).toHaveBeenLastCalledWith(4);
  });

  it("leaves a tap alone", () => {
    const host = makeHost();
    const { term, spy } = fakeTerm();
    attachTouchScroll(term, host);
    touch(host, "touchstart", [100], 0);
    const move = touch(host, "touchmove", [105], 50);
    touch(host, "touchend", [], 60);
    expect(spy).not.toHaveBeenCalled();
    expect(move.defaultPrevented).toBe(false);
    expect(frames).toHaveLength(0);
  });

  it("gives a full-screen program arrow keys", () => {
    const host = makeHost();
    const { term, spy } = fakeTerm({ type: "alternate" });
    const keys = vi.fn();
    attachTouchScroll(term, host, keys);
    touch(host, "touchstart", [100], 0);
    touch(host, "touchmove", [160], 400);
    expect(keys).toHaveBeenLastCalledWith("\x1b[A\x1b[A\x1b[A");
    touch(host, "touchmove", [120], 800);
    expect(keys).toHaveBeenLastCalledWith("\x1b[B\x1b[B");
    expect(spy).not.toHaveBeenCalled();
  });

  it("uses the application cursor keys when the program asked for them", () => {
    const host = makeHost();
    const { term } = fakeTerm({ type: "alternate", appCursor: true });
    const keys = vi.fn();
    attachTouchScroll(term, host, keys);
    touch(host, "touchstart", [100], 0);
    touch(host, "touchmove", [140], 400);
    expect(keys).toHaveBeenLastCalledWith("\x1bOA\x1bOA");
  });

  it("keeps going after a flick, slows, and stops", () => {
    const host = makeHost();
    const { term, spy, state } = fakeTerm({ viewportY: 100000, baseY: 100000 });
    attachTouchScroll(term, host);
    touch(host, "touchstart", [700], 0);
    touch(host, "touchmove", [600], 10);
    touch(host, "touchmove", [400], 20); // fast, upwards: towards newer
    touch(host, "touchend", [], 25);
    const afterDrag = spy.mock.calls.length;
    let now = 1000;
    for (let i = 0; i < 1000 && frames.length; i += 1) {
      now += 16;
      frames.shift()!(now);
    }
    expect(spy.mock.calls.length).toBeGreaterThan(afterDrag);
    expect(frames).toHaveLength(0); // it came to rest
    expect(state.viewportY).toBeGreaterThan(100000 - 1); // clamped, never negative
  });

  it("stops a flick at the end of the output", () => {
    const host = makeHost();
    const { term, state } = fakeTerm({ viewportY: 3, baseY: 100 });
    attachTouchScroll(term, host);
    touch(host, "touchstart", [100], 0);
    touch(host, "touchmove", [200], 10);
    touch(host, "touchmove", [400], 20); // fast, downwards: towards the top
    touch(host, "touchend", [], 25);
    let now = 1000;
    let ran = 0;
    while (frames.length && ran < 1000) {
      now += 16;
      frames.shift()!(now);
      ran += 1;
    }
    expect(state.viewportY).toBe(0);
    expect(ran).toBeLessThan(50); // it noticed it could go no further
  });

  it("does not flick after a slow drag", () => {
    const host = makeHost();
    const { term } = fakeTerm();
    attachTouchScroll(term, host);
    touch(host, "touchstart", [100], 0);
    touch(host, "touchmove", [200], 1000);
    touch(host, "touchend", [], 1010);
    expect(frames).toHaveLength(0);
  });

  it("stops listening when detached", () => {
    const host = makeHost();
    const { term, spy } = fakeTerm();
    const detach = attachTouchScroll(term, host);
    detach();
    touch(host, "touchstart", [100], 0);
    touch(host, "touchmove", [200], 400);
    expect(spy).not.toHaveBeenCalled();
  });
});
