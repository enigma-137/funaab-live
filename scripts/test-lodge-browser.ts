// Off-campus lodge on phones: walk to the lodge, rent, go home to the restyled room.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest, settledBox } from './browserHarness';
import { LODGE } from '../src/config/lodge';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/lodge', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ME = { id: '00000000-0000-4000-8000-0000000000f7', username: 'Dayo', college: 'COLERM' };

(async () => {
  const browser = await launch();
  try {
    for (const [width, height] of phonesUnderTest()) {
      const errors: string[] = [];
      const calls: string[] = [];
      let renting = false;
      const lodge = () => ({ renting, rent: 2000, grace_days: 2, capacity: renting ? 8 : 5, paid_until: renting ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
        grace_until: null, overdue: false, can_prepay: renting, just_evicted: false });
      const supabase = {
        lodge_state: () => lodge(),
        rent_lodge: () => { calls.push('rent'); renting = true; return { ...lodge(), balance: 5500 }; },
        hostel_command: () => { calls.push('hostel_command'); return { success: true }; },
        hostel_snapshot: () => { calls.push('snapshot'); return { room: { owner_id: ME.id, privacy: 'friends', tv_on: false, rested_at: null, security_at: null, style: renting ? 'lodge' : 'resumption' }, placements: [], owner_name: ME.username }; },
      };
      const { context, page } = await openStudent(browser, ME, { width, height, errors, supabase });
      try {
        for (let i = 0; i < 40; i++) {
          await page.evaluate(async (to: number[]) => { (await import('/src/stores/hostelStore.ts' as any)).useHostelStore.setState({ teleport: to }); }, [LODGE.door[0], 0, LODGE.door[2] - 1.2]);
          await page.waitForTimeout(400);
          if ((await page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().nearbyInteractable?.type)) === 'lodge') break;
        }
        // Look at the building from the road (the camera sits behind the student).
        await page.evaluate(async () => { const { useInputStore } = await import('/src/stores/inputStore.ts' as any); useInputStore.getState().setCameraYaw(Math.PI); useInputStore.getState().setCameraPitch(0.35); });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(out, `lodge-${width}-outside.png`) });
        await page.getByRole('button', { name: 'Lodge', exact: true }).click();
        const sheet = page.getByRole('dialog', { name: LODGE.name });
        await sheet.waitFor();
        const box = await settledBox(page, sheet);
        assert(box.y + box.height <= height && box.width <= width - 12, 'lodge sheet fits');
        assert.match(await sheet.innerText(), /₦2,000 a week/);
        await sheet.getByRole('button', { name: /Rent for ₦2,000/ }).click();
        await sheet.getByRole('button', { name: 'Go to my room' }).waitFor();
        assert.match(await sheet.innerText(), /Up to 7 guests/);
        await page.screenshot({ path: path.join(out, `lodge-${width}-rented.png`) });
        await sheet.getByRole('button', { name: 'Go to my room' }).click();
        await page.waitForFunction(async () => (await import('/src/stores/hostelStore.ts' as any)).useHostelStore.getState().snapshot?.room?.style === 'lodge');
        await page.waitForFunction(async () => String((await import('/src/stores/hostelStore.ts' as any)).useHostelStore.getState().roomId).startsWith('world:funaab:hostel-room:'));
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(out, `lodge-${width}-inside.png`) });
        assert.equal(await page.getByRole('status', { name: 'Your day' }).count(), 0, 'status strip stays out of the room\'s top bar');
        assert(calls.includes('rent') && calls.includes('snapshot'));
        assert.deepEqual(errors, []);
        console.log(`LODGE BROWSER PASSED ${width}x${height}`);
      } catch (e) {
        await page.screenshot({ path: path.join(out, `failure-${width}.png`) }).catch(() => {});
        throw e;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
