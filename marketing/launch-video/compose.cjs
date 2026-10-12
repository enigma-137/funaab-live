// Captures compose.html frame by frame into out/NNNNN.jpg (or selected frames to preview/).
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const pick = process.argv.slice(2).map(Number);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto('file://' + __dirname + '/compose.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const total = await page.evaluate(() => window.TOTAL_FRAMES);
  const dir = __dirname + (pick.length ? '/preview' : '/out'); fs.mkdirSync(dir, { recursive: true });
  const from = Number(process.env.FROM || 0);
  const frames = pick.length ? pick : [...Array(total).keys()].filter((F) => F >= from && F < Number(process.env.TO || 1e9));
  const t0 = Date.now();
  for (const F of frames) {
    await page.evaluate((F) => window.renderFrame(F), F);
    await page.screenshot({ path: `${dir}/${String(F).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 94 });
    if (F % 150 === 0) console.log(F, '/', total, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  console.log('total frames', total);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
