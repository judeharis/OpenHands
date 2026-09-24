// Is every conversation tab reachable on a phone? Each tab's box against the strip's,
// before and after scrolling the strip as far as it goes each way.
//   node tabstrip-check.mjs <conversation id> [width]
import { chromium } from "playwright";
const [id, width = "384"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: 780 },
  deviceScaleFactor: 3.75,
  isMobile: true,
  hasTouch: true,
});
await page.goto(`http://127.0.0.1:3000/conversations/${id}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
const measure = () =>
  page.evaluate(() => {
    const first = document.querySelector('[data-testid^="conversation-tab-"]');
    const strip = first?.closest("div.overflow-x-auto");
    if (!strip) return { error: "no tab strip" };
    const s = strip.getBoundingClientRect();
    const tabs = Array.from(strip.querySelectorAll('[data-testid^="conversation-tab-"]')).map((n) => {
      const r = n.getBoundingClientRect();
      const inside = r.left >= s.left - 0.5 && r.right <= s.right + 0.5;
      return `${n.dataset.testid.replace("conversation-tab-", "")}@${Math.round(r.left)}${inside ? "" : " (clipped)"}`;
    });
    return {
      strip: `${Math.round(s.left)}..${Math.round(s.right)}`,
      scroll: `${strip.scrollLeft}/${strip.scrollWidth - strip.clientWidth}`,
      tabs,
    };
  });
console.log("as drawn:     ", JSON.stringify(await measure()));
for (const [label, to] of [["scrolled left:", -1e6], ["scrolled right:", 1e6]]) {
  await page.evaluate((x) => {
    const strip = document.querySelector('[data-testid^="conversation-tab-"]')?.closest("div.overflow-x-auto");
    if (strip) strip.scrollLeft = x;
  }, to);
  console.log(label.padEnd(14), JSON.stringify(await measure()));
}
await browser.close();
