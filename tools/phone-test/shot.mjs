import { chromium } from "playwright";
const ID = process.argv[2];
const OUT = "/tmp/claude-1000/-mnt-Backup-claude/e82efe2c-a9b9-40e9-a4d1-ed7ef0966666/scratchpad";
const browser = await chromium.launch();
for (const [name, viewport] of [["phone", { width: 384, height: 780 }], ["desktop", { width: 1400, height: 900 }]]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`http://127.0.0.1:3000/conversations/${ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${OUT}/conv-${name}.png` });
  const layout = await page.evaluate(() => {
    const seen = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      if (el.scrollHeight - el.clientHeight > 40) {
        const r = el.getBoundingClientRect();
        seen.push(`${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} at (${Math.round(r.x)},${Math.round(r.y)}) visible=${r.width > 0 && r.height > 0 && r.y < window.innerHeight}`);
      }
    }
    return seen;
  });
  console.log(`== ${name}`); layout.forEach((l) => console.log("  ", l));
  await page.close();
}
await browser.close();
