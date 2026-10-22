// Home kitchen on a phone: in your room, cook jollof (the pot steams), it's served on the Small Table
// for everyone in the room, and you can eat it. Start Vite with `npm run test:vite`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest } from './browserHarness';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/home-kitchen', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const ME = { id: '00000000-0000-4000-8000-0000000000c1', username: 'Kemi', college: 'COLFHEC' };

(async () => {
  const browser = await launch();
  try {
    const [width, height] = phonesUnderTest()[0];
    const errors: string[] = [];
    const calls: Array<[string, any]> = [];
    const served: { served_food: string | null; served_drink: string | null } = { served_food: null, served_drink: null };
    const snapshot = () => ({
      room: { owner_id: ME.id, privacy: 'friends', tv_on: false, rested_at: null, security_at: null, style: 'resumption', ...served },
      placements: [
        { owner_id: ME.id, item_id: 'hostel_table', anchor: null, x: 1.2, y: 0, z: 0.4, rotation: 0, active: false },
        { owner_id: ME.id, item_id: 'hostel_chair', anchor: null, x: 1.2, y: 0, z: 1.4, rotation: 180, active: false },
        { owner_id: ME.id, item_id: 'hostel_cooker', anchor: null, x: 2.9, y: 0, z: -2.9, rotation: 0, active: false },
      ],
      owner_name: ME.username,
    });
    const supabase = {
      car_garage: () => ({ cars: [] }),
      hostel_command: () => ({ success: true }),
      hostel_snapshot: () => snapshot(),
      inventory: () => [
        { id: 'i1', item_id: 'hostel_food_rice', quantity: 2 },
        { id: 'i2', item_id: 'hostel_food_water', quantity: 1 },
        { id: 'i3', item_id: 'hostel_pot', quantity: 1 },
      ],
      hostel_kitchen: (body: any) => {
        calls.push([body.p_action, body.p_data]);
        const dish = body.p_data.item;
        if (body.p_action === 'serve') served[dish === 'hostel_food_water' ? 'served_drink' : 'served_food'] = dish;
        else served[body.p_data.slot === 'drink' ? 'served_drink' : 'served_food'] = null;
        return { success: true, owner: ME.id, snapshot: snapshot() };
      },
    };
    const { context, page } = await openStudent(browser, ME, { width, height, errors, supabase });
    try {
      // waitForFunction treats an async predicate's promise as truthy, so poll the store instead.
      const until = async (fn: string, what: string) => {
        for (let i = 0; i < 100; i++) { if (await hostel(fn)) return; await page.waitForTimeout(200); }
        throw new Error(`timed out: ${what}`);
      };
      const hostel = (fn: string) => page.evaluate(async (f: string) => {
        const { useHostelStore } = await import('/src/stores/hostelStore.ts' as any);
        return new Function('s', f)(useHostelStore);
      }, fn);
      await hostel('return s.getState().travel("room")');
      await until('return String(s.getState().roomId).startsWith("world:funaab:hostel-room:")', 'in the room');
      // Stand by the table and look at it.
      await hostel('s.setState({ teleport: [1.2, 0, 2.6] })');
      await page.evaluate(async () => { const { useInputStore } = await import('/src/stores/inputStore.ts' as any); useInputStore.setState({ cameraYaw: 0.15, cameraPitch: 0.45 }); });
      await page.waitForTimeout(2500);

      // Kitchen tab: jollof can be cooked (pot in the bag, cooker placed, table placed).
      await hostel('s.setState({ panel: "kitchen" })');
      await page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().setActiveModal('hostel'));
      const panel = page.getByRole('dialog', { name: 'Hostel life' });
      await panel.getByText('Nothing yet. The table is waiting.').waitFor();
      const cook = panel.getByRole('button', { name: 'Cook jollof' });
      assert(await cook.isEnabled(), 'jollof can be cooked');
      assert(!(await panel.getByRole('button', { name: 'Cook spaghetti' }).isEnabled()), 'no spaghetti in the bag');
      await panel.screenshot({ path: path.join(out, `kitchen-${width}-panel.png`) });
      await cook.click();
      await page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().setActiveModal(null));
      await hostel('s.setState({ teleport: [2.2, 0, -1.2] })');
      await page.evaluate(async () => { const { useInputStore } = await import('/src/stores/inputStore.ts' as any); useInputStore.setState({ cameraYaw: -0.5, cameraPitch: 0.4 }); });
      await page.waitForTimeout(1800);
      assert(await hostel('return !!s.getState().cooking'), 'the pot is on the fire');
      await page.screenshot({ path: path.join(out, `kitchen-${width}-cooking.png`) });
      await until('return s.getState().snapshot?.room?.served_food === "hostel_food_rice" && !s.getState().busy', 'jollof served');
      assert.deepEqual(calls[0], ['serve', { item: 'hostel_food_rice', owner: ME.id }]);

      // Serve water too, then look at the plated table.
      await hostel('return s.getState().kitchen("serve", { item: "hostel_food_water" })');
      await hostel('s.setState({ teleport: [1.2, 0, 2.2], notice: null })');
      await page.evaluate(async () => { const { useInputStore } = await import('/src/stores/inputStore.ts' as any); useInputStore.setState({ cameraYaw: 0.1, cameraPitch: 0.55 }); });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(out, `kitchen-${width}-served.png`) });

      // Tap the table: Eat and Drink are right there.
      await hostel('s.setState({ selected: "hostel_table" })');
      const bar = page.getByRole('region', { name: 'Furniture actions' });
      await bar.getByRole('button', { name: 'Eat Jollof rice' }).click();
      await until('return s.getState().snapshot?.room?.served_food === null && !s.getState().busy', 'plate cleared');
      assert.deepEqual(calls.at(-1), ['eat', { slot: 'food', owner: ME.id }]);
      assert(await bar.getByRole('button', { name: 'Drink Cold water' }).isVisible(), 'the water is still there');
      assert.deepEqual(errors, []);
      console.log('home kitchen browser: ok');
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
