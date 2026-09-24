import React from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "#/utils/utils";

const contextMenuVariants = cva("text-white overflow-hidden z-50", {
  variants: {
    theme: {
      default:
        "absolute bg-tertiary rounded-[6px] context-menu-box-shadow py-[6px] px-1",
      naked: "relative",
    },
    size: {
      compact: "py-1 px-1",
      default: "",
    },
    layout: {
      vertical: "flex flex-col gap-2",
    },
    position: {
      top: "bottom-full",
      bottom: "top-full",
    },
    spacing: {
      default: "mt-2",
      none: "",
    },
    alignment: {
      left: "left-0",
      right: "right-0",
    },
  },
  compoundVariants: [
    {
      theme: "naked",
      className: "shadow-none",
    },
  ],
  defaultVariants: {
    theme: "default",
    size: "default",
    layout: "vertical",
    spacing: "default",
  },
});

interface ContextMenuProps {
  ref?: React.RefObject<HTMLUListElement | null>;
  testId?: string;
  children: React.ReactNode;
  className?: React.HTMLAttributes<HTMLUListElement>["className"];
  theme?: VariantProps<typeof contextMenuVariants>["theme"];
  size?: VariantProps<typeof contextMenuVariants>["size"];
  layout?: VariantProps<typeof contextMenuVariants>["layout"];
  position?: VariantProps<typeof contextMenuVariants>["position"];
  spacing?: VariantProps<typeof contextMenuVariants>["spacing"];
  alignment?: VariantProps<typeof contextMenuVariants>["alignment"];
}

/**
 * Fork: true if an ancestor that clips its overflow would cut `el` off. On a phone the
 * header's title box (overflow-hidden), the sideways-scrolling tab strip and the composer's
 * control row (both overflow-x-auto) each cropped the menu opened inside them to nothing:
 * the title ⋮, the tabs ⋮, Tools and Code all opened a menu nobody could see (measured
 * 2026-09-23 -- the menus were in the page, full size, and hidden by those boxes).
 */
function isClipped(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false; // not shown yet
  for (
    let a = el.parentElement;
    a && a !== document.body;
    a = a.parentElement
  ) {
    const style = getComputedStyle(a);
    const clipping = [style.overflow, style.overflowX, style.overflowY].some(
      (value) => value && value !== "visible",
    );
    if (clipping) {
      const box = a.getBoundingClientRect();
      if (
        r.top < box.top - 1 ||
        r.bottom > box.bottom + 1 ||
        r.left < box.left - 1 ||
        r.right > box.right + 1
      )
        return true;
    }
  }
  return false;
}

export function ContextMenu({
  testId,
  children,
  className,
  ref,
  theme,
  size,
  layout,
  position,
  spacing,
  alignment,
}: ContextMenuProps) {
  const own = React.useRef<HTMLUListElement | null>(null);
  // Where the menu is on screen, once it has had to leave a box that clips it.
  const [escaped, setEscaped] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const setRef = React.useCallback(
    (node: HTMLUListElement | null) => {
      own.current = node;
      // eslint-disable-next-line no-param-reassign -- forwarding a ref is writing to it
      if (ref) ref.current = node;
    },
    [ref],
  );

  // Before the first paint: a menu that would be clipped is drawn instead at the same
  // place on screen, fixed, from the end of <body>, where nothing crops it. One that is
  // not clipped stays where it is, as upstream draws it.
  React.useLayoutEffect(() => {
    if (theme === "naked" || escaped || !own.current) return;
    if (!isClipped(own.current)) return;
    const r = own.current.getBoundingClientRect();
    setEscaped({ top: r.top, left: r.left, width: r.width });
  }, [theme, escaped]);

  const list = (
    <ul
      data-testid={testId}
      ref={setRef}
      className={cn(
        contextMenuVariants({
          theme,
          size,
          layout,
          position,
          spacing,
          alignment,
        }),
        className,
        escaped && "!m-0",
      )}
      style={
        escaped
          ? {
              position: "fixed",
              top: escaped.top,
              left: escaped.left,
              width: escaped.width,
              right: "auto",
              bottom: "auto",
              transform: "none",
              zIndex: 9999,
            }
          : undefined
      }
    >
      {children}
    </ul>
  );
  return escaped ? createPortal(list, document.body) : list;
}
