import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
const seen = [];
page.on("websocket", (ws) => {
  ws.on("framereceived", (f) => {
    const s = typeof f.payload === "string" ? f.payload : f.payload.toString();
    if (s.includes("accumulated_token_usage")) seen.push(s);
  });
});
await page.goto(`http://127.0.0.1:3000/conversations/${process.argv[2]}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(12000);
for (const s of seen.slice(-1)) {
  const m = JSON.parse(s);
  const agent = m?.value?.usage_to_metrics?.agent?.accumulated_token_usage;
  console.log("accumulated_token_usage:", JSON.stringify(agent, null, 1));
}
if (!seen.length) console.log("no stats frame seen");
await browser.close();
