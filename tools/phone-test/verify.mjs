// Quick static verification of the pinned confirmation bar on a phone viewport:
// start a conversation, send a one-file task, and check the Continue button is
// inside the viewport and unobscured without any scrolling.
import { chromium } from "playwright";
const API = "http://127.0.0.1:3000";
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 384, height: 780 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36" }); const p = await ctx.newPage();
await p.goto("https://jude.tail0bda35.ts.net/", { waitUntil: "networkidle", timeout: 60000 });
const nb = p.getByTestId("launch-new-conversation-button"); const bb0 = await nb.boundingBox(); console.log("New Conversation button y:", bb0 && Math.round(bb0.y), bb0 && bb0.y + bb0.height <= 780 ? "(in view)" : "(below fold)");
await nb.scrollIntoViewIfNeeded(); await nb.tap(); await p.waitForURL(/\/conversations\/(?!task-)[0-9a-f]+/, { timeout: 180000 });
const cid = p.url().split("/conversations/")[1].split(/[?#]/)[0];
const input = p.getByTestId("chat-input"); await input.waitFor({ state: "visible", timeout: 120000 });
for (let i = 0; i < 40; i++) { if ((await input.getAttribute("contenteditable")) === "true") break; await p.waitForTimeout(2000); }
await input.tap(); await p.keyboard.type("Create a file verify.txt containing the single line: pinned bar check", { delay: 10 }); await p.getByTestId("submit-button").tap();
let ok = false;
for (let i = 0; i < 40; i++) { await p.waitForTimeout(3000); const btn = p.getByTestId("action-confirm-button"); if (await btn.isVisible().catch(() => false)) { const bb = await btn.boundingBox(); const hit = await p.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest("[data-testid]")?.getAttribute("data-testid") || el.tagName) : "none"; }, [bb.x + bb.width / 2, bb.y + bb.height / 2]); console.log("Continue at y=%d (viewport 780), hit-test=%s, panel text: %s", Math.round(bb.y), hit, (await p.getByTestId("v1-confirmation-panel").innerText()).replace(/\s+/g, " ").slice(0, 90)); await p.screenshot({ path: "/tmp/phone-test/verify-pinned.png" }); ok = hit === "action-confirm-button" && bb.y + bb.height <= 780; await p.getByTestId("action-reject-button").tap(); console.log("rejected (no file should be written)"); break; } }
console.log(ok ? "PINNED BAR OK" : "PINNED BAR PROBLEM"); await b.close();
