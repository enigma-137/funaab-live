// The gym on a phone: walk to the door, buy the evening pass, the barrier opens, work out at a
// station (the student takes the pose and the set bar fills), finish a set. Start Vite with `npm run test:vite`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest } from './browserHarness';
import { GYM, GYM_STATIONS } from '../src/config/gym';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/gym', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ME = { id: '00000000-0000-4000-8000-0000000000d1', username: 'Femi', college: 'COLENG' };
const EVENING = Date.UTC(2026, 9, 22, 16, 30); // 17:30 Lagos

(async () => {
  const browser = await launch();
  try {
    const [width, height] = phonesUnderTest()[0];
    const errors: string[] = [];
    const gymCalls: string[] = [];
    const socket = (ws: any) => ws.onMessage((raw: string) => {
      const p = JSON.parse(raw);
      if (p.type === 'join') ws.send(JSON.stringify({ type: 'snapshot', yourConnectionId: p.player.connectionId, players: {}, kekes: {}, activeMatches: {} }));
      if (p.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: p.t }));
      if (p.type === 'gym') {
        gymCalls.push(`${p.op}${p.station ? ':' + p.station : ''}`);
        const result = p.op === 'enter' ? { pass: '2026-10-22-pm', charged: true } : p.op === 'start' ? { station: p.station } : { done: true };
        ws.send(JSON.stringify({ type: 'action_result', requestId: p.requestId, result }));
      }
    });
    const { context, page } = await openStudent(browser, ME, { width, height, errors, socket, at: EVENING, supabase: { car_garage: () => ({ cars: [] }) } });
    try {
      const store = (mod: string, fn: string) => page.evaluate(async ([m, f]: string[]) => new Function('s', f)((Object.values(await import(`/src/stores/${m}.ts`)) as any[]).find((v) => typeof v?.getState === 'function')), [mod, fn]);
      const until = async (mod: string, fn: string, what: string) => {
        for (let i = 0; i < 100; i++) { if (await store(mod, fn)) return; await page.waitForTimeout(200); }
        throw new Error(`timed out: ${what} ${JSON.stringify(await page.evaluate(async () => { const g = (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState(); return [g.myPosition, g.nearbyInteractable?.id]; }))}`);
      };
      await page.getByText('I know my way, hide this').click().catch(() => {});
      await page.evaluate(async () => (await import('/src/stores/toastStore.ts' as any)).useToastStore?.setState?.({ toasts: [] }));
      // Teleport, repeated until the physics body has taken it (as the lodge test does).
      const goTo = async (x: number, z: number, check: string, what: string) => {
        for (let i = 0; i < 40; i++) {
          await store('hostelStore', `s.setState({ teleport: [${x}, 0, ${z}] })`);
          await page.waitForTimeout(400);
          if (await store('gameStore', check)) return;
        }
        await until('gameStore', check, what);
      };
      const camera = (yaw: number, pitch: number) => page.evaluate(async ([y, p]: number[]) => (await import('/src/stores/inputStore.ts' as any)).useInputStore.setState({ cameraYaw: y, cameraPitch: p }), [yaw, pitch]);
      await page.evaluate(() => history.replaceState(null, '', '/?time=day'));
      await page.evaluate(async () => (await import('/src/game/world/dayNight.ts' as any)).useDayNight.setState({ night: 0 }));

      // At the door: the Gym button opens the pass sheet.
      await goTo(GYM.entrance[0] - 2, GYM.entrance[2], 'return s.getState().nearbyInteractable?.type === "gym"', 'at the gym door');
      await camera(-Math.PI / 2 - 0.5, 0.3);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(out, `gym-${width}-outside.png`) });
      await page.getByRole('button', { name: 'Gym', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: GYM.name });
      await sheet.waitFor();
      assert.match(await sheet.innerText(), /Open until 9 PM/);
      await sheet.screenshot({ path: path.join(out, `gym-${width}-sheet.png`) });
      await sheet.getByRole('button', { name: 'Pay ₦1,000 & enter' }).click();
      await until('gymStore', 'return s.getState().pass === "2026-10-22-pm"', 'pass bought');
      assert.deepEqual(gymCalls, ['enter']);

      // Work out at each kind of station; the student takes the station's pose.
      for (const st of GYM_STATIONS.filter((s, i, all) => all.findIndex((x) => x.kind === s.kind) === i)) {
        await goTo(st.spot[0], st.spot[2], `return s.getState().nearbyInteractable?.targetId === "${st.id}"`, `near ${st.id}`);
        await page.getByRole('button', { name: 'Work out', exact: true }).click();
        await until('gameStore', `return s.getState().seatedAt?.animation === "${st.pose}"`, `${st.pose} pose`);
        await page.getByRole('status', { name: 'Workout' }).waitFor();
        await camera(st.yaw + 0.6, 0.25);
        await page.waitForTimeout(1600);
        await page.screenshot({ path: path.join(out, `gym-${width}-${st.pose}.png`) });
        if (st.kind !== 'mat') await page.getByRole('status', { name: 'Workout' }).getByRole('button', { name: 'Stop' }).click();
        else {
          // Let the last one run to the end of the set.
          await until('gymStore', 'return s.getState().workout === null', 'set finished');
        }
        await until('gameStore', 'return s.getState().seatedAt === null', 'stood up');
      }
      assert(gymCalls.includes('finish:skipping'), `set finished on the Worker (${gymCalls.join(',')})`);
      assert(gymCalls.includes('stop:treadmill-1'), 'stopping tells the Worker');
      assert.deepEqual(await store('gymStore', 'return s.getState().done'), ['skipping']);
      assert.deepEqual(errors, []);
      console.log('gym browser: ok');
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
