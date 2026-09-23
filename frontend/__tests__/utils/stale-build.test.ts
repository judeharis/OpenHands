import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Messages the three engines give for an import of a chunk that no longer exists.
const CHROME = new TypeError(
  "Failed to fetch dynamically imported module: https://jude.tail0bda35.ts.net/assets/vscode-tab-CAJp2wTo.js",
);
const FIREFOX = new TypeError(
  "error loading dynamically imported module: https://host/assets/terminal-tab-x.js",
);
const SAFARI = new TypeError("Importing a module script failed.");

describe("stale build (jentic)", () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules(); // the "reload started" flag is module state
    sessionStorage.clear();
    reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recognises a missing chunk in each engine's wording, and nothing else", async () => {
    const { isStaleBuildError } = await import("#/utils/stale-build");
    expect(isStaleBuildError(CHROME)).toBe(true);
    expect(isStaleBuildError(FIREFOX)).toBe(true);
    expect(isStaleBuildError(SAFARI)).toBe(true);
    expect(
      isStaleBuildError(new Error("Request failed with status code 500")),
    ).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
  });

  it("reloads into the current build", async () => {
    const { reloadForStaleBuild, staleBuildReloadStarted } =
      await import("#/utils/stale-build");
    expect(reloadForStaleBuild(CHROME)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(staleBuildReloadStarted()).toBe(true);
  });

  it("does not reload for other errors", async () => {
    const { reloadForStaleBuild } = await import("#/utils/stale-build");
    expect(reloadForStaleBuild(new Error("boom"))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("shows the error instead of looping when the same file fails after the reload", async () => {
    const first = await import("#/utils/stale-build");
    first.reloadForStaleBuild(CHROME);

    vi.resetModules(); // the page after the reload
    const second = await import("#/utils/stale-build");
    expect(second.shouldReloadForStaleBuild(CHROME)).toBe(false);
    expect(second.reloadForStaleBuild(CHROME)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    // a different file after a later rebuild is a stale page again
    expect(second.shouldReloadForStaleBuild(FIREFOX)).toBe(true);
  });
});
