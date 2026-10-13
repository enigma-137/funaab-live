// Shared Playwright harness: a signed-in student on a phone-sized page, with Supabase and the
// Worker socket mocked. Start Vite with `npm run test:vite` (fresh: hot reload splits store
// instances). It pins the socket to the local mock and turns analytics off, so a VITE_WS_URL or
// TraceIQ key in .env can never point test students at the real game. Set PLAYWRIGHT_MODULE /
// CHROMIUM_EXECUTABLE when Playwright's own browser isn't installed.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

export type Student = { id: string; username: string; college: string };
export const PHONES: Array<[number, number]> = [[360, 800], [390, 844], [412, 915], [430, 932]];
export const phonesUnderTest = () => PHONES.filter(([w]) => !process.env.TEST_WIDTH || w === Number(process.env.TEST_WIDTH));

export const launch = () => chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** Extra Supabase RPC/table answers, keyed by the last path segment. */
export type SupabaseMocks = Record<string, (body: any, method: string) => unknown>;

export async function openStudent(browser: any, student: Student, opts: {
  width: number; height: number; errors: string[];
  socket?: (ws: any) => void; supabase?: SupabaseMocks; journey?: Record<string, unknown>;
}) {
  const { width, height, errors } = opts;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 650, isMobile: width < 650 });
  const profile = { ...student, avatar_config: { shirtColor: '#15803d', skinColor: '#8d5524' }, onboarding_completed: true, course_id: 'FST', game_matric_number: 'FST/26/1001' };
  await context.route('https://student-test.supabase.co/**', async (route: any) => {
    const req = route.request(), url = new URL(req.url()), last = url.pathname.split('/').at(-1)!;
    let body: any = null; try { body = req.postDataJSON(); } catch { /* GET */ }
    let data: any = [];
    if (url.pathname.includes('/auth/')) data = { user: { id: student.id, email: 'test@example.invalid' } };
    if (last === 'profiles') data = profile;
    if (last === 'ensure_student_journey' || last === 'student_journeys')
      data = [{ beta_player: false, draft: {}, orientation_steps: [], orientation_completed: true, admission_story_completed: true, ...opts.journey }];
    if (last === 'ensure_player_wallet') data = { success: true, balance: 7500 };
    if (last === 'wallets') data = { balance: 7500 };
    if (last === 'job_runs') data = null;
    if (opts.supabase?.[last]) data = opts.supabase[last](body, req.method());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  // Never let a test page reach real analytics.
  await context.route('https://api.traceiq.run/**', (r: any) => r.abort());
  await context.route('**/campus-summary', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ studentsOnline: 2, popular: [] }) }));
  const page = await context.newPage();
  page.on('pageerror', (e: Error) => { errors.push(`${student.username}: ${e.message}`); console.error('PAGE ERROR', e.message); });
  await page.routeWebSocket(/:8787\//, opts.socket ?? ((ws: any) => ws.onMessage((raw: string) => {
    const p = JSON.parse(raw);
    if (p.type === 'join') ws.send(JSON.stringify({ type: 'snapshot', yourConnectionId: p.player.connectionId, players: {}, kekes: {}, activeMatches: {} }));
    if (p.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: p.t }));
  })));
  const session = {
    access_token: 'fake.test.signature', refresh_token: 'fake-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
    user: { id: student.id, email: 'test@example.invalid', app_metadata: { provider: 'email' }, user_metadata: { username: student.username, college: student.college }, aud: 'authenticated', created_at: new Date().toISOString() },
  };
  await context.addInitScript((session: any) => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf(() => setTimeout(() => cb(performance.now()), 16));
    localStorage.setItem('sb-student-test-auth-token', JSON.stringify(session));
    localStorage.setItem('funaab_mobile_tutorial_seen', 'true');
    // The first-visit guided tour would cover the page; tests start as returning students.
    localStorage.setItem(`funaab:tour:v1:${session.user.id}`, 'done');
    // Software-rendered headless Chrome can freeze CSS animations mid-way; check layout at rest.
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
      document.head.appendChild(style);
    });
  }, session);
  page.setDefaultNavigationTimeout(300000);
  page.setDefaultTimeout(120000);
  await page.goto('http://127.0.0.1:5178/', { waitUntil: 'commit' });
  const target = await page.evaluate(async () => (await import('/src/game/multiplayer/networkManager.ts' as any)).networkManager.targetWsUrl);
  if (!/^ws:\/\/(127\.0\.0\.1|localhost):8787/.test(String(target)))
    throw new Error(`Refusing to run: the app would connect to ${target}, not the local mock. Start Vite with \`npm run test:vite\`.`);
  await page.getByRole('button', { name: 'Enter Campus', exact: true }).click();
  await page.waitForFunction(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().connectionStatus === 'connected');
  return { context, page };
}

/** Run `fn` against a store module inside the page (bare `/src/...` URL — needs a fresh Vite). */
export const inPage = <T>(page: any, fn: () => Promise<T>) => page.evaluate(fn);

export const overlaps = (a: any, b: any) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Bounding box once a dialog has finished animating in (two identical reads 100 ms apart). */
export async function settledBox(page: any, locator: any) {
  let last = '';
  for (let i = 0; i < 40; i++) {
    const box = await locator.boundingBox();
    const key = JSON.stringify(box && [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)]);
    if (box && key === last) return box;
    last = key;
    await page.waitForTimeout(100);
  }
  return locator.boundingBox();
}
