import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:3000/conversations/${process.argv[2]}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => {
  const navs = Array.from(document.querySelectorAll('[data-testid^="conversation-tab"]'));
  const stored = Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.toLowerCase().includes("conversation")).slice(0, 3));
  return { tabs: navs.map((n) => n.dataset.testid), stored };
});
console.log("tab navs:", info.tabs);
console.log("stored:", JSON.stringify(info.stored).slice(0, 300));
await browser.close();
