// Phase 1 UX: shared sheets, one toast stack, status strip and launcher column on phone sizes.
// Run like test-football-browser.ts (fresh Vite on :5178, then `npm run test:ux:browser`).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest, overlaps } from './browserHarness';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/ux', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ADA = { id: '00000000-0000-4000-8000-0000000000f1', username: 'Ada', college: 'COLENG' };

(async () => {
  const browser = await launch();
  try {
    for (const [width, height] of phonesUnderTest()) {
      const errors: string[] = [];
      // Today's Plan: one goal ready to claim, a 2-day streak.
      let plan: any = { day: '2026-10-14', all_done_bonus: 150, streak: { current: 2, best: 4, badges: [], done_today: false }, goals: [
        { id: 'buy_food', title: 'Buy something to eat', icon: '🍲', target: 1, reward: 100, progress: 1, claimed: false },
        { id: 'take_penalties', title: 'Take 3 penalties at the Sports Centre', icon: '⚽', target: 3, reward: 100, progress: 1, claimed: false },
        { id: 'campus_night', title: 'Show up for Campus Night (8–9pm, Love Garden)', icon: '🌙', target: 1, reward: 100, progress: 0, claimed: false },
      ] };
      const claims: string[] = [];
      const supabase = {
        daily_plan: () => plan,
        claim_daily_goal: (body: any) => {
          claims.push(body.p_goal);
          plan = { ...plan, goals: plan.goals.map((g: any) => g.id === body.p_goal ? { ...g, claimed: true } : g) };
          return { ...plan, balance: 7600, paid: 100 };
        },
      };
      const { context, page } = await openStudent(browser, ADA, { width, height, errors, supabase });
      try {
        // Status strip: visible, on screen, clear of the launcher column.
        const strip = page.getByRole('status', { name: 'Your day' });
        await strip.waitFor();
        assert.match(await strip.innerText(), /(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d\d:\d\d/);
        const stripBox = await strip.boundingBox();
        const phone = await page.getByRole('button', { name: /Open campus phone/ }).boundingBox();
        assert(stripBox.x + stripBox.width <= width && !overlaps(stripBox, phone), 'status strip clears the phone launcher');
        const feedback = await page.getByRole('button', { name: /Send feedback/ }).boundingBox();
        const sound = await page.getByRole('button', { name: /game sound/ }).boundingBox();
        assert(!overlaps(phone, feedback) && !overlaps(feedback, sound), 'launchers stack without overlapping');
        assert(feedback.y > phone.y && sound.y > feedback.y, 'phone → feedback → sound, top to bottom');

        // Today's Plan card: collapsed summary with streak, expands, claims through the server.
        const card = page.getByRole('complementary', { name: "Today's Plan" });
        await card.waitFor();
        assert.match(await card.innerText(), /Today's Plan\s*0\/3\s*🔥2/);
        assert.match(await strip.innerText(), /🔥2/, 'streak in the status strip');
        const cardBox = await card.boundingBox();
        assert(!overlaps(cardBox, stripBox) && !overlaps(cardBox, phone) && cardBox.x + cardBox.width <= width, 'card clear of strip and launchers');
        await card.getByRole('button', { name: /Today's Plan/ }).click();
        await card.getByText('Take 3 penalties at the Sports Centre').waitFor();
        assert.match(await card.innerText(), /1\/3/, 'multi-step progress shown');
        assert(((await card.boundingBox()).y + (await card.boundingBox()).height) < height - 120, 'expanded card leaves the interact/chat area free');
        await page.screenshot({ path: path.join(out, `ux-${width}-plan.png`) });
        await card.getByRole('button', { name: '+₦100' }).click();
        await card.getByLabel('Claimed').waitFor();
        assert.deepEqual(claims, ['buy_food'], 'only the goal id is sent');
        await page.locator('.campus-toast', { hasText: 'Buy something to eat done' }).waitFor();
        assert.equal(await card.getByRole('button', { name: '+₦100' }).count(), 0, 'nothing else claimable yet');
        await card.getByRole('button', { name: /Today's Plan/ }).click();

        // Toasts stack instead of overlapping (start from an empty stack: the claim toast may linger).
        await page.evaluate(async () => {
          const { toast, useToastStore } = await import('/src/stores/toastStore.ts' as any);
          useToastStore.setState({ toasts: [] });
          toast({ icon: '🎉', text: 'Job complete', amount: 500, tone: 'good', ms: 8000 });
          toast({ icon: '🛍️', text: 'Suya bought', amount: -400, tone: 'good', ms: 8000 });
          const { useGameStore } = await import('/src/stores/gameStore.ts' as any);
          useGameStore.getState().setLawnViolationNotice({ visible: true, officerName: 'Officer Bayo', fineAmount: 500, timestamp: Date.now() });
        });
        const toasts = page.locator('.campus-toasts > *');
        await page.waitForFunction(() => document.querySelectorAll('.campus-toasts > *').length === 3);
        const boxes = await Promise.all([0, 1, 2].map((i) => toasts.nth(i).boundingBox()));
        for (let i = 1; i < boxes.length; i++) assert(!overlaps(boxes[i - 1], boxes[i]), 'toasts do not overlap');
        for (const b of boxes) assert(b.x >= 0 && b.x + b.width <= width, 'toast fits the screen');
        await page.screenshot({ path: path.join(out, `ux-${width}-toasts.png`) });
        await page.evaluate(async () => { const { useToastStore } = await import('/src/stores/toastStore.ts' as any); useToastStore.setState({ toasts: [] }); const { useGameStore } = await import('/src/stores/gameStore.ts' as any); useGameStore.getState().setLawnViolationNotice(null); });

        // Shared sheets: bottom-anchored on phones, scroll inside, Escape and the X both close.
        for (const [modal, title] of [['bank', 'FUNAAB Microfinance ATM'], ['help', 'Campus Guide & Controls'], ['campus_jobs', 'Campus Job Board'], ['inventory', 'Student Backpack'], ['friends', 'Campus Friends']] as const) {
          await page.evaluate(async (m: string) => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().setActiveModal(m), modal);
          const sheet = page.getByRole('dialog', { name: title });
          await sheet.waitFor();
          await page.waitForTimeout(400); // let the slide-up animation finish
          const b = await sheet.boundingBox();
          assert(b.width <= width - 12 && b.height <= height * 0.9, `${modal} fits (${Math.round(b.width)}×${Math.round(b.height)})`);
          assert(height - (b.y + b.height) < 40, `${modal} sits at the bottom on a phone`);
          if (modal === 'help') await page.screenshot({ path: path.join(out, `ux-${width}-help.png`) });
          if (modal === 'bank') {
            await page.keyboard.press('Escape');
          } else {
            await sheet.getByRole('button', { name: `Close ${title}` }).click();
          }
          await sheet.waitFor({ state: 'hidden' });
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal scroll');
        assert.deepEqual(errors, []);
        console.log(`UX BROWSER PASSED ${width}x${height}`);
      } catch (e) {
        await page.screenshot({ path: path.join(out, `failure-${width}.png`) }).catch(() => {});
        throw e;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
