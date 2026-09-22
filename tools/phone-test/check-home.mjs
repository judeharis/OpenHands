// Verifies the home screen on a Galaxy-S24-Ultra-sized viewport: what is shown,
// what is hidden, and that the composer seeds the first message.
import { chromium } from "playwright";
const API = "http://127.0.0.1:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 384, height: 780 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36" });
const p = await ctx.newPage();
await p.goto("https://jude.tail0bda35.ts.net/", { waitUntil: "networkidle", timeout: 60000 });
await p.screenshot({ path: "/tmp/phone-test/home-new.png" });

const seen = async (sel) => (await p.locator(sel).count()) > 0 && (await p.locator(sel).first().isVisible().catch(() => false));
console.log("greeting        :", (await p.getByTestId("home-greeting").innerText()).replace(/\n/g, " | "));
console.log("composer        :", await seen('[data-testid="home-composer"]'));
const comp = await p.getByTestId("home-composer").boundingBox();
console.log("composer y      :", Math.round(comp.y), comp.y + comp.height <= 780 ? "(in view)" : "(BELOW FOLD)");
console.log("repo card       :", await seen('[data-testid="repo-connector"]'), "(want false)");
console.log("task suggestions:", await seen('[data-testid="task-suggestions"]'), "(want false)");
console.log("guide banner    :", (await p.locator("text=New around here").count()) > 0, "(want false)");
console.log("automations btn :", await seen('[data-testid="automations-button"]'), "(want false)");
console.log("recents         :", await seen('[data-testid="recent-conversations"]'));
console.log("no-repo chips   :", await p.locator("text=No Repository").count(), "(want 0)");

await p.getByTestId("user-avatar").tap(); await p.waitForTimeout(500);
const menu = (await p.getByTestId("user-context-menu").innerText()).split("\n").map((s) => s.trim()).filter(Boolean);
console.log("account menu    :", menu.join(", "));
await p.screenshot({ path: "/tmp/phone-test/home-menu.png" });
await p.keyboard.press("Escape"); await p.mouse.click(5, 400); await p.waitForTimeout(300);

// the composer seeds the first message
await p.getByTestId("home-composer").tap();
await p.keyboard.type("Create a file jentic-home.txt containing exactly: home composer works", { delay: 10 });
await p.screenshot({ path: "/tmp/phone-test/home-typed.png" });
await p.getByTestId("submit-button").tap();
await p.waitForURL(/\/conversations\/(?!task-)[0-9a-f]+/, { timeout: 180000 });
const cid = p.url().split("/conversations/")[1].split(/[?#]/)[0];
console.log("conversation    :", cid);
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(3000);
  const btn = p.getByTestId("action-confirm-button");
  if (await btn.isVisible().catch(() => false)) {
    const panel = (await p.getByTestId("v1-confirmation-panel").innerText()).replace(/\s+/g, " ").slice(0, 80);
    const bb = await btn.boundingBox();
    console.log("first action    :", panel, "| button y", Math.round(bb.y));
    await p.screenshot({ path: "/tmp/phone-test/home-confirm.png" });
    await btn.tap();
    break;
  }
  const st = await (await fetch(`${API}/api/v1/app-conversations?ids=${cid}`)).json().then((d) => (Array.isArray(d) ? d : d.items || [d])[0]?.execution_status).catch(() => null);
  if (st === "finished" || st === "error") { console.log("ended early with", st); break; }
}
await p.waitForTimeout(8000);
await p.screenshot({ path: "/tmp/phone-test/home-done.png" });
await b.close();
