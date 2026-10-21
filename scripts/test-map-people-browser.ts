// The campus map on a phone shows other students (friends named), "Find" in Friends opens the map
// on that friend, and "Walk there" sets them as the destination. Start Vite with `npm run test:vite`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest } from './browserHarness';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/map-people', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const me = { id: '00000000-0000-4000-8000-0000000000e1', username: 'Denarius', college: 'COLANIM' };
const other = (id: string, username: string, position: number[], extra = {}) =>
  ({ id, connectionId: `c-${username}`, username, college: 'COLENG', position, rotation: 0, animation: 'idle', avatarConfig: { shirtColor: '#15803d', skinColor: '#8d5524' }, ...extra });

(async () => {
  const browser = await launch();
  try {
    const [width, height] = phonesUnderTest()[0];
    const errors: string[] = [];
    const socket = (ws: any) => ws.onMessage((raw: string) => {
      const p = JSON.parse(raw);
      if (p.type === 'join') ws.send(JSON.stringify({ type: 'snapshot', yourConnectionId: p.player.connectionId, kekes: {}, activeMatches: {}, players: {
        'c-Ada': other('00000000-0000-4000-8000-0000000000e2', 'Ada', [40, 0, 10]),
        'c-Bola': other('00000000-0000-4000-8000-0000000000e3', 'Bola', [-60, 0, 50]),
        'c-Chi': other('00000000-0000-4000-8000-0000000000e4', 'Chi', [5, 0, 5], { currentLectureId: 'fst-101' }),
      } }));
      if (p.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: p.t }));
    });
    const { context, page } = await openStudent(browser, me, { width, height, errors, socket, supabase: { car_garage: () => ({ cars: [] }) } });
    try {
      await page.evaluate(async () => {
        const { useSocialStore } = await import('/src/stores/socialStore.ts' as any);
        useSocialStore.setState({ friends: [{ id: '00000000-0000-4000-8000-0000000000e3', username: 'Bola', college: 'COLENG', status: 'accepted' }] });
      });
      await page.waitForFunction(async () => Object.keys((await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().players).length >= 3);

      // Friends list → Find on map.
      await page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().setActiveModal('friends'));
      const find = page.getByRole('button', { name: /Find/ });
      await find.waitFor();
      const row = await page.getByRole('dialog').boundingBox();
      for (const name of [/Find/, /DM/, /Send/, 'Remove Friend']) {
        const btn = await page.getByRole('dialog').getByRole('button', { name }).first().boundingBox();
        assert(btn!.x >= row!.x && btn!.x + btn!.width <= row!.x + row!.width + 1, `${name} fits in the friends row`);
      }
      await page.screenshot({ path: path.join(out, `map-${width}-friends-list.png`) });
      await find.click();
      await page.getByText('2 on campus').waitFor();
      assert(await page.getByText('· 1 friend').isVisible(), 'friend count');
      assert(await page.getByRole('button', { name: 'Friend @Bola' }).count(), 'friend pin');
      assert(await page.getByRole('button', { name: 'Student @Ada' }).count(), 'student dot');
      assert.equal(await page.getByRole('button', { name: /@Chi/ }).count(), 0, 'students in a lecture hall are hidden');
      await page.getByRole('heading', { name: '@Bola' }).waitFor();
      // The map is centred on the friend's pin.
      await page.waitForTimeout(300);
      const pin = await page.getByRole('button', { name: 'Friend @Bola' }).boundingBox();
      const view = await page.locator('svg[viewBox="0 0 1000 880"]').evaluate((el: Element) => { const r = el.parentElement!.parentElement!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      const cx = pin!.x + pin!.width / 2, cy = pin!.y + pin!.height / 2;
      assert(Math.abs(cx - (view.x + view.width / 2)) < 40 && Math.abs(cy - (view.y + view.height / 2)) < 40, `friend centred: pin ${cx},${cy} view ${JSON.stringify(view)}`);
      await page.screenshot({ path: path.join(out, `map-${width}-friend.png`) });

      // Friends only hides the other student.
      await page.getByRole('button', { name: 'Everyone' }).click();
      assert.equal(await page.getByRole('button', { name: 'Student @Ada' }).count(), 0, 'friends only');
      await page.screenshot({ path: path.join(out, `map-${width}-friends-only.png`) });

      // Walk there.
      await page.getByRole('button', { name: 'Walk there' }).click();
      const dest = await page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().navigationDestination);
      assert.equal(dest?.name, '@Bola');
      assert.deepEqual([dest.position[0], dest.position[2]], [-60, 50]);
      assert.deepEqual(errors, []);
      console.log(`MAP PEOPLE BROWSER PASSED ${width}x${height}`);
    } catch (e) {
      await page.screenshot({ path: path.join(out, `failure-${width}.png`) }).catch(() => {});
      throw e;
    } finally { await context.close(); }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
