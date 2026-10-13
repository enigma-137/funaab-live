// Home background on phones: one-time chooser, "maybe later", weekly money from home toast.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest, settledBox } from './browserHarness';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/background', 'screenshots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await launch();
  try {
    for (const [width, height] of phonesUnderTest()) {
      const errors: string[] = [];
      // 1) New student: chooser appears once, sends only the id, shows the welcome.
      const chooses: any[] = [];
      let chosen = false;
      const a = await openStudent(browser, { id: '00000000-0000-4000-8000-0000000000d1', username: 'Kemi', college: 'COLANIM' }, { width, height, errors, supabase: {
        background_state: () => (chosen ? { chosen: true, background: 'average', title: 'Average home', weekly: 1200, hustle_bonus_percent: 10, allowance_ready: false } : { chosen: false }),
        choose_background: (b: any) => { chooses.push(b); chosen = true; return { chosen: true, background: b.p_background, weekly: 1200, hustle_bonus_percent: 10, allowance_ready: false, paid: 1000, balance: 8500 }; },
      } });
      try {
        const sheet = a.page.getByRole('dialog', { name: 'Where are you from?' });
        await sheet.waitFor();
        const box = await settledBox(a.page, sheet);
        assert(box.y + box.height <= height && box.width <= width - 12, 'chooser fits the phone');
        assert(await sheet.getByRole('button', { name: "That's me" }).isDisabled(), 'must pick first');
        assert.equal(await sheet.getByRole('radio').count(), 3);
        await sheet.getByRole('radio', { name: /Average home/ }).click();
        await a.page.screenshot({ path: path.join(out, `background-${width}-chooser.png`) });
        await sheet.getByRole('button', { name: "That's me" }).click();
        await sheet.waitFor({ state: 'hidden' });
        assert.deepEqual(chooses, [{ p_background: 'average' }]);
        await a.page.locator('.campus-toast', { hasText: 'Resumption money from home' }).waitFor();
        await a.page.waitForTimeout(1500);
        assert.equal(await sheet.count(), 0, 'never asks again');
      } finally { await a.context.close(); }

      // 2) Returning student on a new week: money from home is collected automatically, once.
      let claims = 0;
      const b = await openStudent(browser, { id: '00000000-0000-4000-8000-0000000000d2', username: 'Femi', college: 'COLENG' }, { width, height, errors, supabase: {
        background_state: () => ({ chosen: true, background: 'comfortable', title: 'Comfortable home', weekly: 2500, hustle_bonus_percent: 0, allowance_ready: claims === 0 }),
        claim_home_allowance: () => { claims++; return { chosen: true, background: 'comfortable', weekly: 2500, hustle_bonus_percent: 0, allowance_ready: false, paid: 2500, balance: 10000 }; },
      } });
      try {
        await b.page.locator('.campus-toast', { hasText: 'Money from home arrived' }).waitFor();
        assert.match(await b.page.locator('.campus-toast', { hasText: 'Money from home' }).innerText(), /\+₦2,500/);
        await b.page.screenshot({ path: path.join(out, `background-${width}-allowance.png`) });
        await b.page.waitForTimeout(1500);
        assert.equal(claims, 1, 'claimed once');
        assert.equal(await b.page.getByRole('dialog', { name: 'Where are you from?' }).count(), 0);
      } finally { await b.context.close(); }
      assert.deepEqual(errors, []);
      console.log(`BACKGROUND BROWSER PASSED ${width}x${height}`);
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
