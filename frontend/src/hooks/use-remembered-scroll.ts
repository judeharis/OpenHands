import React, { RefObject } from "react";

/**
 * Opening a conversation should put you back where you were reading it, not throw
 * you at the newest message. Positions are per device (localStorage), keyed by
 * conversation, and pruned so the store cannot grow without bound.
 */
const STORE_KEY = "jentic.scrollPositions";
const KEEP = 50;
const OVERFLOW_SLACK = 40; // px of overflow before a conversation counts as scrollable

export interface SavedPosition {
  top: number;
  atBottom: boolean;
  at: number;
}

export function readPositions(): Record<string, SavedPosition> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Newest KEEP entries only, so one device's history stays small. */
export function prunePositions(
  positions: Record<string, SavedPosition>,
  keep = KEEP,
): Record<string, SavedPosition> {
  const entries = Object.entries(positions).sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(entries.slice(0, keep));
}

export function writePosition(id: string, pos: SavedPosition): void {
  try {
    const next = prunePositions({ ...readPositions(), [id]: pos });
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* private mode, blocked storage: remembering is a convenience, not a feature */
  }
}

/** Where to put a conversation that has no remembered position. */
export function firstOpenTarget(el: {
  scrollHeight: number;
  clientHeight: number;
}): { top: number; follow: boolean } {
  const overflows = el.scrollHeight - el.clientHeight > OVERFLOW_SLACK;
  // Short enough to fit: nothing to scroll, so keep following new output.
  return overflows ? { top: 0, follow: false } : { top: 0, follow: true };
}

interface Options {
  /** True once the conversation's events are on screen. */
  ready: boolean;
  /** Called once with whether new output should be followed from here. */
  onRestore: (follow: boolean) => void;
}

export function useRememberedScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  conversationId: string | undefined,
  { ready, onRestore }: Options,
): { restored: boolean } {
  const [restored, setRestored] = React.useState(false);
  const onRestoreRef = React.useRef(onRestore);
  onRestoreRef.current = onRestore;

  // A different conversation gets its own restore.
  React.useEffect(() => {
    setRestored(false);
  }, [conversationId]);

  React.useEffect(() => {
    if (!ready || restored || !conversationId) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    let frame = 0;
    frame = requestAnimationFrame(() => {
      const saved = readPositions()[conversationId];
      if (saved) {
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        el.scrollTop = Math.min(Math.max(0, saved.top), max);
        onRestoreRef.current(saved.atBottom);
      } else {
        const { top, follow } = firstOpenTarget(el);
        el.scrollTop = top;
        onRestoreRef.current(follow);
      }
      setRestored(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [ready, restored, conversationId, scrollRef]);

  // Remember where they got to: while scrolling (debounced) and when leaving.
  React.useEffect(() => {
    if (!restored || !conversationId) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
      writePosition(conversationId, {
        top: el.scrollTop,
        atBottom,
        at: Date.now(),
      });
    };
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, 250);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [restored, conversationId, scrollRef]);

  return { restored };
}
