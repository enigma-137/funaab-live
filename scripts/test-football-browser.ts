// Two phones, one pitch: solo practice, a full 1v1 penalty challenge and Love Garden seating,
// driven through the real UI at 360/390/412/430 widths. Supabase and the Worker socket are mocked;
// the mock socket runs the same shared football rules the Worker uses.
// Run: Vite on 127.0.0.1:5178 with VITE_SUPABASE_URL=https://student-test.supabase.co, then
//   PLAYWRIGHT_MODULE=playwright-core CHROMIUM_EXECUTABLE=<chrome> npx tsx scripts/test-football-browser.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  createLobby, createChallenge, joinChallenge, cancelChallenge, takeMatchShot, takePracticeShot, leaveMatch, voteRematch,
  isFootballError, type FootballMatchState,
} from '../src/config/football';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/football', 'screenshots');
fs.mkdirSync(out, { recursive: true });

type Student = { id: string; username: string; college: string };
const JAMES: Student = { id: '00000000-0000-4000-8000-0000000000a1', username: 'James', college: 'COLENG' };
const SARAH: Student = { id: '00000000-0000-4000-8000-0000000000b2', username: 'Sarah', college: 'COLFHEC' };

async function run(width: number, height: number, browsers: { james: any; sarah: any }) {
  // ── Mock Worker: relays presence, owns the pitch with the shared rules ────────────────────
  let pitch: FootballMatchState = createLobby(Date.now());
  const sockets = new Map<string, { ws: any; student: Student; connectionId: string; player: any }>();
  const footballPackets: any[] = [];
  const broadcast = (msg: object, except?: string) => { for (const [id, s] of sockets) if (id !== except) s.ws.send(JSON.stringify(msg)); };
  const server = (student: Student) => (ws: any) => {
    ws.onMessage((raw: string) => {
      const p = JSON.parse(raw);
      if (p.type === 'join') {
        const player = { ...p.player, id: student.id, connectionId: p.player.connectionId, lastUpdated: Date.now() };
        sockets.set(student.id, { ws, student, connectionId: p.player.connectionId, player });
        const others = Object.fromEntries([...sockets.values()].filter((s) => s.student.id !== student.id).map((s) => [s.connectionId, s.player]));
        ws.send(JSON.stringify({ type: 'snapshot', yourConnectionId: p.player.connectionId, players: others, kekes: {}, activeMatches: {}, football: pitch }));
        broadcast({ type: 'player_joined', player }, student.id);
      }
      if (p.type === 'move') {
        const s = sockets.get(student.id)!;
        Object.assign(s.player, { position: p.position, rotation: p.rotation, animation: p.animation });
        broadcast({ type: 'players_batch', updates: { [s.connectionId]: { ...s.player } } }, student.id);
      }
      if (p.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: p.t }));
      if (p.type === 'football') {
        footballPackets.push(p);
        const me = { userId: student.id, connectionId: sockets.get(student.id)!.connectionId, name: student.username };
        const now = Date.now(), shot = { aim: p.aim, power: p.power };
        const next =
          p.op === 'practice' ? takePracticeShot(pitch, me, shot, Math.random, now)
          : p.op === 'create' ? createChallenge(pitch, me, crypto.randomUUID(), now)
          : p.op === 'join' ? joinChallenge(pitch, me, p.matchId, now)
          : p.op === 'cancel' ? cancelChallenge(pitch, me.userId, now)
          : p.op === 'shoot' ? takeMatchShot(pitch, me.userId, shot, Math.random, now)
          : p.op === 'rematch' ? voteRematch(pitch, me.userId, now, crypto.randomUUID())
          : p.op === 'leave' ? leaveMatch(pitch, me.userId, now) ?? pitch
          : pitch;
        if (isFootballError(next)) { ws.send(JSON.stringify({ type: 'action_result', requestId: p.requestId, error: next.error })); return; }
        pitch = next;
        broadcast({ type: 'football_state', football: pitch });
        ws.send(JSON.stringify({ type: 'action_result', requestId: p.requestId, result: pitch }));
      }
    });
  };

  const errors: string[] = [];
  // One browser per phone: a background tab would pause its render loop.
  const open = async (student: Student) => {
    const browser = student === JAMES ? browsers.james : browsers.sarah;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
    const profile = { ...student, avatar_config: { shirtColor: '#15803d', skinColor: '#8d5524' }, onboarding_completed: true, course_id: 'FST', game_matric_number: 'FST/26/1001' };
    await context.route('https://student-test.supabase.co/**', async (route: any) => {
      const url = new URL(route.request().url());
      let data: any = [];
      if (url.pathname.includes('/auth/')) data = { user: { id: student.id, email: 'test@example.invalid' } };
      if (url.pathname.endsWith('/profiles')) data = profile;
      if (url.pathname.endsWith('/ensure_student_journey') || url.pathname.endsWith('/student_journeys'))
        data = [{ beta_player: false, draft: {}, orientation_steps: [], orientation_completed: true, admission_story_completed: true }];
      if (url.pathname.endsWith('/ensure_player_wallet')) data = { success: true, balance: 7500 };
      if (url.pathname.endsWith('/wallets')) data = { balance: 7500 };
      if (url.pathname.endsWith('/job_runs')) data = null;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await context.route('**/campus-summary', (r: any) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ studentsOnline: 2, popular: [] }) }));
    const page = await context.newPage();
    page.on('pageerror', (e: Error) => { errors.push(`${student.username}: ${e.message}`); console.error('PAGE ERROR', e.message); });
    await page.routeWebSocket(/:8787\//, server(student));
    const session = {
      access_token: 'fake.test.signature', refresh_token: 'fake-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: student.id, email: 'test@example.invalid', app_metadata: { provider: 'email' }, user_metadata: { username: student.username, college: student.college }, aud: 'authenticated', created_at: new Date().toISOString() },
    };
    await context.addInitScript((session: any) => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => raf(() => setTimeout(() => cb(performance.now()), 16));
      localStorage.setItem('sb-student-test-auth-token', JSON.stringify(session));
      localStorage.setItem('funaab_mobile_tutorial_seen', 'true');
      localStorage.setItem(`funaab:tour:v1:${session.user.id}`, 'done');
    }, session);
    page.setDefaultNavigationTimeout(300000);
    page.setDefaultTimeout(120000);
    await page.goto('http://127.0.0.1:5178/', { waitUntil: 'commit' });
    await page.getByRole('button', { name: 'Enter Campus', exact: true }).click();
    await page.waitForFunction(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().connectionStatus === 'connected');
    return { context, page };
  };
  const teleport = (page: any, to: number[]) => page.evaluate(async (to: number[]) => {
    const { useHostelStore } = await import('/src/stores/hostelStore.ts' as any);
    useHostelStore.setState({ teleport: to });
  }, to);
  const nearbyType = (page: any) => page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().nearbyInteractable?.type);
  /** Teleport (retrying: entering campus can place the student at spawn a moment later) until `type` is offered. */
  const goTo = async (page: any, to: number[], type: string) => {
    for (let i = 0; i < 40; i++) {
      await teleport(page, to);
      await page.waitForTimeout(400);
      if ((await nearbyType(page)) === type) return;
    }
    const debug = await page.evaluate(async () => {
      const { useGameStore } = await import('/src/stores/gameStore.ts' as any); const { useHostelStore } = await import('/src/stores/hostelStore.ts' as any);
      const g = useGameStore.getState(), h = useHostelStore.getState();
      return { myPosition: g.myPosition, pendingTeleport: h.teleport, roomId: h.roomId, activeModal: g.activeModal, seatedAt: g.seatedAt, canvas: !!document.querySelector('canvas') };
    });
    assert.fail(`never reached a ${type} interaction at ${to}: ${JSON.stringify(debug)}`);
  };
  const sheet = (page: any) => page.getByRole('dialog', { name: 'Penalty Challenge' });
  /** Drag the aim pad to `aim`, then hold SHOOT for `holdMs` and release. */
  const shoot = async (page: any, aim: number, holdMs: number) => {
    const pad = await sheet(page).getByRole('slider', { name: 'Aim left or right' }).boundingBox();
    await page.mouse.move(pad.x + pad.width * (aim + 1) / 2, pad.y + pad.height / 2);
    await page.mouse.down(); await page.mouse.up();
    const btn = sheet(page).getByRole('button', { name: /Hold to power|Practice Shot/ });
    await btn.waitFor();
    assert(await btn.isEnabled(), 'shoot button enabled');
    const b = await btn.boundingBox();
    assert(b.y + b.height <= height && b.y >= 0 && b.x >= 0 && b.x + b.width <= width, 'SHOOT is fully on screen');
    assert(b.height >= 44, 'SHOOT is a comfortable tap target');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down(); await page.waitForTimeout(holdMs); await page.mouse.up();
  };
  const scoreText = (page: any) => sheet(page).locator('.fb-score').innerText();

  const james = await open(JAMES);
  const sarah = await open(SARAH);
  try {
    // ── Solo practice ─────────────────────────────────────────────────────────────────────
    await goTo(james.page, [-100.8, 0, -9], 'football');
    await james.page.getByRole('button', { name: 'Penalty', exact: true }).tap();
    const jSheet = sheet(james.page);
    await jSheet.waitFor();
    const box = await jSheet.boundingBox();
    assert(box.width <= width - 16 && box.height <= height * 0.5, `sheet stays compact (${Math.round(box.width)}×${Math.round(box.height)})`);
    for (let i = 0; i < 2; i++) {
      const before = footballPackets.length;
      await shoot(james.page, 0.5, 520);
      await james.page.waitForTimeout(300);
      if (i === 0) await james.page.screenshot({ path: path.join(out, `football-${width}-practice-flight.png`) });
      const packet = footballPackets[before];
      assert.equal(packet.op, 'practice');
      assert.deepEqual(Object.keys(packet).sort(), ['aim', 'op', 'power', 'requestId', 'type'], 'only aim + power leave the phone');
      assert(packet.aim > 0.3 && packet.aim < 0.7 && packet.power > 0 && packet.power <= 1);
      await jSheet.locator('.fb-verdict').waitFor();
      assert.match(await jSheet.locator('.fb-verdict').innerText(), /GOAL!|SAVED|MISS|POST!/);
      if (i === 0) await james.page.screenshot({ path: path.join(out, `football-${width}-practice-result.png`) });
      await james.page.waitForTimeout(2600); // ball resets; practice cooldown
    }

    // ── 1v1 challenge ─────────────────────────────────────────────────────────────────────
    await jSheet.getByRole('button', { name: 'Create Football Challenge' }).tap();
    await jSheet.getByText('Waiting for a challenger…').waitFor();
    await goTo(sarah.page, [-98.5, 0, -8.6], 'football');
    await sarah.page.getByRole('button', { name: 'Penalty', exact: true }).tap();
    const sSheet = sheet(sarah.page);
    await sSheet.getByText('@James wants a 1v1').waitFor();
    await sSheet.getByRole('button', { name: 'Join', exact: true }).tap();
    await jSheet.locator('.fb-score').waitFor();
    await sSheet.locator('.fb-score').waitFor();
    await jSheet.getByText(/Your shot/).waitFor();
    await sSheet.getByText(/@James is shooting/).waitFor();
    assert.equal(await sSheet.getByRole('button', { name: 'Hold to power' }).count(), 0, 'no controls out of turn');
    await james.page.screenshot({ path: path.join(out, `football-${width}-1v1-james.png`) });
    await sarah.page.screenshot({ path: path.join(out, `football-${width}-1v1-sarah.png`) });

    for (let i = 0; i < 6; i++) {
      const shooter = i % 2 === 0 ? james : sarah;
      const before = pitch.shotSeq;
      await sheet(shooter.page).getByText(/Your shot/).waitFor();
      await shoot(shooter.page, i % 2 === 0 ? 0.55 : -0.5, 480);
      await new Promise<void>((r) => { const t = setInterval(() => { if (pitch.shotSeq > before) { clearInterval(t); r(); } }, 50); });
      await james.page.waitForTimeout(500);
      assert.equal(await scoreText(james.page).then((t: string) => t.replace(/You/g, '@James')), await scoreText(sarah.page).then((t: string) => t.replace(/You/g, '@Sarah')), 'both phones show the same score');
    }
    await jSheet.getByText('FOOTBALL CHALLENGE').waitFor();
    await sSheet.getByText('FOOTBALL CHALLENGE').waitFor();
    const jWin = await jSheet.locator('.fb-winner').innerText(), sWin = await sSheet.locator('.fb-winner').innerText();
    const a = pitch.score[JAMES.id], b = pitch.score[SARAH.id];
    if (a === b) assert(jWin.includes('draw') && sWin.includes('draw'));
    else if (a > b) assert(jWin.includes('You win') && sWin.includes('@James wins'));
    else assert(sWin.includes('You win') && jWin.includes('@Sarah wins'));
    await james.page.screenshot({ path: path.join(out, `football-${width}-result.png`) });

    // Rematch: both press Play Again → new match, Sarah shoots first.
    await jSheet.getByRole('button', { name: 'Play Again' }).tap();
    await sSheet.getByText('@James wants a rematch').waitFor();
    await sSheet.getByRole('button', { name: 'Play Again' }).tap();
    await sSheet.getByText(/Your shot/).waitFor();
    await jSheet.getByText(/@Sarah is shooting/).waitFor();

    // Sarah walks off mid-rematch (closes the app): James wins on forfeit and can leave cleanly.
    await sarah.page.evaluate(async () => (await import('/src/stores/footballStore.ts' as any)).useFootballStore.getState().act('leave'));
    await jSheet.getByText(/opponent left the pitch/).waitFor();
    await jSheet.getByRole('button', { name: 'Leave' }).tap();
    await jSheet.waitFor({ state: 'hidden' });
    assert.equal(pitch.status, 'LOBBY', 'pitch is free again');
    await sarah.page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().setActiveModal(null));

    // ── Love Garden ───────────────────────────────────────────────────────────────────────
    const seats = await james.page.evaluate(async () => (await import('/src/config/campusWorld.ts' as any)).default.interactables.filter((i: any) => i.id.startsWith('love-garden-seat-')).map((i: any) => i.position));
    await goTo(james.page, [seats[0][0] + 0.2, 0, seats[0][2] + 0.2], 'bench');
    await james.page.getByRole('button', { name: 'Sit', exact: true }).tap();
    await james.page.getByRole('button', { name: 'Stand Up', exact: true }).waitFor();
    // Sarah sees James sitting, then sits on the next seat (James's seat is not offered to her).
    await sarah.page.waitForFunction(async (id: string) => {
      const { useGameStore } = await import('/src/stores/gameStore.ts' as any);
      return Object.values(useGameStore.getState().players).some((p: any) => p.id === id && p.animation === 'sit');
    }, JAMES.id);
    await teleport(sarah.page, [seats[0][0], 0, seats[0][2]]);
    await sarah.page.waitForTimeout(600);
    const offered = await sarah.page.evaluate(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().nearbyInteractable?.id);
    assert.notEqual(offered, 'love-garden-seat-0-0', 'an occupied seat is not offered');
    await goTo(sarah.page, [seats[1][0], 0, seats[1][2]], 'bench');
    await sarah.page.getByRole('button', { name: 'Sit', exact: true }).tap();
    await sarah.page.getByRole('button', { name: 'Stand Up', exact: true }).waitFor();
    await james.page.waitForFunction(async (id: string) => {
      const { useGameStore } = await import('/src/stores/gameStore.ts' as any);
      return Object.values(useGameStore.getState().players).some((p: any) => p.id === id && p.animation === 'sit');
    }, SARAH.id);
    await james.page.getByText('2 students here').waitFor();
    const stand = await sarah.page.getByRole('button', { name: 'Stand Up', exact: true }).boundingBox();
    assert(stand.y + stand.height <= height && stand.x + stand.width <= width, 'Stand Up is on screen');
    // Look back across the ring at the tree for the screenshot.
    await james.page.evaluate(async () => { const { useInputStore } = await import('/src/stores/inputStore.ts' as any); useInputStore.getState().setCameraYaw(Math.PI / 2); useInputStore.getState().setCameraPitch(0.45); });
    await james.page.waitForTimeout(800);
    await james.page.screenshot({ path: path.join(out, `love-garden-${width}-james.png`) });
    await sarah.page.screenshot({ path: path.join(out, `love-garden-${width}-sarah.png`) });
    await sarah.page.getByRole('button', { name: 'Stand Up', exact: true }).tap();
    await james.page.getByRole('button', { name: 'Stand Up', exact: true }).tap();
    for (const p of [james.page, sarah.page]) {
      await p.waitForFunction(async () => (await import('/src/stores/gameStore.ts' as any)).useGameStore.getState().seatedAt === null);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal scroll');
    }
    assert.deepEqual(errors, []);
    console.log(`FOOTBALL + LOVE GARDEN BROWSER PASSED ${width}x${height} (final 1v1 ${a}-${b})`);
  } catch (e) {
    await james.page.screenshot({ path: path.join(out, `failure-${width}-james.png`) }).catch(() => {});
    await sarah.page.screenshot({ path: path.join(out, `failure-${width}-sarah.png`) }).catch(() => {});
    throw e;
  } finally {
    await james.context.close();
    await sarah.context.close();
  }
}

(async () => {
  const launch = () => chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const browsers = { james: await launch(), sarah: await launch() };
  try {
    for (const [w, h] of [[360, 800], [390, 844], [412, 915], [430, 932]].filter(([w]) => !process.env.TEST_WIDTH || w === Number(process.env.TEST_WIDTH)))
      await run(w, h, browsers);
  } finally { await browsers.james.close(); await browsers.sarah.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
