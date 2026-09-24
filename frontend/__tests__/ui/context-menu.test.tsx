import { render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "#/ui/context-menu";

type Box = { top: number; left: number; right: number; bottom: number };
const boxes: Record<string, Box> = {};

const asRect = (b: Box) =>
  ({
    ...b,
    x: b.left,
    y: b.top,
    width: b.right - b.left,
    height: b.bottom - b.top,
    toJSON: () => b,
  }) as DOMRect;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function rectOf(this: HTMLElement) {
      const key = this.getAttribute("data-testid") || this.id;
      return asRect(boxes[key] ?? { top: 0, left: 0, right: 0, bottom: 0 });
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.keys(boxes).forEach((k) => delete boxes[k]);
});

function renderInBox(
  overflow: string,
  props: Partial<React.ComponentProps<typeof ContextMenu>> = {},
) {
  const ref = React.createRef<HTMLUListElement>();
  render(
    <div id="box" style={{ overflow }}>
      <ContextMenu testId="menu" ref={ref} {...props}>
        <li>Rename</li>
      </ContextMenu>
    </div>,
  );
  return ref;
}

describe("ContextMenu", () => {
  it("leaves a box that would crop it, and stays where it was on screen", () => {
    // the phone's title box: 24 px tall; the menu opens below it
    boxes.box = { top: 78, left: 12, right: 180, bottom: 102 };
    boxes.menu = { top: 110, left: 3, right: 271, bottom: 436 };
    const ref = renderInBox("hidden");

    const menu = screen.getByTestId("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu.style.position).toBe("fixed");
    expect(menu.style.top).toBe("110px");
    expect(menu.style.left).toBe("3px");
    expect(menu.style.width).toBe("268px");
    expect(ref.current).toBe(menu); // outside-click checks still see the menu
  });

  it("stays in place when nothing crops it", () => {
    boxes.box = { top: 0, left: 0, right: 400, bottom: 800 };
    boxes.menu = { top: 110, left: 3, right: 271, bottom: 436 };
    renderInBox("hidden");

    const menu = screen.getByTestId("menu");
    expect(menu.parentElement?.id).toBe("box");
    expect(menu.style.position).toBe("");
  });

  it("stays in place in a box that does not clip", () => {
    boxes.box = { top: 78, left: 12, right: 180, bottom: 102 };
    boxes.menu = { top: 110, left: 3, right: 271, bottom: 436 };
    renderInBox("visible");

    expect(screen.getByTestId("menu").parentElement?.id).toBe("box");
  });

  it("does not move a menu that is not shown yet", () => {
    boxes.box = { top: 78, left: 12, right: 180, bottom: 102 };
    renderInBox("hidden"); // the menu measures 0 x 0

    expect(screen.getByTestId("menu").parentElement?.id).toBe("box");
  });

  it("never moves a naked menu, which is laid out in place", () => {
    boxes.box = { top: 78, left: 12, right: 180, bottom: 102 };
    boxes.menu = { top: 110, left: 3, right: 271, bottom: 436 };
    renderInBox("hidden", { theme: "naked" });

    expect(screen.getByTestId("menu").parentElement?.id).toBe("box");
  });
});
