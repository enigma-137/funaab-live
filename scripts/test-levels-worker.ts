// Activity XP from the Worker (migration 031): played-out court 1v1s and 2v2 rallies report XP
// once per player; forfeits and CPU stand-ins never earn; players get a level refresh.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldFetch = globalThis.fetch, oldInterval = globalThis.setInterval;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  const events: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => { if (String(url).endsWith('xp_event_trusted')) events.push(JSON.parse(init.body)); return new Response('5'); }) as any;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://xp.invalid' } as any);
    const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2';
    const s = new Socket(); await w.handleSession(s, null, 'world:funaab:main');
    await s.packet({ type: 'join', player: { id: A, username: 'Ada', position: [0, 0, 0] } });
    const p1 = { userId: A, connectionId: 'a', name: 'Ada' }, p2 = { userId: B, connectionId: 'b', name: 'Bisi' };
    const court = (id: string, status: string, extra: object = {}) => ({ id, status, player1: p1, player2: p2, winnerUserId: null, endReason: null, ...extra });

    w.setCourt('basketball', court('m1', 'ACTIVE'));
    w.setCourt('basketball', court('m1', 'RESULT', { endReason: 'complete', winnerUserId: B }));
    w.setCourt('basketball', court('m1', 'RESULT', { endReason: 'complete', winnerUserId: B })); // no new transition
    await flush();
    assert.deepEqual(events.map((e) => [e.p_user, e.p_source, e.p_ref]), [
      [A, 'court_match', 'basketball:m1'], [B, 'court_match', 'basketball:m1'], [B, 'court_win', 'basketball:m1'],
    ]);
    assert(s.messages.some((m) => m.type === 'level_refresh'), 'Ada (online) is told to refresh her level');

    events.length = 0;
    w.setCourt('basketball', court('m2', 'ACTIVE'));
    w.setCourt('basketball', court('m2', 'RESULT', { endReason: 'forfeit', winnerUserId: A }));
    await flush();
    assert.equal(events.length, 0, 'forfeits earn nothing');

    const team = (...ps: object[]) => ps;
    const rally = (status: string, extra: object = {}) => ({ id: 'r1', status, teams: { home: team(p1, { userId: 'cpu-1', connectionId: '', name: 'CPU', bot: true }), away: team(p2) }, winner: null, endReason: null, ...extra });
    w.setRally(rally('ACTIVE'));
    w.setRally(rally('RESULT', { endReason: 'complete', winner: 'home' }));
    await flush();
    assert.deepEqual(events.map((e) => [e.p_user, e.p_source]).sort(), [[A, 'rally_match'], [A, 'rally_win'], [B, 'rally_match']].sort(), 'CPU stand-ins earn nothing');
    console.log('LEVELS WORKER PASSED: court and rally XP once per played-out match, winners extra, forfeits and CPUs nothing, level refresh.');
  } finally { (globalThis as any).WebSocket = oldWS; globalThis.fetch = oldFetch; globalThis.setInterval = oldInterval; }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
