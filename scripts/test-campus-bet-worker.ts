// Campus Bet Worker tests: trusted inputs only, proximity, validation, fixture generation, alarm backstop.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { CAMPUS_BET_SHOP } from '../src/config/campusBet';
import { validateMatchday } from '../src/config/campusBetModel';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldFetch = globalThis.fetch, oldInterval = globalThis.setInterval, oldNow = Date.now;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  let now = oldNow(); Date.now = () => now;
  const calls: Array<{ name: string; body: any }> = [];
  const kv = new Map<string, any>(); let alarmAt: number | null = null;
  const storage = { get: async (k: string) => kv.get(k), put: async (k: string, v: any) => { kv.set(k, v); }, delete: async (k: string) => kv.delete(k),
    list: async ({ prefix }: any) => new Map([...kv].filter(([k]) => k.startsWith(prefix))), getAlarm: async () => alarmAt, setAlarm: async (t: number) => { alarmAt = t; } };
  const roundId = '20000000-0000-4000-8000-000000000001';
  let round: any = null; let settledNext = 0;
  const stateFor = () => ({ server_now: new Date(now).toISOString(), next_opens_at: new Date(now + 600000).toISOString(), current: round, my_ticket: null, last_settled: null, last_ticket: null, history: [], form: {}, settled: settledNext });
  globalThis.fetch = (async (url: any, init: any) => {
    const name = String(url).split('/').at(-1)!, body = JSON.parse(init.body);
    calls.push({ name, body });
    if (name === 'campus_bet_sync_trusted') {
      if (!round && !body.p_candidate) return new Response(JSON.stringify({ ...stateFor(), needs_round: true, recent_pairs: [['falcons', 'titans']] }));
      if (!round) {
        assert.equal(validateMatchday(body.p_candidate), null, 'Worker generates a valid matchday');
        round = { id: roundId, round_number: 7, status: 'OPEN', opens_at: new Date(now).toISOString(), closes_at: new Date(now + 600000).toISOString(), settled_at: null,
          fixtures: body.p_candidate.map((f: any) => ({ slot: f.slot, home: f.home_team_id, away: f.away_team_id, result: null, home_score: null, away_score: null })) };
      }
      const s = stateFor(); settledNext = 0; return new Response(JSON.stringify(s));
    }
    if (name === 'campus_bet_place_trusted') {
      if (calls.filter((c) => c.name === name).length > 1) return new Response(JSON.stringify({ message: 'You already have a ticket for Matchday 7' }), { status: 400 });
      return new Response(JSON.stringify({ balance: 900, ticket: {} }));
    }
    return new Response('true');
  }) as any;
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', SUPABASE_URL: 'https://bet.invalid' } as any);
    const userId = '00000000-0000-4000-8000-000000000042';
    const socket = new Socket(); await w.handleSession(socket, null, 'world:funaab:main');
    await socket.packet({ type: 'join', player: { id: userId, username: 'Punter', position: [7, 0, 78] } });
    const session = w.sessions.get(socket);
    const bet = async (payload: object) => { now += 1100; await socket.packet({ type: 'campus_bet', requestId: crypto.randomUUID(), ...payload }); return socket.messages.at(-1); };

    // Viewing works anywhere on campus and lazily creates the matchday.
    const view = await bet({ op: 'state' });
    assert.equal(view.error, undefined);
    assert.equal(view.result.current.fixtures.length, 5);
    assert.deepEqual(calls.filter((c) => c.name === 'campus_bet_sync_trusted').map((c) => c.body.p_candidate === null), [true, false]);
    const sent = calls[1].body.p_candidate;
    assert(!sent.some((f: any) => f.home_team_id === 'falcons' && f.away_team_id === 'titans' || f.home_team_id === 'titans' && f.away_team_id === 'falcons'), 'avoids the recent pairing');
    assert(!('needs_round' in view.result) && !('recent_pairs' in view.result), 'internal fields stripped');
    assert.equal(Object.keys(view.result.teams).length, 10);
    assert(!JSON.stringify(view.result).includes('hiddenBaseStrength') && !JSON.stringify(view.result).includes('probability'), 'no hidden numbers reach the client');
    assert.equal(kv.get('campus-bet-settle-at'), Date.parse(round.closes_at) + 1000, 'settlement alarm scheduled');
    assert.equal(alarmAt, Date.parse(round.closes_at) + 1000);

    // Throttle.
    await socket.packet({ type: 'campus_bet', requestId: crypto.randomUUID(), op: 'state' });
    assert.match(socket.messages.at(-1).error, /moment/);

    const picks = ['HOME', 'DRAW', 'AWAY', 'HOME', 'HOME'];
    const placeCalls = () => calls.filter((c) => c.name === 'campus_bet_place_trusted');
    // Far from the counter: rejected before touching the database.
    session.trustedPosition = [7, 0, 78];
    assert.match((await bet({ op: 'place', roundId, stake: 1000, picks })).error, /counter/);
    // Reconnect while standing at the counter: the server restarts the player at spawn.
    // Its trusted position must catch up at legal speed instead of freezing there.
    session.trustedPosition = [7, 0, 78]; session.movementBudget = 4; session.movementClock = now;
    await socket.packet({ type: 'move', position: [...CAMPUS_BET_SHOP.counter], rotation: 0, animation: 'idle' });
    now += 1000; // ~1–2 s at legal speed covers the ~33 m from spawn; the valid ticket below proves the catch-up.
    for (const [stake, p] of [[450, picks], [5100, picks], [1050, picks], ['1000', picks], [1000, picks.slice(0, 4)], [1000, ['HOME', 'WIN', 'AWAY', 'HOME', 'HOME']], [1000, 'HOME']] as const) {
      assert((await bet({ op: 'place', roundId, stake, picks: p })).error, `rejects ${JSON.stringify([stake, p])}`);
    }
    assert((await bet({ op: 'place', roundId: 'nope', stake: 1000, picks })).error);
    assert.equal(placeCalls().length, 0, 'invalid tickets never reach the database');

    // Valid ticket: only trusted identity + the three player choices are forwarded.
    const ok = await bet({ op: 'place', roundId, stake: 1000, picks, winner: 'HOME', payout: 2500, correct_count: 5, userId: 'someone-else', p_user: 'x' });
    assert.equal(ok.error, undefined);
    assert.equal(ok.result.balance, 900);
    assert.deepEqual(placeCalls()[0].body, { p_user: userId, p_round: roundId, p_stake: 1000, p_picks: picks });
    assert.match((await bet({ op: 'place', roundId, stake: 1000, picks })).error, /already have a ticket/, 'database rejection is relayed');

    // Off-campus rooms cannot bet.
    const hostel = new Socket(); await w.handleSession(hostel, null, 'world:funaab:hostel');
    await hostel.packet({ type: 'join', room: 'world:funaab:hostel', player: { id: '00000000-0000-4000-8000-000000000043', username: 'Away' } });
    await hostel.packet({ type: 'campus_bet', requestId: crypto.randomUUID(), op: 'state' });
    assert.match(hostel.messages.at(-1).error, /main gate/);

    // Alarm backstop: settles with no user and broadcasts so open shops refresh.
    now = Date.parse(round.closes_at) + 2000; round = { ...round, status: 'SETTLED' }; settledNext = 1;
    const before = calls.length;
    await w.alarm();
    const alarmSync = calls.slice(before).find((c) => c.name === 'campus_bet_sync_trusted');
    assert(alarmSync && alarmSync.body.p_user === null, 'alarm runs a user-less settlement sync');
    assert(!kv.has('campus-bet-settle-at'), 'alarm key cleared after settling');
    assert(socket.messages.some((m) => m.type === 'campus_bet_settled'), 'players in the world are told to refresh');
    console.log('CAMPUS BET WORKER PASSED: lazy secure fixture generation, repeat avoidance, hidden fields stripped, throttle, counter proximity, stake/pick validation, client fields ignored, DB errors relayed, off-campus rejection and alarm settlement.');
  } finally { Date.now = oldNow; globalThis.fetch = oldFetch; globalThis.WebSocket = oldWS; globalThis.setInterval = oldInterval; }
}
main().catch((e) => { console.error(e); process.exit(1); });
