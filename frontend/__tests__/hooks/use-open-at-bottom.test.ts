import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RefObject } from "react";
import { useOpenAtBottom } from "#/hooks/use-open-at-bottom";

/** A scroll container 3000px of content tall in a 500px window. */
function element(scrollHeight = 3000) {
  const state = { scrollTop: 0, scrollHeight, clientHeight: 500 };
  return {
    el: {
      get scrollTop() {
        return state.scrollTop;
      },
      set scrollTop(v: number) {
        state.scrollTop = v;
      },
      get scrollHeight() {
        return state.scrollHeight;
      },
      set scrollHeight(v: number) {
        state.scrollHeight = v;
      },
      clientHeight: state.clientHeight,
      children: [] as unknown as HTMLCollection,
    } as unknown as HTMLDivElement,
    state,
  };
}

let observed: (() => void)[] = [];
let mutated: (() => void)[] = [];

beforeEach(() => {
  observed = [];
  mutated = [];
  // The callback is registered by observe(), not by the constructor: a stub that fires
  // either way would pass even with the observation never wired up.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: () => void) {}
      observe() {
        if (!observed.includes(this.cb)) observed.push(this.cb);
      }
      disconnect() {
        observed = observed.filter((c) => c !== this.cb);
      }
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(private cb: () => void) {}
      observe() {
        if (!mutated.includes(this.cb)) mutated.push(this.cb);
      }
      disconnect() {
        mutated = mutated.filter((c) => c !== this.cb);
      }
    },
  );
  // requestAnimationFrame runs immediately so the effect is observable in the test
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

describe("opening a conversation (jentic)", () => {
  it("lands on the newest message, not the start of the history", () => {
    const { el, state } = element();
    const ref = { current: el } as RefObject<HTMLDivElement | null>;
    const onOpen = vi.fn();

    const { result } = renderHook(() =>
      useOpenAtBottom(ref, "conv-1", { ready: true, follow: true, onOpen }),
    );

    expect(state.scrollTop).toBe(3000);
    expect(result.current.opened).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does nothing until the events are on screen", () => {
    const { el, state } = element();
    const ref = { current: el } as RefObject<HTMLDivElement | null>;
    const onOpen = vi.fn();

    const { result } = renderHook(() =>
      useOpenAtBottom(ref, "conv-1", { ready: false, follow: true, onOpen }),
    );

    expect(state.scrollTop).toBe(0);
    expect(result.current.opened).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("holds the bottom while the history is still laying out", () => {
    const { el, state } = element();
    const ref = { current: el } as RefObject<HTMLDivElement | null>;

    renderHook(() =>
      useOpenAtBottom(ref, "conv-1", { ready: true, follow: true, onOpen: () => {} }),
    );
    expect(state.scrollTop).toBe(3000);

    // markdown and code blocks finish rendering: the content gets taller
    act(() => {
      state.scrollHeight = 5200;
      observed.forEach((cb) => cb());
    });
    expect(state.scrollTop).toBe(5200);
  });

  it("holds the bottom as later messages arrive, not just the ones already there", () => {
    // The bug this covers: a ResizeObserver set up once watches only the children that
    // existed then, so history streaming in afterwards left the view part-way up.
    const { el, state } = element();
    const ref = { current: el } as RefObject<HTMLDivElement | null>;

    renderHook(() =>
      useOpenAtBottom(ref, "conv-1", { ready: true, follow: true, onOpen: () => {} }),
    );
    expect(state.scrollTop).toBe(3000);

    act(() => {
      state.scrollHeight = 12000; // forty more messages land
      mutated.forEach((cb) => cb());
    });
    expect(state.scrollTop).toBe(12000);
  });

  it("stops holding the bottom once the reader scrolls up", () => {
    const { el, state } = element();
    const ref = { current: el } as RefObject<HTMLDivElement | null>;

    const { rerender } = renderHook(
      ({ follow }) =>
        useOpenAtBottom(ref, "conv-1", { ready: true, follow, onOpen: () => {} }),
      { initialProps: { follow: true } },
    );
    observed = [];
    mutated = [];
    rerender({ follow: false });

    state.scrollTop = 1200;
    act(() => {
      state.scrollHeight = 5200;
      observed.forEach((cb) => cb());
      mutated.forEach((cb) => cb());
    });
    expect(state.scrollTop).toBe(1200);
  });
});
