// Hostel garage and courtyard seats on a phone: a car owner who doesn't rent at the estate finds the
// car in the hostel garage, sits on a courtyard chair and a tree bench, drives out to campus, then
// stops at the hostel driveway and parks back in the garage. Start Vite with `npm run test:vite`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest } from './browserHarness';
import { HOSTEL_GARAGE, HOSTEL_SEATS } from '../src/config/hostelCompound';
import { HOSTEL_DRIVEWAY } from '../src/config/cars';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/hostel-garage', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ME = { id: '00000000-0000-4000-8000-0000000000e1', username: 'Enigma', college: 'COLFHEC' };

(async () => {
  const browser = await launch();
  try {
    const [width, height] = phonesUnderTest()[0];
    const errors: string[] = [];
    const { context, page } = await openStudent(browser, ME, {
      width, height, errors,
      supabase: { car_garage: () => ({ cars: [{ car: 'car_corolla', litres: 20, paint: null }] }), hostel_command: () => ({ success: true }) },
    });
    try {
      const store = (mod: string, fn: string) => page.evaluate(async ([m, f]: string[]) => new Function('s', f)((Object.values(await import(`/src/stores/${m}.ts`)) as any[]).find((v) => typeof v?.getState === 'function')), [mod, fn]);
      const until = async (mod: string, fn: string, what: string) => {
        for (let i = 0; i < 100; i++) { if (await store(mod, fn)) return; await page.waitForTimeout(200); }
        throw new Error(`timed out: ${what} ${JSON.stringify(await page.evaluate(async () => { const g = (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState(); return [g.myPosition, g.nearbyInteractable?.id]; }))}`);
      };
      const goTo = async (x: number, z: number, check: string, what: string) => {
        for (let i = 0; i < 40; i++) {
          await store('hostelStore', `s.setState({ teleport: [${x}, 0, ${z}] })`);
          await page.waitForTimeout(400);
          if (await store('gameStore', check)) return;
        }
        await until('gameStore', check, what);
      };
      const camera = (yaw: number, pitch: number) => page.evaluate(async ([y, p]: number[]) => (await import('/src/stores/inputStore.ts' as any)).useInputStore.setState({ cameraYaw: y, cameraPitch: p }), [yaw, pitch]);
      const tap = (name: string) => page.getByRole('button', { name, exact: true }).click();
      await page.getByText('I know my way, hide this').click().catch(() => {});
      await page.evaluate(async () => (await import('/src/game/world/dayNight.ts' as any)).useDayNight.setState({ night: 0 }));

      // No estate: the car's home is the hostel garage.
      await until('carStore', 'return s.getState().parked?.where === "hostel"', 'car in the hostel garage');
      await store('hostelStore', 'return s.getState().travel("hostel")');
      await until('hostelStore', 'return s.getState().roomId === "world:funaab:hostel"', 'in the courtyard');
      await page.waitForTimeout(1500);

      // The plastic chairs and the tree bench take a seat.
      for (const seat of [HOSTEL_SEATS[0], HOSTEL_SEATS[4]]) {
        await goTo(seat.position[0], seat.position[2] + (seat.rotation === 0 ? 0.6 : 0), `return s.getState().nearbyInteractable?.id === "${seat.id}"`, `at ${seat.id}`);
        await tap('Sit');
        await until('gameStore', 'return s.getState().seatedAt?.animation === undefined && !!s.getState().seatedAt', `seated on ${seat.id}`);
        await camera(seat.rotation + 0.6, 0.35);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(out, `${seat.id}-${width}.png`) });
        await tap('Stand Up');
        await until('gameStore', 'return !s.getState().seatedAt', 'stood up');
      }

      // At the carport: Drive out.
      await goTo(HOSTEL_GARAGE.stepOut[0], HOSTEL_GARAGE.stepOut[2], 'return s.getState().nearbyInteractable?.targetId === "hostel-drive"', 'by the garage');
      await camera(0.5, 0.3);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(out, `garage-${width}.png`) });
      await tap('Drive out');
      await until('hostelStore', 'return s.getState().roomId === "world:funaab:main"', 'back on campus');
      await until('carStore', 'return s.getState().driving === "car_corolla" && !s.getState().parked?.where', 'driving out of the hostel');

      // Stopped at the hostel driveway: Park at hostel puts it back in the garage.
      await until('gameStore', 'return s.getState().nearbyInteractable?.targetId === "hostel-park"', 'park-at-hostel prompt');
      const at = await store('gameStore', 'return s.getState().myPosition');
      assert.ok(Math.hypot(at[0] - HOSTEL_DRIVEWAY.position[0], at[2] - HOSTEL_DRIVEWAY.position[2]) < 0.5, `car starts on the driveway (${at})`);
      await camera(HOSTEL_DRIVEWAY.rotation + Math.PI + 0.5, 0.3);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(out, `driveway-${width}.png`) });
      await tap('Park at hostel');
      await until('hostelStore', 'return s.getState().roomId === "world:funaab:hostel"', 'walked into the courtyard');
      await until('carStore', 'return !s.getState().driving && s.getState().parked?.where === "hostel"', 'parked in the garage');
      await until('gameStore', 'return s.getState().nearbyInteractable?.targetId === "hostel-drive"', 'standing by the garage');

      assert.deepEqual(errors, []);
      console.log('HOSTEL GARAGE BROWSER PASSED: car homes to the hostel garage without the estate, chairs and tree bench seat you, Drive out lands at the wheel on the hostel driveway, Park at hostel puts it back in the garage.');
    } finally { await context.close(); }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
