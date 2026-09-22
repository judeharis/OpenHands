// The Planner/tab panel on a phone: "Read more" / "View" must open a sheet that is on screen,
// with a way back, and the header title must not run under the tab icons.
// usage: node sheet-check.mjs <conversation id with a plan>
import { chromium } from "playwright";
const [cid] = process.argv.slice(2);
const S24U = { viewport: { width: 384, height: 780 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36" };
const b = await chromium.launch(); const p = await (await b.newContext(S24U)).newPage();
await p.goto(`https://jude.tail0bda35.ts.net/conversations/${cid}`, { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(3000);
let ok = true; const check = (cond, msg) => { console.log(`${cond ? "OK  " : "FAIL"} ${msg}`); if (!cond) ok = false; };
// header: title box must end before the tab strip starts
const title = await p.getByTestId("conversation-name-title").boundingBox();
const strip = await p.locator('[data-testid="conversation-name"]').locator("xpath=ancestor::div[contains(@class,'justify-between')][1]").locator(":scope > div").nth(1).boundingBox().catch(() => null);
check(title && strip && title.x + title.width <= strip.x + 1, `title ends at x=${title && Math.round(title.x + title.width)}, tab strip starts at x=${strip && Math.round(strip.x)}`);
// the chat fits the screen: the page itself must not scroll, the thread scrolls inside it
const pageH = await p.evaluate(() => document.scrollingElement.scrollHeight);
check(pageH <= 780 + 2, `page height ${pageH} px fits the 780 px screen (the thread scrolls inside)`);
const composer0 = await p.getByTestId("chat-input").boundingBox();
check(composer0 && composer0.y + composer0.height <= 780, `on arrival the chat is showing, composer at y=${composer0 && Math.round(composer0.y)}`);
await p.screenshot({ path: "/tmp/phone-test/sheet-0-chat.png" });
for (const [label, locator] of [["Read more", p.getByTestId("plan-preview-read-more-button")], ["View", p.getByTestId("plan-preview-view-button")]]) {
  const btn = locator.last();
  if (!(await btn.count())) { check(false, `${label} button present`); continue; }
  await btn.scrollIntoViewIfNeeded(); await btn.tap(); await p.waitForTimeout(700);
  const back = p.getByTestId("tab-sheet-back");
  const bb = await back.boundingBox();
  check(bb && bb.y >= 0 && bb.y + bb.height <= 780, `${label}: sheet header in view at y=${bb && Math.round(bb.y)}`);
  const planText = (await p.locator("body").innerText()).includes("OBJECTIVE");
  check(planText, `${label}: the plan is readable in the sheet`);
  const build = p.getByTestId("planner-tab-build-button"); const bbb = await build.boundingBox();
  check(bbb && bbb.height >= 36, `${label}: Build in the sheet is tappable (${bbb && Math.round(bbb.height)} px tall)`);
  await p.screenshot({ path: `/tmp/phone-test/sheet-1-${label.replace(" ", "-").toLowerCase()}.png` });
  await back.tap(); await p.waitForTimeout(700);
  const input = await p.getByTestId("chat-input").boundingBox();
  check(input && input.y + input.height <= 780, `${label}: back to chat, composer in view at y=${input && Math.round(input.y)}`);
}
console.log(ok ? "SHEET OK" : "SHEET PROBLEM"); await b.close();
