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
      // First visit: a hint says where the car is and how to get to school.
      await page.getByText('Your car is in the garage by the gate. Drive out, turn right', { exact: false }).waitFor({ timeout: 15000 });
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

      // Passing cars are solid and stop for you: stand in the westbound lane and walk east into the
      // traffic; you never end up inside a car.
      await tap('Park & get out');
      await until('carStore', 'return !s.getState().driving', 'parked in the courtyard');
      const traffic = () => page.evaluate(async () => (await import('/src/game/world/HostelTown.tsx' as any)).trafficNow) as Promise<Array<{ x: number; z: number; v: number; lane: string }>>;
      // Step into the westbound lane where no car is right now, then wait for traffic to reach you.
      let laneX = -60;
      for (let i = 0; i < 50; i++) { const cars = await traffic(); if (cars.every((c) => c.lane !== 'west' || Math.abs(c.x - laneX) > 12)) break; await page.waitForTimeout(200); }
      await goTo(laneX, 22.8, `const p = s.getState().myPosition; return Math.abs(p[0] - (${laneX})) < 0.5 && Math.abs(p[2] - 22.8) < 0.5`, 'in the lane');
      await camera(Math.PI / 2 + 0.25, 0.3);
      let stopped = false;
      for (let i = 0; i < 150 && !stopped; i++) {
        const cars = (await traffic()).filter((c) => c.lane === 'west');
        for (const c of cars) assert.ok(Math.abs(c.x - laneX) > 2.5, `a passing car never drives into you (car at ${c.x.toFixed(1)})`);
        stopped = cars.some((c) => c.x > laneX && c.x - laneX < 8 && Math.abs(c.v) < 0.3);
        await page.waitForTimeout(200);
      }
      assert.ok(stopped, 'a passing car stopped in front of you');
      await shot('traffic-stops');
      // Walk into the stopped car: it's solid.
      // Walk into the stopped car: it's solid (you slide round it, never through it).
      await page.keyboard.down('s');
      try {
        for (let i = 0; i < 10; i++) {
          await page.waitForTimeout(150);
          const me = await pos();
          for (const c of await traffic()) assert.ok(!(Math.abs(me[0] - c.x) < 2.1 && Math.abs(me[2] - c.z) < 0.9), `never inside a car (you ${me.map((n) => n.toFixed(1))}, car ${c.x.toFixed(1)},${c.z})`);
        }
      } finally { await page.keyboard.up('s'); }
      // Looking down the street from the gate; and the arch at the end of it.
      await camera(-Math.PI / 2 + 0.6, 0.25);
      await page.waitForTimeout(1200);
      await shot('street');

      const car = await store('carStore', 'return s.getState().parked.position') as number[];
      await goTo(car[0] + 1.5, car[2] - 2.6, 'return s.getState().nearbyInteractable?.targetId === "drive"', 'back at the car');
      await tap('Drive');
      await until('carStore', 'return s.getState().driving === "car_corolla"', 'at the wheel again');
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

      // Reverse back under the HOSTEL · TOWN arch: no button, straight through to town.
      await page.keyboard.down('s');
      try { await until('hostelStore', 'return s.getState().roomId === "world:funaab:hostel"', 'back in town', 80); }
      finally { await page.keyboard.up('s'); }
      await until('carStore', 'return s.getState().driving === "car_corolla" && s.getState().parked?.where === "hostel"', 'driving in town');
      await page.waitForTimeout(1500);
      await camera(Math.PI / 2 + 0.5, 0.25);
      await page.waitForTimeout(1200);
      await shot('town-arrival');
      // The TO FUNAAB arch works at the wheel too: a car just past it (west) goes through to campus
      // as soon as you drive it. (Reversing there would bump the passing car waiting behind you.)
      await tap('Park & get out');
      await until('carStore', 'return !s.getState().driving', 'parked');
      await store('carStore', `s.setState({ parked: { ...s.getState().parked, position: [${TOWN_LINK.town.exit[0] - 1}, 0, ${TOWN_LINK.town.exit[2]}] } }); s.getState().enter()`);
      await until('hostelStore', 'return s.getState().roomId === "world:funaab:main"', 'drove through the town arch');
      await until('carStore', 'return s.getState().driving === "car_corolla" && !s.getState().parked?.where', 'at the wheel on campus');
      await page.waitForTimeout(1500);
      await page.keyboard.down('s');
      try { await until('hostelStore', 'return s.getState().roomId === "world:funaab:hostel"', 'back in town again', 80); }
      finally { await page.keyboard.up('s'); }
      await until('carStore', 'return s.getState().driving === "car_corolla"', 'still at the wheel');
      await page.waitForTimeout(1500);
      // Park on the street and walk the road on foot.
      await tap('Park & get out');
      await until('carStore', 'return !s.getState().driving && s.getState().parked?.where === "hostel"', 'parked on the street');
      await goTo(TOWN_LINK.town.exit[0] + 4, TOWN_LINK.town.exit[2] + 4, `return s.getState().myPosition[0] > ${TOWN_LINK.town.exit[0] + 3}`, 'by the arch on foot');
      await camera(Math.PI / 2, 0.2);
      await page.waitForTimeout(1500);
      await shot('arch');
      // Walk under the arch (west): straight through to campus.
      await store('hostelStore', `s.setState({ teleport: [${TOWN_LINK.town.exit[0] - 1}, 0, ${TOWN_LINK.town.exit[2] + 4}] })`);
      await until('hostelStore', 'return s.getState().roomId === "world:funaab:main"', 'walked to campus');
      const arrived = await pos();
      assert.ok(Math.hypot(arrived[0] - TOWN_LINK.campus.arriveFoot[0], arrived[2] - TOWN_LINK.campus.arriveFoot[2]) < 1.5, `on foot you come out on the gate road (${arrived})`);
      await until('carStore', 'return !s.getState().driving && s.getState().parked?.where === "hostel"', 'the car stays in town');

      assert.deepEqual(errors, []);
      console.log('HOSTEL TOWN BROWSER PASSED: car homes to the hostel garage, chairs and bench seat you, drive in the town, passing cars stop and are solid, driving under the arches takes you to campus and back at the wheel, walking under the town arch takes you to campus.');
    } finally { await context.close(); }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
