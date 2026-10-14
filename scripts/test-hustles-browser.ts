// Hustles on phones: room shop restock/collect, POS shift at the kiosk, photo shoot, errands.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest, settledBox } from './browserHarness';
import { POS_KIOSK, PHOTO_SPOTS } from '../src/config/hustles';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/hustles', 'screenshots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await launch();
  try {
    for (const [width, height] of phonesUnderTest()) {
      const errors: string[] = [];
      const rpcCalls: string[] = [];
      const socketOps: any[] = [];
      let units = 0, ready = 0;
      let mine: any[] = [];
      const shop = () => ({ items: [
        { item: 'data', title: 'Data bundle cards', cost: 1000, units_per_restock: 10, unit_price: 130, units: 0, ready: 0 },
        { item: 'snacks', title: 'Snack carton', cost: 600, units_per_restock: 10, unit_price: 90, units, ready },
      ], earned_today: 0, sales_today: 0, max_sales_per_day: 15, hustle_today: 250, daily_cap: 2500 });
      const board = () => ({ open: [{ id: 'e-open', kind: 'carry_load', reward: 300, poster: 'Chidi', mine: false }], mine });
      const supabase = {
        shop_state: () => shop(),
        restock_shop: (b: any) => { rpcCalls.push(`restock:${b.p_item}`); units += 10; ready = 2; return { ...shop(), balance: 6900 }; },
        collect_shop: () => { rpcCalls.push('collect'); const paid = ready * 90; units -= ready; ready = 0; return { ...shop(), paid, balance: 7080 }; },
        errand_board: () => board(),
        post_errand: (b: any) => { rpcCalls.push(`post:${b.p_kind}:${b.p_reward}`); mine = [{ id: 'e-mine', kind: b.p_kind, reward: b.p_reward, status: 'open', role: 'poster', other: null }]; return { ...board(), balance: 6700 }; },
        accept_errand: (b: any) => { rpcCalls.push(`accept:${b.p_errand}`); mine = [...mine, { id: b.p_errand, kind: 'carry_load', reward: 300, status: 'accepted', role: 'runner', other: 'Chidi' }]; return board(); },
        background_state: () => ({ chosen: true, background: 'struggling', title: 'Struggling home', weekly: 400, hustle_bonus_percent: 20, allowance_ready: false }),
      };
      const socket = (ws: any) => { ws.onMessage((raw: string) => {
        const p = JSON.parse(raw);
        if (p.type === 'join') ws.send(JSON.stringify({ type: 'snapshot', yourConnectionId: p.player.connectionId, players: {}, kekes: {}, activeMatches: {} }));
        if (p.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: p.t }));
        if (p.type === 'hustle') {
          socketOps.push(p);
          const result = p.op === 'pos_start' ? { endsAt: Date.now() + 1500 } : p.op === 'pos_finish' ? { paid: 250 } : p.op === 'photo' ? { paid: 100, clients: 0 } : {};
          ws.send(JSON.stringify({ type: 'action_result', requestId: p.requestId, result }));
        }
      }); };
      const opened = await openStudent(browser, { id: '00000000-0000-4000-8000-0000000000e9', username: 'Ngozi', college: 'COLCOMS' }, { width, height, errors, supabase, socket });
      const { context, page } = opened;
      const teleport = async (to: number[], type: string) => {
        for (let i = 0; i < 40; i++) {
          await page.evaluate(async (to: number[]) => { (await import('/src/stores/hostelStore.ts' as any)).useHostelStore.setState({ teleport: to }); }, to);
          await page.waitForTimeout(400);
          if ((await page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().nearbyInteractable?.type)) === type) return;
        }
        assert.fail(`never reached ${type}`);
      };
      try {
        // Opened from the phone's Hustles app.
        await page.getByRole('button', { name: /Open campus phone/ }).click();
        await page.getByRole('button', { name: 'Hustles', exact: true }).click();
        const sheet = page.getByRole('dialog', { name: 'Hustles' });
        await sheet.waitFor();
        const b = await settledBox(page, sheet);
        assert(b.y + b.height <= height && b.width <= width - 12, `hustles sheet fits (${JSON.stringify(b)})`);
        assert.match(await sheet.innerText(), /Today ₦250 of ₦2,500 · \+20% hustle bonus/);

        // Room shop.
        await sheet.getByRole('button', { name: 'Restock ₦600' }).click();
        await sheet.getByRole('button', { name: 'Collect 2 sales' }).click();
        await page.locator('.campus-toast', { hasText: 'Room shop sales collected' }).waitFor();
        assert.deepEqual(rpcCalls.slice(0, 2), ['restock:snacks', 'collect']);

        // Errands: accept one, post one (only the kind + reward are sent).
        await sheet.getByRole('button', { name: 'I’ll do it' }).click();
        await sheet.getByText('walk up to them to hand over').waitFor();
        await sheet.getByLabel('Errand', { exact: true }).selectOption('bring_notes');
        await sheet.getByLabel('Reward in Naira').fill('250');
        await sheet.getByRole('button', { name: 'Post', exact: true }).click();
        await sheet.getByText('waiting for a runner').waitFor();
        assert(rpcCalls.includes('accept:e-open') && rpcCalls.includes('post:bring_notes:250'));
        await page.screenshot({ path: path.join(out, `hustles-${width}-sheet.png`), fullPage: false });
        await sheet.getByRole('button', { name: 'Close Hustles' }).click();

        // POS kiosk: the world button opens Hustles; the shift runs, then pays.
        await teleport([...POS_KIOSK.serviceSpot], 'hustle');
        await page.getByRole('button', { name: 'POS shift', exact: true }).click();
        await sheet.getByRole('button', { name: 'Start shift' }).click();
        await sheet.getByRole('button', { name: 'Close shift & get paid' }).waitFor();
        await page.waitForFunction(() => !(document.querySelector('[aria-label="POS kiosk"] .academic-primary') as HTMLButtonElement)?.disabled);
        await sheet.getByRole('button', { name: 'Close shift & get paid' }).click();
        await page.locator('.campus-toast', { hasText: 'POS shift done' }).waitFor();
        await sheet.getByRole('button', { name: 'Close Hustles' }).click();

        // Photo spot.
        await teleport([...PHOTO_SPOTS[0].position], 'hustle');
        await page.getByRole('button', { name: 'Photos', exact: true }).click();
        await sheet.getByRole('button', { name: 'Take photos here' }).click();
        await page.locator('.campus-toast', { hasText: 'Shoot done' }).waitFor();
        assert.deepEqual(socketOps.map((o) => o.op), ['pos_start', 'pos_finish', 'photo']);
        assert.deepEqual(Object.keys(socketOps[2]).sort(), ['op', 'requestId', 'spot', 'type'], 'no amounts or client counts from the phone');
        await page.screenshot({ path: path.join(out, `hustles-${width}-photo.png`) });
        assert.deepEqual(errors, []);
        console.log(`HUSTLES BROWSER PASSED ${width}x${height}`);
      } catch (e) {
        await page.screenshot({ path: path.join(out, `failure-${width}.png`) }).catch(() => {});
        throw e;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
