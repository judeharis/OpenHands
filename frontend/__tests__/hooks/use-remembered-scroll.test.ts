import { describe, expect, it, beforeEach } from "vitest";
import {
  firstOpenTarget,
  prunePositions,
  readPositions,
  writePosition,
} from "#/hooks/use-remembered-scroll";

describe("remembered scroll positions (jentic)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("remembers a position per conversation", () => {
    writePosition("abc", { top: 640, atBottom: false, at: 1 });
    writePosition("def", { top: 0, atBottom: true, at: 2 });
    expect(readPositions().abc).toEqual({ top: 640, atBottom: false, at: 1 });
    expect(readPositions().def.atBottom).toBe(true);
  });

  it("keeps only the newest entries", () => {
    const many = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [
        `c${i}`,
        { top: i, atBottom: false, at: i },
      ]),
    );
    const kept = prunePositions(many, 50);
    expect(Object.keys(kept)).toHaveLength(50);
    expect(kept.c59).toBeDefined();
    expect(kept.c0).toBeUndefined();
  });

  it("survives storage being unavailable", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    expect(readPositions()).toEqual({});
    Storage.prototype.getItem = original;
  });

  it("opens a long conversation at the top, a short one at the bottom", () => {
    expect(firstOpenTarget({ scrollHeight: 4000, clientHeight: 800 })).toEqual({
      top: 0,
      follow: false,
    });
    expect(firstOpenTarget({ scrollHeight: 810, clientHeight: 800 })).toEqual({
      top: 0,
      follow: true,
    });
  });
});
