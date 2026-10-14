// College League on phones: League sheet (table, my points, how to score) and the champion banner.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest, settledBox } from './browserHarness';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/league', 'screenshots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await launch();
  try {
    for (const [width, height] of phonesUnderTest()) {
      const errors: string[] = [];
      const supabase = {
        league_champion: () => 'COLANIM',
        college_league: () => ({ week_ends_at: new Date(Date.now() + 2 * 864e5).toISOString(), my_college: 'COLENG', my_points: 85, cap: 200, last_champion: 'COLANIM', table: [
          { college: 'COLANIM', active: 4, total: 412, average: 103, ranked: true },
          { college: 'COLENG', active: 9, total: 610, average: 67.8, ranked: true },
          { college: 'COLVET', active: 1, total: 150, average: 150, ranked: false },
        ] }),
      };
      const { context, page } = await openStudent(browser, { id: '00000000-0000-4000-8000-0000000000aa', username: 'Ife', college: 'COLENG' }, { width, height, errors, supabase });
      try {
        await page.waitForFunction(async () => (await import('/src/stores/leagueStore.ts' as any)).useLeagueStore.getState().champion === 'COLANIM');
        // Look at the banner from just inside the gate.
        await page.evaluate(async () => { (await import('/src/stores/hostelStore.ts' as any)).useHostelStore.setState({ teleport: [11, 0, 79] }); const { useInputStore } = await import('/src/stores/inputStore.ts' as any); useInputStore.getState().setCameraYaw(0); useInputStore.getState().setCameraPitch(0.3); });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(out, `league-${width}-banner.png`) });
        await page.getByRole('button', { name: /Open campus phone/ }).click();
        await page.getByRole('button', { name: 'League', exact: true }).click();
        const sheet = page.getByRole('dialog', { name: 'College League' });
        await sheet.waitFor();
        const b = await settledBox(page, sheet);
        assert(b.y + b.height <= height && b.width <= width - 12, 'league sheet fits');
        const text = await sheet.innerText();
        assert.match(text, /Last week’s champions: COLANIM/);
        assert.match(text, /85 pts/);
        assert.match(text, /#1\s*COLANIM/); assert.match(text, /#2\s*COLENG/);
        assert.match(text, /—\s*COLVET/, 'one-student colleges are shown unranked');
        assert.equal(await sheet.locator('.league-table li.is-mine').innerText().then((t: string) => t.includes('COLENG')), true);
        await page.screenshot({ path: path.join(out, `league-${width}-sheet.png`) });
        assert.deepEqual(errors, []);
        console.log(`LEAGUE BROWSER PASSED ${width}x${height}`);
      } catch (e) {
        await page.screenshot({ path: path.join(out, `failure-${width}.png`) }).catch(() => {});
        throw e;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
