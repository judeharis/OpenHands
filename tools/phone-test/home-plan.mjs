// A home-screen Plan, then Build, on the phone: is it ONE conversation from start to finish?
// usage: node home-plan.mjs <name> "<task text>"
// Checks: no second top-level conversation, the URL never changes, the planner is a
// sub-conversation of the code conversation, the Build step is not shown, the code agent does
// the work, and no passing "Hook:" rows appear. Approves like run.mjs (Allow for session on the
// first file write, Continue otherwise). Writes /tmp/phone-test/<name>/NN-*.png and log.json.
import { chromium } from "playwright";
import fs from "fs";
const [name, task] = process.argv.slice(2);
const OUT = `/tmp/phone-test/${name}`; fs.mkdirSync(OUT, { recursive: true });
const API = "http://127.0.0.1:3000";
const S24U = { viewport: { width: 384, height: 780 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36" };
const log = []; const t0 = Date.now(); const checks = {};
const note = (kind, msg, extra = {}) => { const e = { t: +((Date.now() - t0) / 1000).toFixed(1), kind, msg, ...extra }; log.push(e); console.log(`[${e.t}s] ${kind}: ${msg}`); };
const check = (k, ok, msg) => { checks[k] = ok; note(ok ? "pass" : "FAIL", `${k}: ${msg}`); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let shots = 0; const shot = async (page, label) => { await page.screenshot({ path: `${OUT}/${String(++shots).padStart(2, "0")}-${label}.png` }).catch(() => {}); };
const conv = async (id) => { const r = await fetch(`${API}/api/v1/app-conversations?ids=${id}`); const d = await r.json(); return (Array.isArray(d) ? d : d.items || [d])[0] || null; };
const topLevel = async () => { const r = await fetch(`${API}/api/v1/app-conversations/search?limit=100`); return ((await r.json()).items || []).map(c => c.id); };
const events = async (id) => { const out = []; let p = null;
  for (let i = 0; i < 50; i++) { const r = await fetch(`${API}/api/v1/conversation/${id}/events/search?limit=100${p ? `&page_id=${p}` : ""}`); const d = await r.json(); out.push(...(d.items || [])); p = d.next_page_id; if (!p) break; }
  return out; };
const PREAMBLE = "You are the code agent, and this message is the Build step";

const before = new Set(await topLevel());
const browser = await chromium.launch();
const page = await (await browser.newContext(S24U)).newPage();
page.on("console", m => { if (m.type() === "error") note("console-error", m.text().slice(0, 160)); });
await page.goto("https://jude.tail0bda35.ts.net/", { waitUntil: "networkidle", timeout: 60000 });
await page.getByTestId("home-mode-plan").tap();
await page.getByTestId("home-composer").tap(); await page.keyboard.type(task, { delay: 8 });
await shot(page, "home-plan-typed");
await page.getByTestId("submit-button").tap(); note("action", "sent the plan from the home screen");
await page.waitForURL(/\/conversations\/(?!task-)[0-9a-f]+/, { timeout: 240000 });
const cid = page.url().split("/conversations/")[1].split(/[?#]/)[0]; note("nav", `conversation ${cid}`);

// The planner: a sub-conversation of this one, working on the message. Done = its Build
// button is on screen and enabled (the button is disabled while any agent here runs).
let subId = null, planned = false;
const build = page.getByTestId("plan-reply-build-button").or(page.getByTestId("plan-preview-build-button")).first();
const planDeadline = Date.now() + 25 * 60 * 1000;
let lastShot = 0;
while (Date.now() < planDeadline) {
  await sleep(5000);
  const c = await conv(cid).catch(() => null); subId = c?.sub_conversation_ids?.[0] || subId;
  if (Date.now() - lastShot > 60000) { lastShot = Date.now(); await shot(page, "planning");
    const n = await page.getByTestId("thinking-note").innerText().catch(() => ""); if (n) note("thinking-note", n.replace(/\s+/g, " ")); }
  if (subId && await build.isVisible().catch(() => false) && await build.isEnabled().catch(() => false)) { planned = true; break; }
}
check("planner-inside", !!subId, subId ? `planner ${subId} is a sub-conversation of ${cid}` : "no planner sub-conversation appeared");
check("planner-finished", planned, planned ? "the planner finished and Build is enabled" : "the planner never finished");
await shot(page, "plan-done");
const mode1 = await page.getByRole("button", { name: /^(Code|Plan)/ }).first().innerText().catch(() => "?");
note("info", `mode chip before Build: ${mode1.trim()}`);

await build.waitFor({ state: "visible", timeout: 60000 }).catch(() => {});
check("build-button", await build.isVisible().catch(() => false), "a Build button is on screen");
await build.scrollIntoViewIfNeeded().catch(() => {}); await build.tap(); note("action", "tapped Build");
await sleep(8000); await shot(page, "after-build");

check("same-url", page.url().includes(cid), `URL after Build: ${page.url()}`);
const mode2 = await page.getByRole("button", { name: /^(Code|Plan)/ }).first().innerText().catch(() => "?");
note("info", `mode chip after Build: ${mode2.trim()}`);

// Approve until the code agent finishes.
let approvals = 0, allowed = false, sawRunning = false;
const deadline = Date.now() + 20 * 60 * 1000;
while (Date.now() < deadline) {
  await sleep(2500);
  const st = (await conv(cid).catch(() => null))?.execution_status;
  if (st === "running" || st === "waiting_for_confirmation") sawRunning = true;
  if (st === "waiting_for_confirmation") {
    const panel = page.getByTestId("v1-confirmation-panel");
    if (!(await panel.isVisible().catch(() => false))) { await page.mouse.wheel(0, 2000); continue; }
    await panel.scrollIntoViewIfNeeded().catch(() => {});
    const kinds = await panel.getAttribute("data-kind") || "";
    const allow = page.getByTestId("action-allow-session-button");
    if (!allowed && /FileEditorAction/.test(kinds) && await allow.isVisible().catch(() => false)) { await allow.tap(); allowed = true; }
    else await page.getByTestId("action-confirm-button").tap().catch(() => {});
    approvals++; note("confirm", `#${approvals} ${kinds}`); await sleep(3000); continue;
  }
  if (sawRunning && (st === "finished" || st === "idle")) { await sleep(5000); if (["finished", "idle"].includes((await conv(cid))?.execution_status)) break; }
  if (st === "error" || st === "stuck") { note("bug", `code agent ${st}`); break; }
}
await shot(page, "final");

const pevs = await events(cid);
const buildMsg = pevs.find(e => e.kind === "MessageEvent" && e.source === "user" && JSON.stringify(e.llm_message).includes(PREAMBLE));
check("build-step-sent", !!buildMsg, "the code agent of THIS conversation got the Build step");
const actions = pevs.filter(e => e.kind === "ActionEvent").length;
check("code-agent-worked", actions > 0, `${actions} actions by the code agent after ${approvals} approvals`);
const body = await page.locator("body").innerText();
check("build-step-hidden", !body.includes(PREAMBLE), "the Build step text is not on screen");
note("info", `thinking notes seen on screen: ${log.filter(e => e.kind === "thinking-note").length}`);
check("no-hook-ok-rows", !/Hook:\s*PreToolUse/.test(body), "no passing PreToolUse hook rows on screen");
const added = (await topLevel()).filter(id => !before.has(id));
check("one-conversation", added.length === 1 && added[0] === cid, `new top-level conversations: ${added.join(", ") || "none"}`);
fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ cid, subId, task, approvals, actions, checks, log }, null, 1));
note("done", Object.values(checks).every(Boolean) ? "ALL CHECKS PASS" : `failed: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(", ")}`);
await browser.close();
