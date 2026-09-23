import React, { RefObject } from "react";

/**
 * Opening or reloading a conversation puts you at the newest message, and the first frame
 * you see is already there.
 *
 * This replaces an earlier hook that remembered where you had scrolled to and restored
 * it, opening a long conversation at its start. In practice that meant every reload
 * landed you at the beginning of the history with the latest message an entire
 * conversation away.
 *
 * `ready` means the whole history is on screen: the chat holds its skeleton until the
 * history has arrived rather than showing it as it streams in, because each arriving
 * event moved the bottom and the pin chased it -- on every reopen the conversation
 * visibly scrolled past for as long as the history took to load. The pin happens in a
 * layout effect, after the messages are in the DOM and before the browser paints them;
 * the requestAnimationFrame this used before let one frame of the top of the history
 * through first.
 *
 * The history keeps growing taller for a while after that -- markdown, code blocks and
 * images lay out late -- so while following, observers re-pin on every change. The user
 * scrolling up turns following off (see useScrollToBottom), and it stays off until they
 * come back down.
 */
export function useOpenAtBottom(
  scrollRef: RefObject<HTMLDivElement | null>,
  {
    ready,
    follow,
    onOpen,
  }: { ready: boolean; follow: boolean; onOpen: () => void },
): { opened: boolean } {
  const [opened, setOpened] = React.useState(false);
  const onOpenRef = React.useRef(onOpen);
  onOpenRef.current = onOpen;

  // `ready` drops while a conversation (re)loads its history -- another conversation, or
  // this one reopened -- and the next time it is ready it opens at its bottom again.
  React.useLayoutEffect(() => {
    if (!ready) {
      setOpened(false);
      return;
    }
    if (opened) return;
    const el = scrollRef.current;
    if (!el) return;

    el.scrollTop = el.scrollHeight; // before the first paint: no visible travel
    onOpenRef.current();
    setOpened(true);
  }, [ready, opened, scrollRef]);

  // Hold the bottom while the history finishes arriving and laying out.
  //
  // Two different things move the bottom and each needs its own observer. Messages arrive
  // progressively as the history is fetched, which is a DOM change, not a size change --
  // and a ResizeObserver set up once only ever watches the children that existed then, so
  // every message after the first was unwatched and the view drifted up the history as it
  // filled. Meanwhile markdown, code blocks and images finish laying out later without any
  // DOM change at all, which the MutationObserver would miss. So: mutations re-sync the
  // size observations and pin, resizes pin. Installed in a layout effect so that nothing
  // laid out between the first pin and the observers slips past them.
  React.useLayoutEffect(() => {
    if (!opened || !follow) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    const pin = () => {
      el.scrollTop = el.scrollHeight;
    };

    const resize =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(pin);
    const watchSizes = () => {
      if (!resize) return;
      resize.disconnect();
      resize.observe(el);
      for (const child of Array.from(el.children)) resize.observe(child);
    };
    watchSizes();

    const mutations =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            watchSizes();
            pin();
          });
    mutations?.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resize?.disconnect();
      mutations?.disconnect();
    };
  }, [opened, follow, scrollRef]);

  return { opened };
}
