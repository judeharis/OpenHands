// Open an old conversation whose sandbox is gone, on the phone viewport, and bring it back.
// usage: node reopen-smoke.mjs <conversation id>
// Checks: the archived view renders the WHOLE history (not the first 100 events), the
// Reopen button is in view, and after tapping it the composer becomes live.
import { chromium } from "playwright";
import fs from "fs";
const [cid] = process.argv.slice(2);
const API = "http://127.0.0.1:3000";
const OUT = "/tmp/phone-test/reopen"; fs.mkdirSync(OUT, { recursive: true });
const S24U = { viewport: { width: 384, height: 780 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36" };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const info = async () => (await (await fetch(`${API}/api/v1/app-conversations?ids=${cid}`)).json())[0];
const mirrorCount = await (await fetch(`${API}/api/v1/conversation/${cid}/events/count`)).json();
const before = await info(); console.log(`before: sandbox ${before.sandbox_status}, title "${before.title}", ${mirrorCount} events in the app mirror`);
const b = await chromium.launch(); const ctx = await b.newContext(S24U); const p = await ctx.newPage();
const errs = []; p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });
let historyPages = 0; p.on("request", r => { if (/\/events\/search\?/.test(r.url())) historyPages++; });
const t0 = Date.now();
await p.goto(`https://jude.tail0bda35.ts.net/conversations/${cid}`, { waitUntil: "networkidle", timeout: 60000 });
const banner = p.getByTestId("archived-banner"); await banner.waitFor({ state: "visible", timeout: 60000 });
// let the paginated history land; count rendered message/event cards
await sleep(4000);
const expectedPages = Math.ceil(mirrorCount / 100);
console.log(`archived view fetched ${historyPages} history page(s) of 100; ${expectedPages} needed for ${mirrorCount} events ${historyPages >= expectedPages ? "(full history)" : "(TRUNCATED)"}`);
await p.screenshot({ path: `${OUT}/01-archived.png` });
const btn = p.getByTestId("reopen-conversation-button"); const bb = await btn.boundingBox();
console.log(`Reopen button at y=${bb && Math.round(bb.y)} of 780 ${bb && bb.y + bb.height <= 780 ? "(in view)" : "(OFF SCREEN)"}`);
await btn.tap(); console.log("tapped Reopen");
const input = p.getByTestId("chat-input");
let live = false;
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const st = (await info()).sandbox_status;
  const ce = await input.getAttribute("contenteditable").catch(() => null);
  if (st === "RUNNING" && ce === "true") { live = true; break; }
}
const after = await info();
console.log(`after ${((Date.now() - t0) / 1000).toFixed(0)}s: sandbox ${after.sandbox_status} (${after.sandbox_id}), title "${after.title}", composer ${live ? "LIVE" : "not live"}`);
await p.screenshot({ path: `${OUT}/02-reopened.png` });
console.log("console errors:", errs.length ? errs.slice(0, 5) : "none");
console.log(live && after.title === before.title && historyPages >= expectedPages ? "REOPEN OK" : "REOPEN PROBLEM");
await b.close();
