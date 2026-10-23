// Hostel town on a phone: a car owner who doesn't rent at the estate finds the car in the hostel
// garage, sits on a courtyard chair and a tree bench, drives the car in the town, takes the road to
// school (arriving at the wheel on the campus gate road), drives back to the road to the hostel and
// returns to town, then walks the same road on foot. Start Vite with `npm run test:vite`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest } from './browserHarness';
import { HOSTEL_GARAGE, HOSTEL_SEATS } from '../src/config/hostelCompound';
import { TOWN_LINK } from '../src/config/hostelTown';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/hostel-town', 'screenshots');
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
      const until = async (mod: string, fn: string, what: string, tries = 100) => {
        for (let i = 0; i < tries; i++) { if (await store(mod, fn)) return; await page.waitForTimeout(200); }
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
      const shot = (name: string) => page.screenshot({ path: path.join(out, `${name}-${width}.png`) });
      const pos = () => store('gameStore', 'return s.getState().myPosition') as Promise<number[]>;
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
        await until('gameStore', 'return !!s.getState().seatedAt', `seated on ${seat.id}`);
        await camera(seat.rotation + 0.6, 0.35);
        await page.waitForTimeout(1500);
        await shot(seat.id);
        await tap('Stand Up');
        await until('gameStore', 'return !s.getState().seatedAt', 'stood up');
      }

      // At the carport: Drive, and the car moves in the town.
      await goTo(HOSTEL_GARAGE.stepOut[0], HOSTEL_GARAGE.stepOut[2], 'return s.getState().nearbyInteractable?.targetId === "drive"', 'by the garage');
      await camera(Math.PI + 0.4, 0.35);
      await page.waitForTimeout(1500);
      await shot('garage');
      await tap('Drive');
      await until('carStore', 'return s.getState().driving === "car_corolla"', 'at the wheel in the town');
      const before = await pos();
      await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.up('w');
      await page.waitForTimeout(1200);
      const after = await pos();
      assert.ok(after[0] < before[0] - 1, `the car drives west out of the carport (${before} → ${after})`);

      // Looking down the street from the gate; and the arch at the end of it.
      await camera(-Math.PI / 2 + 0.6, 0.25);
      await page.waitForTimeout(1200);
      await shot('street');

      // The road to school: arrive on the campus gate road at the wheel.
      await store('carStore', 'return s.getState().takeRoad("campus")');
      await until('hostelStore', 'return s.getState().roomId === "world:funaab:main"', 'on campus');
      await until('carStore', 'return s.getState().driving === "car_corolla" && !s.getState().parked?.where', 'still driving on campus');
      await page.waitForTimeout(1500);
      const there = await pos();
      assert.ok(Math.hypot(there[0] - TOWN_LINK.campus.arriveCar.position[0], there[2] - TOWN_LINK.campus.arriveCar.position[2]) < 1, `arrive on the gate road (${there})`);
      await camera(-Math.PI / 2 + 0.3, 0.25);
      await page.waitForTimeout(1500);
      await shot('campus-arrival');

      // Reverse back to the road to the hostel; the prompt takes you to town.
      await page.keyboard.down('s');
      try { await until('gameStore', 'return s.getState().nearbyInteractable?.targetId === "to-town"', 'road-to-hostel prompt', 60); }
      finally { await page.keyboard.up('s'); }
      await page.waitForTimeout(1200);
      await tap('Drive to hostel');
      await until('hostelStore', 'return s.getState().roomId === "world:funaab:hostel"', 'back in town');
      await until('carStore', 'return s.getState().driving === "car_corolla" && s.getState().parked?.where === "hostel"', 'driving in town');
      await page.waitForTimeout(1500);
      await camera(Math.PI / 2 + 0.5, 0.25);
      await page.waitForTimeout(1200);
      await shot('town-arrival');

      // Park on the street and walk the road on foot.
      await tap('Park & get out');
      await until('carStore', 'return !s.getState().driving && s.getState().parked?.where === "hostel"', 'parked on the street');
      await goTo(TOWN_LINK.town.exit[0] + 2, TOWN_LINK.town.exit[2] + 4, 'return s.getState().nearbyInteractable?.targetId === "to-campus"', 'at the arch on foot');
      await camera(-Math.PI / 2, 0.2);
      await page.waitForTimeout(1500);
      await shot('arch');
      await tap('Walk to campus');
      await until('hostelStore', 'return s.getState().roomId === "world:funaab:main"', 'walked to campus');
      await until('carStore', 'return !s.getState().driving && s.getState().parked?.where === "hostel"', 'the car stays in town');

      assert.deepEqual(errors, []);
      console.log('HOSTEL TOWN BROWSER PASSED: car homes to the hostel garage, chairs and bench seat you, drive in the town, the road to school lands you at the wheel on the gate road and back, park on the street, walk the road to campus.');
    } finally { await context.close(); }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
