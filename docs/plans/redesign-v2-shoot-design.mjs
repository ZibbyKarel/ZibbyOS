// usage: node shoot-design.mjs <port> <page.dc.html> <outprefix>  — screenshots every view in nav.vt
import { chromium } from "@playwright/test";
const [port, page, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await p.goto(`http://127.0.0.1:${port}/${encodeURIComponent(page)}`, { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
const btns = await p.$$("nav.vt button, nav.vt a, nav.vt [role=tab]");
const labels = [];
for (const b2 of btns) labels.push((await b2.innerText()).trim());
console.log("views:", JSON.stringify(labels));
if (!btns.length) { await p.screenshot({ path: `${out}-default.png`, fullPage: true }); }
for (let i = 0; i < btns.length; i++) {
  const all = await p.$$("nav.vt button, nav.vt a, nav.vt [role=tab]");
  await all[i].click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}-${i}.png`, fullPage: true });
}
await b.close();
