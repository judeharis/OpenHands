/**
 * Browser notifications for "waiting for you" are a per-device choice (they need a
 * permission grant on that device), so they live in localStorage, not in settings.
 */
const KEY = "jentic.browserNotifications";
const OLD_KEY = "agentui.browserNotifications"; // before the rename to jentic

export function browserNotificationsEnabled(): boolean {
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (old !== null) {
      if (localStorage.getItem(KEY) === null) localStorage.setItem(KEY, old);
      localStorage.removeItem(OLD_KEY);
    }
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export async function setBrowserNotifications(
  enabled: boolean,
): Promise<boolean> {
  try {
    if (!enabled) {
      localStorage.setItem(KEY, "0");
      return false;
    }
    if (typeof Notification === "undefined") return false;
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    localStorage.setItem(KEY, permission === "granted" ? "1" : "0");
    return permission === "granted";
  } catch {
    return false;
  }
}

export function showWaitingNotification(body: string, tag: string): void {
  if (
    !browserNotificationsEnabled() ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    typeof document === "undefined" ||
    document.visibilityState !== "hidden"
  )
    return;
  try {
    const n = new Notification("Waiting for you", { body, tag });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* notifications unavailable */
  }
}
