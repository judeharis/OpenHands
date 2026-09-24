/**
 * Fork-only: touch scrolling for an xterm on a phone. xterm 6 has none -- it carries VS
 * Code's gesture recogniser but never registers the terminal with it -- so a finger dragged
 * over the Terminal tab moved nothing, one finger or two (measured 2026-09-23 with real CDP
 * touch events: `seq 1 300`, top line 263 before and after either drag). The chat, a native
 * scroller, scrolled with both.
 *
 * A drag of one or two fingers (their average, with two) scrolls with the finger:
 *   - normal output: the scrollback, line by line, and a flick keeps going and slows down
 *   - a full-screen program (less, man, git log's pager): it has no scrollback, so the drag
 *     becomes up/down arrow keys, as a mouse wheel does in xterm
 * A touch that barely moves is left alone, so a tap still does what a tap did.
 */
import type { Terminal } from "@xterm/xterm";

const TAP_SLOP_PX = 8;
// A flick faster than this keeps scrolling after the fingers lift (px per ms).
const FLING_MIN_VELOCITY = 0.3;
const FLING_STOP_VELOCITY = 0.02;
const FLING_FRICTION_PER_16MS = 0.95;

type Touches = { length: number; [index: number]: { clientY: number } };

const averageY = (touches: Touches): number => {
  let sum = 0;
  for (let i = 0; i < touches.length; i += 1) sum += touches[i].clientY;
  return sum / touches.length;
};

export function attachTouchScroll(
  term: Terminal,
  host: HTMLElement,
  sendKeys?: (sequence: string) => void,
): () => void {
  let lastY: number | null = null;
  let startY = 0;
  let dragging = false;
  let pending = 0; // pixels not yet a whole line
  let velocity = 0; // px per ms, positive when the fingers move down
  let lastTime = 0;
  let fling: number | null = null;

  const rowHeight = () => {
    const screen = host.querySelector<HTMLElement>(".xterm-screen");
    const height = screen?.clientHeight || host.clientHeight;
    return Math.max(1, height / Math.max(1, term.rows));
  };

  const stopFling = () => {
    if (fling !== null) cancelAnimationFrame(fling);
    fling = null;
  };

  /** Move by `pixels` of finger travel; positive means the fingers went down (older). */
  const scrollBy = (pixels: number): boolean => {
    pending += pixels;
    const lines = Math.trunc(pending / rowHeight());
    if (lines === 0) return true;
    pending -= lines * rowHeight();
    if (term.buffer.active.type === "alternate") {
      if (!sendKeys) return false;
      const csi = term.modes.applicationCursorKeysMode ? "\x1bO" : "\x1b[";
      sendKeys((lines > 0 ? `${csi}A` : `${csi}B`).repeat(Math.abs(lines)));
      return true;
    }
    const before = term.buffer.active.viewportY;
    term.scrollLines(-lines);
    return term.buffer.active.viewportY !== before; // false at the top or the bottom
  };

  const onStart = (event: TouchEvent) => {
    stopFling();
    const touches = event.touches as unknown as Touches;
    if (touches.length === 0 || touches.length > 2) {
      lastY = null;
      return;
    }
    lastY = averageY(touches);
    startY = lastY;
    dragging = false;
    pending = 0;
    velocity = 0;
    lastTime = event.timeStamp;
  };

  const onMove = (event: TouchEvent) => {
    const touches = event.touches as unknown as Touches;
    if (lastY === null || touches.length === 0 || touches.length > 2) return;
    const y = averageY(touches);
    if (!dragging && Math.abs(y - startY) < TAP_SLOP_PX) return;
    dragging = true;
    event.preventDefault(); // this drag is the terminal's: no page scroll, no zoom
    const dt = Math.max(1, event.timeStamp - lastTime);
    velocity = 0.8 * ((y - lastY) / dt) + 0.2 * velocity;
    lastTime = event.timeStamp;
    scrollBy(y - lastY);
    lastY = y;
  };

  const onEnd = (event: TouchEvent) => {
    const touches = event.touches as unknown as Touches;
    if (touches.length > 0) {
      // one of two fingers lifted: carry on from where the rest are
      lastY = averageY(touches);
      return;
    }
    lastY = null;
    if (!dragging || term.buffer.active.type !== "normal") return;
    if (Math.abs(velocity) < FLING_MIN_VELOCITY) return;
    let previous = performance.now();
    const step = (now: number) => {
      const dt = Math.max(1, now - previous);
      previous = now;
      const moved = scrollBy(velocity * dt);
      velocity *= FLING_FRICTION_PER_16MS ** (dt / 16);
      fling =
        moved && Math.abs(velocity) > FLING_STOP_VELOCITY
          ? requestAnimationFrame(step)
          : null;
    };
    fling = requestAnimationFrame(step);
  };

  const options = { passive: false, capture: true } as const;
  host.addEventListener("touchstart", onStart, options);
  host.addEventListener("touchmove", onMove, options);
  host.addEventListener("touchend", onEnd, options);
  host.addEventListener("touchcancel", onEnd, options);
  return () => {
    stopFling();
    host.removeEventListener("touchstart", onStart, options);
    host.removeEventListener("touchmove", onMove, options);
    host.removeEventListener("touchend", onEnd, options);
    host.removeEventListener("touchcancel", onEnd, options);
  };
}
