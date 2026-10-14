// The Arena from the Worker: tickets only at the door while open, arcade tables need tonight's
// ticket and presence, tic-tac-toe and pool are decided here, XP once per finished game.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { ARCADE_TABLES, PARTY_HALL, hallPoint } from '../src/config/partyHall';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldFetch = globalThis.fetch, oldInterval = globalThis.setInterval, oldNow = Date.now;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  let now = Date.UTC(2026, 9, 14, 12, 0, 0); // 13:00 Lagos: closed
  Date.now = () => now;
  const calls: Array<{ name: string; body: any }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    const name = String(url).split('/').pop()!;
    const body = JSON.parse(init.body);
    calls.push({ name, body });
    if (name === 'party_entry_trusted') return new Response(JSON.stringify({ night: '2026-10-14', charged: calls.filter((c) => c.name === name && c.body.p_user === body.p_user).length === 1 }));
    return new Response('4');
  }) as any;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://party.invalid' } as any);
    const join = async (id: string, name: string) => {
      const s = new Socket(); await w.handleSession(s, null, 'world:funaab:main');
      await s.packet({ type: 'join', player: { id, username: name, position: [0, 0, 0] } });
      return { socket: s, session: w.sessions.get(s) };
    };
    const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2';
    const ada = await join(A, 'Ada'), bisi = await join(B, 'Bisi');
    const at = (who: any, p: readonly number[]) => { who.session.trustedPosition = [...p]; who.session.claimedPosition = [...p]; };
    const send = async (who: any, type: string, p: object) => {
      await who.socket.packet({ type, requestId: crypto.randomUUID(), ...p });
      return who.socket.messages.filter((m: any) => m.type === 'action_result').at(-1);
    };
    const party = (who: any) => send(who, 'party', { op: 'enter' });
    const arcade = (who: any, p: object) => send(who, 'arcade', p);

    // Daytime: closed.
    at(ada, PARTY_HALL.entrance);
    assert.match((await party(ada)).error, /opens at 7 PM/);
    now = Date.UTC(2026, 9, 14, 20, 0, 0); // 21:00 Lagos
    at(ada, [0, 0, 0]);
    assert.match((await party(ada)).error, /door/);
    at(ada, PARTY_HALL.entrance);
    const t1 = await party(ada);
    assert.equal(t1.result.night, '2026-10-14'); assert.equal(t1.result.charged, true);
    assert(ada.socket.messages.some((m: any) => m.type === 'wallet_refresh'));
    assert.equal((await party(ada)).result.charged, false, 'second entry the same night is free');

    // Arcade: ticket + presence required.
    const t = ARCADE_TABLES.find((x) => x.id === 'ttt-1')!;
    at(bisi, t.at);
    assert.match((await arcade(bisi, { table: 'ttt-1', op: 'create' })).error, /ticket/);
    at(bisi, PARTY_HALL.entrance); await party(bisi);
    at(ada, hallPoint(0, 0));
    assert.match((await arcade(ada, { table: 'ttt-1', op: 'create' })).error, /Walk up/);
    at(ada, t.at); at(bisi, t.at);
    const game = (await arcade(ada, { table: 'ttt-1', op: 'create' })).result;
    assert.equal(game.status, 'WAITING');
    assert.equal((await arcade(bisi, { table: 'ttt-1', op: 'join', id: game.id })).result.status, 'ACTIVE');
    assert.match((await arcade(bisi, { table: 'ttt-1', op: 'move', cell: 4 })).error, /not your turn/);
    for (const [who, cell] of [[ada, 0], [bisi, 3], [ada, 1], [bisi, 4], [ada, 2]] as const) await arcade(who, { table: 'ttt-1', op: 'move', cell });
    assert.equal(w.ttt['ttt-1'].winner, 'X');
    await flush();
    const xp = calls.filter((c) => c.name === 'xp_event_trusted').map((c) => [c.body.p_user, c.body.p_source]);
    assert.deepEqual(xp.sort(), [[A, 'arcade_match'], [A, 'arcade_win'], [B, 'arcade_match']].sort());
    assert(bisi.socket.messages.some((m: any) => m.type === 'arcade_state' && m.ttt?.['ttt-1']?.winner === 'X'), 'everyone sees the board');

    // Pool: the Worker simulates the break; leaving mid-game forfeits without XP.
    const pt = ARCADE_TABLES.find((x) => x.id === 'pool')!;
    at(ada, pt.at); at(bisi, pt.at);
    const pg = (await arcade(ada, { table: 'pool', op: 'create' })).result;
    await arcade(bisi, { table: 'pool', op: 'join', id: pg.id });
    const shot = (await arcade(ada, { table: 'pool', op: 'shoot', dx: 1, dz: 0, power: 1, balls: [] })).result;
    assert.equal(shot.shots, 1); assert(shot.lastShot && shot.lastShot.by === A, 'client-sent balls ignored');
    calls.length = 0;
    bisi.socket.close(); await flush();
    assert.equal(w.pool.status, 'RESULT'); assert.equal(w.pool.endReason, 'forfeit');
    assert.equal(calls.filter((c) => c.name === 'xp_event_trusted').length, 0, 'forfeits earn nothing');

    // After 05:00 the ticket no longer works.
    now = Date.UTC(2026, 9, 15, 4, 30, 0);
    at(ada, t.at);
    assert.match((await arcade(ada, { table: 'ttt-1', op: 'create' })).error, /closed/);
    console.log('PARTY WORKER PASSED: hours, door-only tickets once a night, ticket + presence at tables, server-decided tic-tac-toe and pool, XP once, forfeits, closing time.');
  } finally { (globalThis as any).WebSocket = oldWS; globalThis.fetch = oldFetch; globalThis.setInterval = oldInterval; Date.now = oldNow; }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
