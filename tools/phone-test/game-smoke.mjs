import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 384, height: 780 }, hasTouch: true, isMobile: true });
const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
await p.goto("http://127.0.0.1:8777/", { waitUntil: "networkidle" });
await p.screenshot({ path: "/tmp/phone-test/iter1/game-0.png" });
const cells = p.locator("button").filter({ hasNotText: /reset|new game|play again/i });
const n = await cells.count(); console.log("buttons:", n, "| body:", (await p.locator("body").innerText()).replace(/\s+/g," ").slice(0,160));
for (const i of [0, 3, 1, 4, 2]) { await cells.nth(i).tap(); await p.waitForTimeout(150); }
const text = (await p.locator("body").innerText()).replace(/\s+/g, " ");
console.log("after X wins top row ->", text.slice(0, 200));
await p.screenshot({ path: "/tmp/phone-test/iter1/game-win.png" });
const reset = p.getByRole("button", { name: /reset|new game|play again/i }).first(); if (await reset.count()) { await reset.tap(); console.log("after reset ->", (await p.locator("body").innerText()).replace(/\s+/g," ").slice(0,120)); }
console.log("js errors:", errs.length ? errs : "none");
await b.close();
