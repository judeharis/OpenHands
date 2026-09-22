// Plays a human on a Galaxy S24 Ultra driving the OpenHands UI over the tailnet.
// usage: node run.mjs <name> <code|plan> "<task text>"
import { chromium } from "playwright";
import fs from "fs";
const [name, mode, task, followUp] = process.argv.slice(2);
const OUT = `/tmp/phone-test/${name}`; fs.mkdirSync(OUT, { recursive: true });
const API = "http://127.0.0.1:3000";
const S24U = { viewport: { width: 384, height: 780 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36" };
const log = []; const t0 = Date.now();
const note = (kind, msg, extra = {}) => { const e = { t: +((Date.now() - t0) / 1000).toFixed(1), kind, msg, ...extra }; log.push(e); console.log(`[${e.t}s] ${kind}: ${msg}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let shots = 0; const shot = async (page, label) => { if (shots++ > 60) return; await page.screenshot({ path: `${OUT}/${String(shots).padStart(2,"0")}-${label}.png` }).catch(()=>{}); };
// In plan mode the work happens in a sub-conversation (own sandbox); the parent stays idle.
const status = async (id) => { try {
  const r = await fetch(`${API}/api/v1/app-conversations?ids=${id}`); const d = await r.json(); const it = (Array.isArray(d) ? d : d.items || [d])[0]; if (!it) return null;
  let best = it.execution_status ?? null;
  for (const sid of (it.sub_conversation_ids || [])) { const r2 = await fetch(`${API}/api/v1/app-conversations?ids=${sid}`); const d2 = await r2.json(); const s2 = (Array.isArray(d2) ? d2 : d2.items || [d2])[0]; const st = s2?.execution_status; if (st === "waiting_for_confirmation" || st === "running" || (st && best !== "waiting_for_confirmation" && best !== "running")) best = st; }
  return best; } catch { return null; } };

const browser = await chromium.launch();
const ctx = await browser.newContext(S24U); const page = await ctx.newPage();
page.on("dialog", d => { note("dialog", d.message()); d.dismiss(); });
page.on("console", m => { if (m.type() === "error") note("console-error", m.text().slice(0, 160)); });
await page.goto("https://jude.tail0bda35.ts.net/", { waitUntil: "networkidle", timeout: 60000 });
await shot(page, "home");
const nb = page.getByTestId("launch-new-conversation-button");
const box = await nb.boundingBox(); if (box && box.y + box.height > 780) note("ux", "New Conversation button below the fold on home screen", { y: Math.round(box.y) });
await nb.scrollIntoViewIfNeeded(); await nb.tap();
await page.waitForURL(/\/conversations\/(?!task-)[0-9a-f]+/, { timeout: 180000 }); const cid = page.url().split("/conversations/")[1].split(/[?#]/)[0];
note("nav", `conversation ${cid}`);
const input = page.getByTestId("chat-input"); await input.waitFor({ state: "visible", timeout: 120000 });
// wait until the sandbox is ready (input enabled / no "Disconnected")
for (let i = 0; i < 60; i++) { const ce = await input.getAttribute("contenteditable"); const txt = await page.locator("body").innerText(); if (ce === "true" && !/Disconnected|Starting|Connecting/i.test(txt)) break; await sleep(2000); }
await shot(page, "ready");
if (mode === "plan") {
  const btn = page.getByRole("button", { name: /^Code/ }).first(); if (await btn.count()) { await btn.tap(); await sleep(800); await shot(page, "mode-menu"); const planOpt = page.getByText(/^Plan/).last(); await planOpt.tap().catch(()=>note("ux","could not tap Plan option")); await sleep(800); await shot(page, "plan-mode"); note("action", "switched to plan mode"); } else note("ux", "no Code/Plan switch button found");
  // A human types straight away -- and loses the message (found 2026-09-21: the planning
  // agent is a separate sub-conversation + sandbox that is not ready yet). Wait for it
  // here so the rest of the flow can be measured; the loss itself is logged as a bug.
  const tPlan = Date.now(); let subId = null;
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`${API}/api/v1/app-conversations?ids=${cid}`); const d = await r.json(); const it = (Array.isArray(d) ? d : d.items || [d])[0]; subId = (it.sub_conversation_ids || [])[0] || null;
      if (subId) { const r2 = await fetch(`${API}/api/v1/app-conversations?ids=${subId}`); const d2 = await r2.json(); const s2 = (Array.isArray(d2) ? d2 : d2.items || [d2])[0]; if (s2.sandbox_status === "RUNNING" && s2.execution_status) break; } } catch {}
    await sleep(2000);
  }
  note("ux", subId ? `planner (sub-conversation ${subId}, same sandbox) ready ${((Date.now()-tPlan)/1000).toFixed(0)}s after the Plan tap` : "planning sub-conversation never became ready");
}
await input.tap(); await page.keyboard.type(task, { delay: 12 }); await shot(page, "typed");
await page.getByTestId("submit-button").tap(); note("action", "sent task");
let sentFollowUp = false; let sawRunning = false; let nudged = false; let approvals = 0, allows = 0, allowed = false, lastApprovalAt = Date.now(), scrolls = 0, missingPanel = 0, built = false, finalText = "";
const deadline = Date.now() + 30 * 60 * 1000;
while (Date.now() < deadline) {
  await sleep(2500);
  const st = await status(cid);
  if (st === "running" || st === "waiting_for_confirmation") sawRunning = true;
  if (!sawRunning) continue; // idle before the agent has even started is not "done"
  const panel = page.getByTestId("v1-confirmation-panel");
  const visible = await panel.isVisible().catch(() => false);
  if (st === "waiting_for_confirmation") {
    const sentCue = await page.getByTestId("v1-confirmation-sent").isVisible().catch(() => false);
    if (!visible && sentCue) { continue; } // tapped already; agent has not moved on yet
    if (!visible) { missingPanel++; if (missingPanel % 4 === 1) { note("bug", "status is waiting_for_confirmation but no confirmation panel is visible"); await shot(page, "no-panel"); } await page.mouse.wheel(0, 2000); continue; }
    const b = await panel.boundingBox(); if (b && (b.y < 0 || b.y + b.height > 780)) { scrolls++; note("ux", "confirmation panel off-screen; scrolling", { y: Math.round(b.y) }); await panel.scrollIntoViewIfNeeded(); }
    const title = (await panel.innerText()).replace(/\s+/g, " ").slice(0, 140);
    const wait = ((Date.now() - lastApprovalAt) / 1000).toFixed(0);
    const meta = { actionKinds: await panel.getAttribute("data-kind"), risk: await panel.getAttribute("data-risk"), count: Number(await panel.getAttribute("data-count") || 1) };
    note("confirm", `#${approvals + 1} after ${wait}s: ${title}`, meta);
    await shot(page, `confirm-${approvals + 1}`);
    await sleep(1500); // reading time
    // A person used to Claude Code taps "Allow for session" the first time a write inside
    // the project is asked for, and never sees that kind of prompt again. One tap either way.
    const allow = page.getByTestId("action-allow-session-button");
    if (!allowed && meta.risk !== "high" && /FileEditorAction/.test(meta.actionKinds || "") && await allow.isVisible().catch(() => false)) {
      note("action", `tapped Allow for session: ${(await page.getByTestId("v1-allow-hint").innerText().catch(() => "")).slice(0, 100)}`);
      await allow.tap(); allowed = true; allows++; approvals++; lastApprovalAt = Date.now(); await sleep(4000); continue;
    }
    const btn = page.getByTestId("action-confirm-button"); const bb = await btn.boundingBox();
    if (bb) { const hit = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest("[data-testid]")?.getAttribute("data-testid") || el.tagName) : "none"; }, [bb.x + bb.width / 2, bb.y + bb.height / 2]); if (hit !== "action-confirm-button") note("bug", `Continue button obscured by ${hit} at its centre`, { y: Math.round(bb.y) }); }
    await btn.tap();
    approvals++; lastApprovalAt = Date.now();
    await sleep(4000); if ((await status(cid)) === "waiting_for_confirmation" && (await panel.isVisible().catch(()=>false)) && (await panel.innerText()).replace(/\s+/g," ").slice(0,140) === title) note("bug", "Continue tap did not take effect (same action still pending)");
    continue;
  }
  if (st === "finished" || st === "idle") {
    if (mode === "plan" && !built) { const build = page.getByTestId("plan-preview-build-button"); if (await build.isVisible().catch(()=>false)) { await shot(page, "plan-done"); await build.scrollIntoViewIfNeeded(); await build.tap(); built = true; note("action", "tapped Build on the plan"); sawRunning = false; await sleep(5000); continue; } }
    await sleep(6000); if (["finished","idle"].includes(await status(cid))) {
      if (followUp && !sentFollowUp) { sentFollowUp = true; await shot(page, "first-done"); await input.tap(); await page.keyboard.type(followUp, { delay: 12 }); await page.getByTestId("submit-button").tap(); note("action", "sent follow-up"); sawRunning = false; await sleep(5000); continue; }
      await shot(page, "final"); finalText = (await page.locator("body").innerText()).slice(-1200); note("done", `status ${st} after ${approvals} approvals`); break; }
  }
  if (st === "error") { note("bug", "conversation entered error state"); await shot(page, "error"); break; }
  if (st === "stuck") {
    // the SDK's stuck detector fired (a loop of identical actions). A person would nudge once.
    if (!nudged) { nudged = true; note("bug", "agent stuck (identical actions in a row); sending one nudge"); await shot(page, "stuck");
      if (mode === "plan" && !built) { const build = page.getByTestId("plan-preview-build-button"); if (await build.isVisible().catch(()=>false)) { await build.scrollIntoViewIfNeeded(); await build.tap(); built = true; note("action", "tapped Build on the plan (planner was stuck)"); sawRunning = false; await sleep(5000); continue; } }
      await input.tap(); await page.keyboard.type("You are repeating the same step. Move on to the next one.", { delay: 8 }); await page.getByTestId("submit-button").tap(); sawRunning = false; await sleep(5000); continue; }
    note("bug", "stuck again after a nudge; stopping"); break;
  }
  const body = await page.locator("body").innerText(); const m = body.match(/(Network error|MCP Connection Failure|error state|Disconnected|Something went wrong)[^\n]{0,80}/i); if (m) note("banner", m[0]);
}
// Every action the agent took, parent and planner alike, from the app-server mirror:
// what was NOT a tap was approved by the policy (or a batch / a repeat).
const countActions = async (id) => { let n = 0, byKind = {}, page = null;
  for (let i = 0; i < 50; i++) { const r = await fetch(`${API}/api/v1/conversation/${id}/events/search?limit=100${page ? `&page_id=${page}` : ""}`); const d = await r.json();
    for (const ev of d.items || []) if (ev.kind === "ActionEvent") { n++; const k = ev.action?.kind || "?"; byKind[k] = (byKind[k] || 0) + 1; }
    page = d.next_page_id; if (!page) break; }
  return { n, byKind }; };
let actions = 0, actionsByKind = {};
try { const r = await fetch(`${API}/api/v1/app-conversations?ids=${cid}`); const it = (await r.json())[0];
  for (const id of [cid, ...(it?.sub_conversation_ids || [])]) { const c = await countActions(id); actions += c.n; for (const [k, v] of Object.entries(c.byKind)) actionsByKind[k] = (actionsByKind[k] || 0) + v; } } catch {}
const autoApproved = Math.max(0, actions - approvals);
note("done", `${actions} actions, ${approvals} taps (${allows} of them Allow for session), ${autoApproved} approved without a tap`);
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ cid, mode, task, approvals, allows, actions, actionsByKind, autoApproved, scrolls, missingPanel, totalSec: (Date.now()-t0)/1000, log, finalText }, null, 1));
await browser.close();
