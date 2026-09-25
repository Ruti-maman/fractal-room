import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
await p.addInitScript(() => { try { localStorage.setItem('fractal-theme','dark'); } catch {} });
await p.goto('http://localhost:5199/admin', { waitUntil: 'networkidle' });
const info = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(e => e.textContent.includes('פתיחת סדנה חדשה'));
  if (!btn) return 'not found';
  const cs = getComputedStyle(btn);
  const before = getComputedStyle(btn, '::before');
  return {
    classes: btn.className,
    bgColor: cs.backgroundColor,
    bgImage: cs.backgroundImage.slice(0, 160),
    color: cs.color,
    beforeOpacity: before.opacity,
    beforeBg: before.background.slice(0, 120),
    accentDeep: getComputedStyle(document.documentElement).getPropertyValue('--ds-accent-deep'),
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
