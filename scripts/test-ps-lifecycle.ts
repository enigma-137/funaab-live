// Game Den match lifecycle on the Worker: leaving, disconnects, walking away, idle/expired
// matches and cleanup. None of these endings pay rewards.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { locationById } from '../src/config/campusLocations';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldInterval = globalThis.setInterval, oldClear = globalThis.clearInterval, oldNow = Date.now, oldFetch = globalThis.fetch;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 1; (globalThis as any).clearInterval = () => {};
  let now = oldNow(); Date.now = () => now;
  const rpcs: string[] = [];
  (globalThis as any).fetch = async (url: string) => { rpcs.push(String(url)); return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' } as any; };
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  const den = locationById('ps-room').entrance;
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true' } as any);
    let n = 0;
    const join = async (name: string, pos: number[] = [den[0], 0, den[2] + 1]) => {
      const socket = new Socket(); await w.handleSession(socket, null, 'world:funaab:main');
      const id = `00000000-0000-4000-8000-00000000000${++n}`;
      await socket.packet({ type: 'join', player: { id, username: name, position: pos } });
      const s = w.sessions.get(socket); s.trustedPosition = pos; s.claimedPosition = pos; s.movementClock = now;
      return { socket, id };
    };
    const matches = () => [...w.psMatches.values()];
    const last = (s: Socket) => s.messages.filter((m) => m.type === 'ps_match_update').at(-1)?.match;
    const start = async (a: Awaited<ReturnType<typeof join>>, b: Awaited<ReturnType<typeof join>>) => {
      await a.socket.packet({ type: 'ps_challenge_create' });
      const m = matches().find((x) => x.hostId === a.id && x.status === 'waiting');
      await b.socket.packet({ type: 'ps_challenge_join', matchId: m.id });
      return m;
    };

    // 1. Host withdraws a waiting challenge: removed for everyone.
    const ada = await join('Ada'), tobi = await join('Tobi'), sam = await join('Sam');
    await ada.socket.packet({ type: 'ps_challenge_create' });
    assert.equal(matches().length, 1);
    await ada.socket.packet({ type: 'ps_leave' });
    assert.equal(matches().length, 0, 'cancelled challenge is removed');
    assert.equal(last(tobi.socket).cancelled, true, 'others see it withdrawn');

    // 2. Leaving a running match forfeits it to the other player, with no reward call.
    let m = await start(ada, tobi);
    assert.equal(m.status, 'in_progress');
    await tobi.socket.packet({ type: 'ps_leave' });
    assert.deepEqual([m.status, m.forfeit, m.winnerName], ['finished', true, 'Ada']);
    assert.match(m.roundResult, /Tobi left the match/);
    assert.equal(rpcs.filter((u) => u.includes('ps_reward')).length, 0, 'forfeits pay nothing');
    // A finished match no longer blocks a new challenge.
    await ada.socket.packet({ type: 'ps_challenge_create' });
    const fresh = matches().find((x) => x.hostId === ada.id && x.status === 'waiting');
    assert(fresh, 'can create again after a forfeit');

    // 3. Host disconnects while waiting: challenge cancelled.
    ada.socket.close();
    assert(!matches().some((x) => x.id === fresh.id), 'disconnect withdraws the challenge');

    // 4. A player disconnects mid-match: forfeit to the other.
    const kemi = await join('Kemi');
    m = await start(kemi, sam);
    sam.socket.close();
    assert.deepEqual([m.status, m.forfeit, m.winnerName], ['finished', true, 'Kemi']);

    // 5. Walking away from the Game Den: the waiting challenge is cancelled.
    const bayo = await join('Bayo');
    await bayo.socket.packet({ type: 'ps_challenge_create' });
    const walking = matches().find((x) => x.hostId === bayo.id && x.status === 'waiting');
    const s = [...w.sessions.values()].find((x: any) => x.id === bayo.id);
    s.movementBudget = 100; now += 2000;
    await bayo.socket.packet({ type: 'move', position: [den[0] - 30, 0, den[2]], rotation: 0, animation: 'walk' });
    assert(!matches().some((x) => x.id === walking.id), 'walking away cancels the challenge');
    // Moving around near the den keeps it.
    await bayo.socket.packet({ type: 'ps_challenge_create' });
    s.movementBudget = 100; now += 2000;
    await bayo.socket.packet({ type: 'move', position: [den[0] + 3, 0, den[2] + 2], rotation: 0, animation: 'walk' });
    assert(matches().some((x) => x.hostId === bayo.id && x.status === 'waiting'), 'small moves keep it open');

    // 6. Sweeps: unjoined challenges expire after 5 minutes; idle matches end; finished ones are cleared.
    now += 5 * 60_000 + 1;
    w.sweepPSMatches(now);
    assert(!matches().some((x) => x.hostId === bayo.id && x.status === 'waiting'), 'stale challenge expires');
    const zee = await join('Zee'), uche = await join('Uche');
    m = await start(zee, uche);
    await zee.socket.packet({ type: 'ps_action', matchId: m.id, choice: 'left' }); // Zee picked, Uche never did
    now += 2 * 60_000 + 1;
    w.sweepPSMatches(now);
    assert.deepEqual([m.status, m.forfeit, m.winnerName], ['finished', true, 'Zee']);
    assert.match(m.roundResult, /Uche stopped playing/);
    now += 60_001;
    w.sweepPSMatches(now);
    assert(!matches().some((x) => x.id === m.id), 'finished matches are cleared after a minute');
    assert.equal(rpcs.filter((u) => u.includes('ps_reward')).length, 0, 'no endings above paid rewards');
    console.log('PS LIFECYCLE PASSED: withdraw, forfeit on leave, disconnect (waiting + running), walk-away, expiry, idle forfeit, cleanup, no rewards.');
  } finally {
    (globalThis as any).WebSocket = oldWS; (globalThis as any).setInterval = oldInterval; (globalThis as any).clearInterval = oldClear; Date.now = oldNow; (globalThis as any).fetch = oldFetch;
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
