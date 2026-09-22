// Watch every scrollable element on the conversation page while it loads.
import { chromium } from "playwright";
const ID = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 800 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message.slice(0, 120)));
await page.goto(`http://127.0.0.1:3000/conversations/${ID}`, { waitUntil: "domcontentloaded" });

const probe = () =>
  page.evaluate(() => {
    const out = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      if (el.scrollHeight - el.clientHeight > 40) {
        const cls = (el.className && String(el.className).slice(0, 40)) || el.tagName;
        out.push({
          tag: el.tagName,
          cls,
          top: Math.round(el.scrollTop),
          height: el.scrollHeight,
          view: el.clientHeight,
          atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 20,
          children: el.children.length,
        });
      }
    }
    return out;
  });

for (let i = 0; i < 24; i++) {
  const rows = await probe();
  const t = (i * 0.5).toFixed(1);
  if (!rows.length) console.log(`${t}s  (nothing scrollable yet)`);
  for (const r of rows) {
    console.log(
      `${t}s  ${r.tag}.${r.cls}  top=${r.top} of ${r.height - r.view}  children=${r.children}  ${r.atBottom ? "AT BOTTOM" : "*** NOT AT BOTTOM ***"}`,
    );
  }
  await page.waitForTimeout(500);
}
await browser.close();
