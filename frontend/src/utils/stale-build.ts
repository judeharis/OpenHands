/**
 * A page loaded before the frontend was rebuilt still asks for the old build's hashed
 * chunks whenever it lazily opens something -- a tab, a sheet, a route. A rebuild deletes
 * them, the server answers the missing file with index.html, and the import fails with
 * "Failed to fetch dynamically imported module: .../assets/vscode-tab-CAJp2wTo.js" in
 * place of the whole app (the phone, 2026-09-23, after a rebuild at 01:07). Reloading
 * fetches the current build, so that is what these errors do now.
 *
 * At most once per failing file: if the same file fails again straight after the reload,
 * it is not a stale page but a broken build, and the error is shown instead of a loop.
 */

// Chrome, Firefox and Safari word the failed import differently; Vite's own preload
// helper reports a stylesheet it could not load.
const STALE_BUILD_MESSAGE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

const RELOADED_FOR_KEY = "jentic:stale-build-reloaded-for";

let reloadStarted = false;

/** A stale-build reload is on its way: anything still rendering should just wait. */
export const staleBuildReloadStarted = (): boolean => reloadStarted;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error ?? "");

export const isStaleBuildError = (error: unknown): boolean =>
  STALE_BUILD_MESSAGE.test(messageOf(error));

/** True if this error is a stale build that has not already been reloaded for. */
export function shouldReloadForStaleBuild(error: unknown): boolean {
  if (!isStaleBuildError(error)) return false;
  try {
    return sessionStorage.getItem(RELOADED_FOR_KEY) !== messageOf(error);
  } catch {
    return false; // no storage, no guard: an error screen beats a reload loop
  }
}

/** Reload into the current build if `error` calls for it; true if a reload started. */
export function reloadForStaleBuild(error: unknown): boolean {
  if (!shouldReloadForStaleBuild(error)) return false;
  try {
    sessionStorage.setItem(RELOADED_FOR_KEY, messageOf(error));
  } catch {
    return false;
  }
  reloadStarted = true;
  window.location.reload();
  return true;
}
