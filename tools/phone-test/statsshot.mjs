import { chromium } from "playwright";
const OUT = "/tmp/claude-1000/-mnt-Backup-claude/e82efe2c-a9b9-40e9-a4d1-ed7ef0966666/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message.slice(0, 160)));
await page.goto(`http://127.0.0.1:3000/conversations/${process.argv[2]}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
const tab = page.getByTestId("conversation-tab-stats");
console.log("stats tab present:", await tab.count() > 0);
await tab.click({ timeout: 10000 }).catch((e) => console.log("click failed:", e.message.slice(0, 80)));
await page.waitForTimeout(3000);
for (const id of ["stats-tokens", "stats-time", "stats-split", "stats-tools"]) {
  console.log(`  ${id}:`, await page.getByTestId(id).count() > 0 ? "rendered" : "absent");
}
const text = await page.getByTestId("stats-tools").innerText().catch(() => "(none)");
console.log("---\n" + text.split("\n").slice(0, 8).join("\n"));
await page.screenshot({ path: `${OUT}/stats-tab.png` });
await browser.close();
