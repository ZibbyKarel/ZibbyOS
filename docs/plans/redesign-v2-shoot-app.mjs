import { chromium } from "@playwright/test";
const [route, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "dark" });
await p.goto(`http://localhost:3000${route}`, { waitUntil: "load" });
await p.waitForTimeout(6000);
await p.screenshot({ path: out, fullPage: true });
await b.close();
