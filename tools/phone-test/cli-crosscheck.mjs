// The phone half of the CLI cross-check. usage:
//   node cli-crosscheck.mjs answer <conversation id>     open the conversation on the phone viewport, tap Continue on the
//                                                        first confirmation (the CLI is watching the same one)
//   node cli-crosscheck.mjs ask "<task>"                  start a conversation from the phone, wait until it waits for a
//                                                        confirmation, print the id, then watch for the CLI's answer:
//                                                        the panel must turn into "confirmed" without a tap here
import { chromium } from "playwright";
const [mode, arg] = process.argv.slice(2);
const API = "http://127.0.0.1:3000";
const S24U = { viewport: { width: 384, height: 780 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36" };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const status = async (id) => { try { const r = await fetch(`${API}/api/v1/app-conversations?ids=${id}`); return (await r.json())[0]?.execution_status ?? null; } catch { return null; } };
const b = await chromium.launch(); const p = await (await b.newContext(S24U)).newPage();
if (mode === "answer") {
  await p.goto(`https://jude.tail0bda35.ts.net/conversations/${arg}`, { waitUntil: "networkidle", timeout: 60000 });
  const btn = p.getByTestId("action-confirm-button");
  for (let i = 0; i < 60; i++) { if (await btn.isVisible().catch(() => false)) break; await sleep(2000); }
  const panel = (await p.getByTestId("v1-confirmation-panel").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 100);
  await btn.tap(); console.log(`phone tapped Continue on: ${panel}`);
  await sleep(3000); console.log("phone sees:", (await p.getByTestId("v1-confirmation-sent").innerText().catch(() => "(no cue)")).slice(0, 60));
} else if (mode === "ask") {
  await p.goto("https://jude.tail0bda35.ts.net/", { waitUntil: "networkidle", timeout: 60000 });
  const nb = p.getByTestId("launch-new-conversation-button"); await nb.scrollIntoViewIfNeeded(); await nb.tap();
  await p.waitForURL(/\/conversations\/(?!task-)[0-9a-f]+/, { timeout: 180000 }); const cid = p.url().split("/conversations/")[1].split(/[?#]/)[0];
  const input = p.getByTestId("chat-input"); await input.waitFor({ state: "visible", timeout: 120000 });
  for (let i = 0; i < 60; i++) { if ((await input.getAttribute("contenteditable")) === "true") break; await sleep(2000); }
  await input.tap(); await p.keyboard.type(arg, { delay: 10 }); await p.getByTestId("submit-button").tap();
  console.log(`CID ${cid}`);
  for (let i = 0; i < 90; i++) { if ((await status(cid)) === "waiting_for_confirmation") break; await sleep(2000); }
  console.log("phone: waiting for confirmation; not tapping");
  let cue = "";
  for (let i = 0; i < 90; i++) { await sleep(2000); const st = await status(cid); cue = await p.getByTestId("v1-confirmation-sent").innerText().catch(() => ""); const panel = await p.getByTestId("v1-confirmation-panel").isVisible().catch(() => false); if (st !== "waiting_for_confirmation" || (!panel && !cue)) break; }
  console.log(`phone after the CLI answered: status ${await status(cid)}, panel visible ${await p.getByTestId("v1-confirmation-panel").isVisible().catch(() => false)}`);
}
await b.close();
