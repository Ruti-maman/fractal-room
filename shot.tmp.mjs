import { chromium } from 'playwright-core';
const OUT = "C:/Users/User/AppData/Local/Temp/claude/f----------------------/817d19f5-65d0-49f7-930c-51f9f80bd1bb/scratchpad/shots";
const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];

async function shoot(name, url, theme, size = { width: 1920, height: 1080 }) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, colorScheme: theme === 'light' ? 'light' : 'dark' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] PAGEERROR ${e.message}`));
  await page.addInitScript((t) => { try { localStorage.setItem('fractal-theme', t); } catch {} }, theme);
  await page.goto('http://localhost:5199' + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await ctx.close();
}

await shoot('admin-dark', '/admin', 'dark');
await shoot('admin-light', '/admin', 'light');
await shoot('screen1-dark', '/screen/1', 'dark');
await shoot('nf-dark', '/nope', 'dark');
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
await browser.close();
