// The gym from the Worker: passes only at the door while open, workouts need this session's pass and
// presence at the station, a set counts only after GYM.setSeconds, XP once per station per session.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { GYM, GYM_STATIONS, gymHoursLabel, gymPassKey, gymPoint } from '../src/config/gym';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  // Hours and keys first (Lagos is UTC+1).
  assert.equal(gymPassKey(Date.UTC(2026, 9, 22, 4, 59)), null, '05:59 closed');
  assert.equal(gymPassKey(Date.UTC(2026, 9, 22, 5, 0)), '2026-10-22-am', '06:00 morning');
  assert.equal(gymPassKey(Date.UTC(2026, 9, 22, 8, 59)), '2026-10-22-am', '09:59 morning');
  assert.equal(gymPassKey(Date.UTC(2026, 9, 22, 9, 0)), null, '10:00 closed');
  assert.equal(gymPassKey(Date.UTC(2026, 9, 22, 15, 0)), '2026-10-22-pm', '16:00 evening');
  assert.equal(gymPassKey(Date.UTC(2026, 9, 22, 20, 0)), null, '21:00 closed');
  assert.equal(gymHoursLabel(Date.UTC(2026, 9, 22, 11, 0)), 'Opens 4 PM');
  assert.equal(gymHoursLabel(Date.UTC(2026, 9, 22, 21, 0)), 'Opens 6 AM tomorrow');
  assert.equal(gymHoursLabel(Date.UTC(2026, 9, 22, 6, 0)), 'Open until 10 AM');

  const oldWS = globalThis.WebSocket, oldFetch = globalThis.fetch, oldInterval = globalThis.setInterval, oldNow = Date.now;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  let now = Date.UTC(2026, 9, 22, 11, 0, 0); // 12:00 Lagos: closed
  Date.now = () => now;
  const calls: Array<{ name: string; body: any }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const name = String(url).split('/').pop()!;
    const body = JSON.parse(init.body);
    calls.push({ name, body });
    if (name === 'gym_entry_trusted') return new Response(JSON.stringify({ pass: gymPassKey(now), charged: calls.filter((c) => c.name === name && c.body.p_user === body.p_user).length === 1 }));
    return new Response('6');
  }) as any;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://gym.invalid' } as any);
    const s = new Socket(); await w.handleSession(s, null, 'world:funaab:main');
    const A = '00000000-0000-4000-8000-0000000000a1';
    await s.packet({ type: 'join', player: { id: A, username: 'Ada', position: [0, 0, 0] } });
    const ada = { socket: s, session: w.sessions.get(s) };
    const at = (p: readonly number[]) => { ada.session.trustedPosition = [...p]; ada.session.claimedPosition = [...p]; };
    const gym = async (p: object) => {
      await s.packet({ type: 'gym', requestId: crypto.randomUUID(), ...p });
      return s.messages.filter((m: any) => m.type === 'action_result').at(-1);
    };
    const tm = GYM_STATIONS[0];

    at(GYM.entrance);
    assert.match((await gym({ op: 'enter' })).error, /closed/);
    now = Date.UTC(2026, 9, 22, 16, 0, 0); // 17:00 Lagos: evening session
    at([0, 0, 0]);
    assert.match((await gym({ op: 'enter' })).error, /door/);
    at(tm.spot);
    assert.match((await gym({ op: 'start', station: tm.id })).error, /pass at the door/, 'no pass, no workout');
    at(GYM.entrance);
    const p1 = await gym({ op: 'enter' });
    assert.deepEqual(p1.result, { pass: '2026-10-22-pm', charged: true });
    assert(s.messages.some((m: any) => m.type === 'wallet_refresh'));
    assert.equal((await gym({ op: 'enter' })).result.charged, false, 'second entry the same session is free');

    at(gymPoint(0, 0));
    assert.match((await gym({ op: 'start', station: tm.id })).error, /Walk up/);
    assert.match((await gym({ op: 'start', station: 'sauna' })).error, /Unknown station/);
    at(tm.spot);
    assert.equal((await gym({ op: 'start', station: tm.id })).result.station, tm.id);
    now += 5000;
    assert.match((await gym({ op: 'finish', station: tm.id })).error, /not done/, 'too early');
    now += GYM.setSeconds * 1000;
    assert.equal((await gym({ op: 'finish', station: tm.id })).result.done, true);
    assert.match((await gym({ op: 'finish', station: tm.id })).error, /Start a set/, 'a set counts once');
    await flush();
    const xp = calls.filter((c) => c.name === 'xp_event_trusted').map((c) => c.body);
    assert.deepEqual(xp, [{ p_user: A, p_source: 'gym_set', p_ref: `2026-10-22-pm:${tm.id}` }]);

    // Animations: workout poses pass through the movement whitelist.
    await s.packet({ type: 'move', position: tm.spot, rotation: 0, animation: 'jog' });
    assert.equal(w.players.get(ada.session.connectionId).animation, 'jog');
    await s.packet({ type: 'move', position: tm.spot, rotation: 0, animation: 'moonwalk' });
    assert.equal(w.players.get(ada.session.connectionId).animation, 'idle', 'unknown poses still fall back');

    // Next morning the evening pass no longer works.
    now = Date.UTC(2026, 9, 23, 6, 0, 0);
    assert.match((await gym({ op: 'start', station: tm.id })).error, /pass at the door/);
    console.log('GYM WORKER PASSED: hours, door-only pass once a session, pass + presence at stations, timed sets, XP once per station, workout poses.');
  } finally { (globalThis as any).WebSocket = oldWS; globalThis.fetch = oldFetch; globalThis.setInterval = oldInterval; Date.now = oldNow; }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
