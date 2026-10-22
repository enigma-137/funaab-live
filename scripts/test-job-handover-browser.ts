// Campus job packages on a phone: a Floral World staff member waits at the pickup holding the
// delivery bag; after pickup the student carries it (and tells the room), a student waits at COLENG
// and takes it on delivery. Start Vite with `npm run test:vite`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest } from './browserHarness';
import { CAMPUS_JOBS } from '../src/config/campusJobs';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/job-handover', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ME = { id: '00000000-0000-4000-8000-0000000000e9', username: 'Seyi', college: 'COLENG' };
const JOB = CAMPUS_JOBS.find((j) => j.id === 'job-food-delivery')!;

(async () => {
  const browser = await launch();
  try {
    const [width, height] = phonesUnderTest()[0];
    const errors: string[] = [];
    const sent: any[] = [];
    let status = 'accepted';
    const socket = (ws: any) => ws.onMessage((raw: string) => {
      const p = JSON.parse(raw);
      sent.push(p);
      if (p.type === 'join') ws.send(JSON.stringify({ type: 'snapshot', yourConnectionId: p.player.connectionId, players: {}, kekes: {}, activeMatches: {} }));
      if (p.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: p.t }));
      if (p.type === 'job_action') {
        status = p.action === 'accept' ? 'accepted' : p.action === 'pickup' ? 'picked_up' : p.action === 'deliver' ? 'completed' : 'cancelled';
        const run = { id: 'run-1', job_id: JOB.id, status, reward_claimed: status === 'completed', ...(status === 'completed' ? { paid: JOB.reward, bonus: 0 } : {}) };
        ws.send(JSON.stringify({ type: 'action_result', requestId: p.requestId, result: run }));
      }
    });
    const { context, page } = await openStudent(browser, ME, { width, height, errors, socket, supabase: { car_garage: () => ({ cars: [] }) } });
    try {
      await page.getByText('I know my way, hide this').click().catch(() => {});
      const store = (mod: string, fn: string) => page.evaluate(async ([m, f]: string[]) => new Function('s', f)((Object.values(await import(`/src/stores/${m}.ts`)) as any[]).find((v) => typeof v?.getState === 'function')), [mod, fn]);
      const until = async (mod: string, fn: string, what: string) => {
        for (let i = 0; i < 100; i++) { if (await store(mod, fn)) return; await page.waitForTimeout(200); }
        throw new Error(`timed out: ${what}`);
      };
      const goTo = async (p: readonly number[], dz = 3.2) => {
        for (let i = 0; i < 20; i++) {
          await store('hostelStore', `s.setState({ teleport: [${p[0]}, 0, ${p[2] + dz}] })`);
          await page.waitForTimeout(400);
          if (await store('gameStore', `const m = s.getState().myPosition; return Math.hypot(m[0] - ${p[0]}, m[2] - ${p[2] + dz}) < 1`)) return;
        }
        throw new Error('teleport failed');
      };
      const look = () => page.evaluate(async () => (await import('/src/stores/inputStore.ts' as any)).useInputStore.setState({ cameraYaw: 0.25, cameraPitch: 0.28 }));
      const held = () => store('gameStore', 'return s.getState().myHeldItem?.kind ?? null');

      await store('jobStore', `return s.getState().acceptJob("${JOB.id}")`);
      await goTo(JOB.sourcePos);
      await look();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(out, `job-${width}-pickup-waiting.png`) });
      assert.equal(await held(), null, 'nothing in hand before pickup');

      assert(await store('jobStore', 'return s.getState().pickupDeliveryPackage()'), 'picked up');
      await until('gameStore', 'return s.getState().myHeldItem?.kind === "delivery_bag"', 'carrying the bag');
      assert(sent.some((p) => p.type === 'held_item' && p.kind === 'delivery_bag' && p.ms > 60000), 'everyone nearby sees the bag');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(out, `job-${width}-picked-up.png`) });

      // Walk over to COLENG with it; the student there waits for the order.
      await goTo(JOB.destinationPos);
      await look();
      await page.waitForTimeout(2000);
      assert.equal(await held(), 'delivery_bag', 'still carrying on arrival');
      await page.screenshot({ path: path.join(out, `job-${width}-arriving.png`) });
      const res = await store('jobStore', `return s.getState().completeActiveJob("${ME.id}")`);
      assert.equal(res.success, true);
      await until('gameStore', 'return !s.getState().myHeldItem || s.getState().myHeldItem.until <= Date.now()', 'bag handed over');
      assert(sent.some((p) => p.type === 'held_item' && p.kind === 'delivery_bag' && p.ms === 0), 'put away for everyone');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(out, `job-${width}-delivered.png`) });
      assert.deepEqual(errors, []);
      console.log('job handover browser: ok');
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
