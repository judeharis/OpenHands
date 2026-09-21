import { chromium } from "playwright";
const S24U = { viewport: { width: 384, height: 780 }, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36" };
const browser = await chromium.launch();
const ctx = await browser.newContext(S24U);
const page = await ctx.newPage();
await page.goto("https://jude.tail0bda35.ts.net/", { waitUntil: "networkidle", timeout: 60000 });
await page.screenshot({ path: "/tmp/phone-test/probe-home.png" });
const info = await page.evaluate(() => {
  const els = [...document.querySelectorAll("[data-testid], button, textarea, [contenteditable], a[href]")].slice(0, 80);
  return els.map(e => ({ tag: e.tagName.toLowerCase(), testid: e.getAttribute("data-testid"), aria: e.getAttribute("aria-label"), text: (e.innerText||"").trim().slice(0,40), href: e.getAttribute("href"), ce: e.getAttribute("contenteditable"), rect: (()=>{const r=e.getBoundingClientRect(); return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})() }))
    .filter(e => e.rect[2] > 0);
});
console.log(JSON.stringify(info, null, 0).replace(/\},\{/g, "},\n{"));
await browser.close();
