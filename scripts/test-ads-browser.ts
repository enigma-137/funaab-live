// Gate Plaza & billboards on a phone: screenshots of each, the closed-shop and coming-soon sheets,
// a rented shop's business sheet, and the plaza directory. Start Vite with `npm run test:vite`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest, settledBox } from './browserHarness';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/ads', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const views: Array<[string, [number, number, number], number, number]> = [
  ['plaza', [-24, 0, 50], Math.PI, 0.18],
  ['plaza-back-from-gate', [-6, 0, 86], 0.75, 0.12],
  ['billboard-gate', [14, 0, 64], Math.PI, 0.02],
  ['billboard-sports', [-46, 0, -6], Math.PI / 2, 0.02],
  ['billboard-love-garden', [55, 0, -2], 0.75, 0.02],
  ['billboard-car-park', [-50, 0, 57], Math.PI / 2, 0.02],
];

(async () => {
  const browser = await launch();
  try {
    for (const [width, height] of [...phonesUnderTest().slice(0, 1), ...(process.env.ADS_WIDE ? [[1100, 700] as [number, number]] : [])]) {
      const errors: string[] = [];
      const supabase = {
        car_garage: () => ({ cars: [] }),
        ad_listings: () => [{ spot_id: 'plaza-shop-2', business_name: 'Mama Tolu Kitchen', tagline: 'Hot amala & ewedu, 7am–9pm', description: 'Home-cooked food for students.', flyer_url: null, link_url: 'https://example.com/mama-tolu', contact: '0800 000 0000' }],
      };
      const { context, page } = await openStudent(browser, { id: '00000000-0000-4000-8000-0000000000ad', username: 'Ade', college: 'COLENG' }, { width, height, errors, supabase });
      try {
        await page.waitForFunction(async () => !!(await import('/src/stores/adStore.ts' as any)).useAdStore.getState().listings['plaza-shop-2']);
        // Scene shots with the HUD hidden so the plaza and boards are visible.
        const hud = await page.addStyleTag({ content: '*{visibility:hidden!important} canvas{visibility:visible!important}' });
        for (const [name, at, yaw, pitch] of views) {
          await page.evaluate(async ([at, yaw, pitch]: any) => {
            (await import('/src/stores/hostelStore.ts' as any)).useHostelStore.setState({ teleport: at });
            const { useInputStore } = await import('/src/stores/inputStore.ts' as any);
            useInputStore.getState().setCameraYaw(yaw); useInputStore.getState().setCameraPitch(pitch);
          }, [at, yaw, pitch]);
          await page.waitForTimeout(2500);
          await page.screenshot({ path: path.join(out, `ads-${width}-${name}.png`) });
        }
        await hud.evaluate((el: Element) => el.remove());
        const openSheet = async (id: string) => {
          await page.evaluate(async (id: string) => (await import('/src/stores/adStore.ts' as any)).useAdStore.getState().open(id), id);
          const sheet = page.getByRole('dialog');
          await sheet.waitFor();
          const b = await settledBox(page, sheet);
          assert(b.y + b.height <= height + 1 && b.width <= width, `${id} sheet fits`);
          return sheet;
        };
        let sheet = await openSheet('plaza-shop-1');
        assert.match(await sheet.innerText(), /Shop closed · to let/);
        await page.screenshot({ path: path.join(out, `ads-${width}-closed-shop.png`) });
        sheet = await openSheet('plaza-shop-2');
        const text = await sheet.innerText();
        assert.match(text, /Mama Tolu Kitchen/); assert.match(text, /Hot amala/);
        assert.equal(await sheet.getByRole('link', { name: /Visit business/ }).getAttribute('href'), 'https://example.com/mama-tolu');
        await page.screenshot({ path: path.join(out, `ads-${width}-rented-shop.png`) });
        sheet = await openSheet('gate-plaza');
        assert.match(await sheet.innerText(), /1 of 8 shops open/);
        await page.screenshot({ path: path.join(out, `ads-${width}-directory.png`) });
        sheet = await openSheet('billboard-love-garden');
        assert.match(await sheet.innerText(), /Advertisement coming soon/);
        await page.screenshot({ path: path.join(out, `ads-${width}-billboard.png`) });
        assert.deepEqual(errors, []);
        console.log(`ADS BROWSER PASSED ${width}x${height}`);
      } catch (e) {
        await page.screenshot({ path: path.join(out, `failure-${width}.png`) }).catch(() => {});
        throw e;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
