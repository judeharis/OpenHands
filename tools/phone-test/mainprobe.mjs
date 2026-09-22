import { chromium } from "playwright";
const ID = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 500, height: 800 } });
await page.goto(`http://127.0.0.1:3000/conversations/${ID}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
const info = await page.evaluate(() => {
  const main = document.querySelector("main.overflow-y-scroll") || document.querySelector("main");
  if (!main) return { none: true };
  const ids = [];
  let el = main;
  while (el && el !== document.body) {
    ids.push(`${el.tagName}${el.dataset?.testid ? `[${el.dataset.testid}]` : ""}`);
    el = el.parentElement;
  }
  return {
    ancestry: ids.join(" < "),
    scrollHeight: main.scrollHeight,
    clientHeight: main.clientHeight,
    childCount: main.children.length,
    firstChildren: Array.from(main.children).slice(0, 3).map((c) => `${c.tagName}[${c.dataset?.testid || c.className.slice(0, 30)}]`),
    testids: Array.from(main.querySelectorAll("[data-testid]")).slice(0, 8).map((n) => n.dataset.testid),
    firstText: main.innerText.slice(0, 120).replace(/\n/g, " | "),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
