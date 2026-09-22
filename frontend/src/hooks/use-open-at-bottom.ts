import React, { RefObject } from "react";

/**
 * Opening or reloading a conversation puts you at the newest message, straight away.
 *
 * This replaces an earlier hook that remembered where you had scrolled to and restored
 * it, opening a long conversation at its start. In practice that meant every reload
 * landed you at the beginning of the history with the latest message an entire
 * conversation away.
 *
 * "Straight away" needs more than one jump. The history keeps growing taller for a while
 * after the first paint -- markdown, code blocks and images lay out late, and more events
 * arrive -- so a single scroll on the first frame leaves you adrift again a moment later.
 * While following, a ResizeObserver re-pins to the bottom on every size change. The user
 * scrolling up turns following off (see useScrollToBottom), and it stays off until they
 * come back down.
 */
export function useOpenAtBottom(
  scrollRef: RefObject<HTMLDivElement | null>,
  conversationId: string | undefined,
  {
    ready,
    follow,
    onOpen,
  }: { ready: boolean; follow: boolean; onOpen: () => void },
): { opened: boolean } {
  const [opened, setOpened] = React.useState(false);
  const onOpenRef = React.useRef(onOpen);
  onOpenRef.current = onOpen;

  // A different conversation opens at its own bottom.
  React.useEffect(() => {
    setOpened(false);
  }, [conversationId]);

  React.useEffect(() => {
    if (!ready || opened || !conversationId) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    const frame = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight; // no smooth behaviour: no visible travel
      onOpenRef.current();
      setOpened(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, opened, conversationId, scrollRef]);

  // Hold the bottom while the history finishes arriving and laying out.
  //
  // Two different things move the bottom and each needs its own observer. Messages arrive
  // progressively as the history is fetched, which is a DOM change, not a size change --
  // and a ResizeObserver set up once only ever watches the children that existed then, so
  // every message after the first was unwatched and the view drifted up the history as it
  // filled. Meanwhile markdown, code blocks and images finish laying out later without any
  // DOM change at all, which the MutationObserver would miss. So: mutations re-sync the
  // size observations and pin, resizes pin.
  React.useEffect(() => {
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
