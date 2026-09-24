import { beforeEach, describe, expect, it } from "vitest";
import { usePendingFirstMessageStore } from "#/stores/pending-first-message-store";

const store = () => usePendingFirstMessageStore.getState();
const held = {
  taskId: "t1",
  text: "read it",
  images: [],
  files: [new File(["x"], "data.csv")],
};

beforeEach(() => usePendingFirstMessageStore.setState({ pending: null }));

describe("pending first message (jentic)", () => {
  it("is not handed over before its start task has resolved", () => {
    store().hold(held);
    expect(store().take("c1")).toBeNull();
    expect(store().pending).not.toBeNull();
  });

  it("is handed over once, to the conversation its task became", () => {
    store().hold(held);
    store().resolve("t1", "c1");
    expect(store().take("c2")).toBeNull();
    expect(store().take("c1")).toMatchObject({ text: "read it" });
    expect(store().take("c1")).toBeNull();
  });

  it("ignores another task resolving", () => {
    store().hold(held);
    store().resolve("t2", "c1");
    expect(store().take("c1")).toBeNull();
  });
});
