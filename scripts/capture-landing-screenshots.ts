// Captures the in-game screenshots shown on the landing page (public/images/screens/*.jpg).
// Start Vite with `npm run test:vite`, then run `npm run screens:landing`.
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent } from './browserHarness';
import { CAMPUS_ENTRY_POSITION } from '../src/config/studentJourney';

const out = path.resolve('public/images/screens');
fs.mkdirSync(out, { recursive: true });
const me = { id: '00000000-0000-4000-8000-0000000000f1', username: 'Tolu', college: 'COLENG' };
const [sx, , sz] = CAMPUS_ENTRY_POSITION;
const classmates: Array<[string, string, number, number, string, string]> = [
  ['Ada', 'COLFHEC', 2.2, -3.5, '#7c3aed', '#8d5524'],
  ['Bola', 'COLENG', -2.4, -4.2, '#dc2626', '#5c3a1e'],
  ['Chidi', 'COLVET', 0.8, -7.5, '#2563eb', '#a0673f'],
  ['Zainab', 'COLAMRUD', -4.5, -9, '#f59e0b', '#6b4226'],
];
const socket = (ws: any) => ws.onMessage((raw: string) => {
  const p = JSON.parse(raw);
  if (p.type === 'join') ws.send(JSON.stringify({ type: 'snapshot', yourConnectionId: p.player.connectionId, kekes: {}, activeMatches: {}, players: Object.fromEntries(
    classmates.map(([username, college, dx, dz, shirtColor, skinColor], i) => [`c-${username}`, {
      id: `00000000-0000-4000-8000-0000000001${i}0`, connectionId: `c-${username}`, username, college,
      position: [sx + dx, 0, sz + dz], rotation: Math.atan2(-dx, -dz) + Math.PI, animation: 'idle', avatarConfig: { shirtColor, skinColor },
    }])) }));
  if (p.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: p.t }));
});

const store = (page: any, mod: string, fn: string, ...args: unknown[]) =>
  page.evaluate(async ([m, f, a]: [string, string, unknown[]]) => {
    const exported = await import(`/src/stores/${m}.ts` as any);
    const hook = Object.values(exported).find((v: any) => typeof v?.getState === 'function') as any;
    return hook.getState()[f](...a);
  }, [mod, fn, args]);

const shot = async (page: any, name: string) => {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `${name}.jpg`), type: 'jpeg', quality: 78 });
  console.log('saved', name);
};

async function open(browser: any, width: number, height: number) {
  const errors: string[] = [];
  const opened = await openStudent(browser, me, { width, height, errors, socket, supabase: { car_garage: () => ({ cars: [] }) } });
  const { page } = opened;
  // A returning student: no first-day card, no developer button.
  await page.getByText('I know my way, hide this').click().catch(() => {});
  await page.addStyleTag({ content: 'button[title^="Toggle Dev"]{display:none!important}' });
  // Daylight whatever the clock in Lagos says (`?time=day`), and a three-quarter camera angle.
  await page.evaluate(async () => {
    history.replaceState(null, '', '/?time=day');
    (await import('/src/game/world/dayNight.ts' as any)).useDayNight.setState({ night: 0 });
    (await import('/src/stores/inputStore.ts' as any)).useInputStore.setState({ cameraYaw: 0.35, cameraPitch: 0.22 });
    (await import('/src/stores/socialStore.ts' as any)).useSocialStore.setState({ friends: [
      { id: '00000000-0000-4000-8000-000000000100', username: 'Ada', college: 'COLFHEC', status: 'accepted' },
      { id: '00000000-0000-4000-8000-000000000110', username: 'Bola', college: 'COLENG', status: 'accepted' },
      { id: '00000000-0000-4000-8000-000000000120', username: 'Chidi', college: 'COLVET', status: 'accepted' },
    ] });
  });
  await page.waitForTimeout(6000);
  return opened;
}

(async () => {
  const browser = await launch();
  try {
    {
      const { context, page } = await open(browser, 1280, 760);
      await shot(page, 'campus-wide');
      await context.close();
    }
    {
      const { context, page } = await open(browser, 390, 844);
      await shot(page, 'campus');
      await store(page, 'gameStore', 'setActiveModal', 'campus_map');
      await shot(page, 'map');
      await store(page, 'gameStore', 'setActiveModal', 'friends');
      await shot(page, 'friends');
      await store(page, 'gameStore', 'setActiveModal', 'earn');
      await shot(page, 'earn');
      await store(page, 'gameStore', 'setActiveModal', 'keke_destination');
      await shot(page, 'keke');
      await context.close();
    }
  } finally {
    await browser.close();
  }
})();
