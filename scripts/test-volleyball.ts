// Volleyball court: serve model, receiver, serve-off via the shared shootout machine, Worker authority.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { VOLLEYBALL, VOLLEYBALL_COURT, VOLLEYBALL_RULES, receiverSpot, resolveServe, serveFlightPath, type VolleyballMatchState } from '../src/config/volleyball';
import { BASKETBALL_COURT } from '../src/config/basketball';
import world from '../src/config/campusWorld';
import { classifyTerrain } from '../src/game/rules/lawnSecuritySystem';

const fixed = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
const quiet = (dive: number, dig: number) => fixed(0.5, 0.5, dive, dig); // no aim noise
const [lo, hi] = VOLLEYBALL_RULES.IN_POWER;

// ── Serve model ──
assert.equal(resolveServe({ aim: 0, power: 0.1 }, quiet(0.5, 0.99)).outcome, 'NET', 'too soft finds the net');
assert.equal(resolveServe({ aim: 0, power: 1 }, quiet(0.5, 0.99)).outcome, 'OUT', 'too hard sails long');
assert.equal(resolveServe({ aim: 1, power: 0.55 }, quiet(0.5, 0.99)).outcome, 'OUT', 'aiming past the sideline goes wide');
for (let p = lo; p <= hi + 1e-9; p += 0.02)
  assert(!['NET', 'OUT'].includes(resolveServe({ aim: 0, power: p }, quiet(0.5, 0.99)).outcome), `power ${p.toFixed(2)} lands in (meter band is honest)`);
// Receiver in the middle digs a serve straight at them; a dig roll that fails is still an ace.
assert.equal(resolveServe({ aim: 0, power: 0.57 }, quiet(0.5, 0)).outcome, 'DUG');
assert.equal(resolveServe({ aim: 0, power: 0.57 }, quiet(0.5, 0.99)).outcome, 'ACE');
// Receiver guessed the wrong side: a corner serve is an ace whatever the roll.
assert.equal(resolveServe({ aim: 0.8, power: 0.57 }, quiet(0.1, 0)).outcome, 'ACE');
assert.equal(resolveServe({ aim: 0.8, power: 0.57 }, quiet(0.9, 0)).outcome, 'DUG', 'guessed right and dug it');
assert.deepEqual(resolveServe({ aim: 0.3, power: 0.6 }, fixed(0.2, 0.7, 0.4, 0.6)), resolveServe({ aim: 0.3, power: 0.6 }, fixed(0.2, 0.7, 0.4, 0.6)));
// Flight: over the net for anything but NET; NET stays on the serving side; all rests on court.
const { netZ, netHeight, centre, length, width } = VOLLEYBALL_COURT;
for (const outcome of ['ACE', 'DUG', 'NET', 'OUT'] as const) for (const landing of [[0, 4], [3.5, 7], [-3.9, 0.5], [5, 9]] as [number, number][]) {
  const inCourt = landing[1] >= 0.3 && landing[1] <= length / 2 && Math.abs(landing[0]) <= width / 2;
  if ((outcome === 'ACE' || outcome === 'DUG') !== inCourt && outcome !== 'NET') continue; // impossible combination
  const p = serveFlightPath({ outcome, landing, receiverDive: 1 });
  if (outcome === 'NET') assert(p.land[2] > netZ && p.rest[2] > netZ, 'a netted serve stays on the serving side');
  else assert(p.apex[1] > netHeight && p.land[2] < netZ, `${outcome} clears the net`);
  assert(Math.abs(p.rest[0] - centre[0]) < width / 2 + 3 && Math.abs(p.rest[2] - centre[2]) < length / 2 + 3, `${outcome} rest stays near the court`);
}
assert.deepEqual(receiverSpot(0), VOLLEYBALL_COURT.receiverHome);

// ── Serve-off (shared machine) ──
const A = { userId: 'a', connectionId: 'ca', name: 'Ade' }, B = { userId: 'b', connectionId: 'cb', name: 'Bisi' };
let s = VOLLEYBALL.join(VOLLEYBALL.createChallenge(VOLLEYBALL.create(0), A, 'm', 0) as VolleyballMatchState, B, 'm', 0) as VolleyballMatchState;
for (let i = 0; i < VOLLEYBALL_RULES.SHOTS_PER_PLAYER * 2; i++) {
  const who = s.turnUserId!;
  // Ade serves aces into the empty corner; Bisi keeps netting.
  s = VOLLEYBALL.take(s, who, who === 'a' ? { aim: 0.8, power: 0.57 } : { aim: 0, power: 0.1 }, quiet(0.1, 0), i) as VolleyballMatchState;
}
assert.equal(s.status, 'RESULT');
assert.deepEqual(s.score, { a: 5, b: 0 });
assert.equal(s.history.b.join(), 'NET,NET,NET,NET,NET');
assert.equal(s.winnerUserId, 'a');

// ── World ──
assert(world.interactables.some((i) => i.type === 'volleyball' && i.position === VOLLEYBALL_COURT.serveSpot));
assert.equal(classifyTerrain(VOLLEYBALL_COURT.serveSpot[0], VOLLEYBALL_COURT.serveSpot[2]).restricted, false, 'the serving spot is walkable');
assert(Math.hypot(VOLLEYBALL_COURT.serveSpot[0] - BASKETBALL_COURT.shooterSpot[0], VOLLEYBALL_COURT.serveSpot[2] - BASKETBALL_COURT.shooterSpot[2]) > 2 * VOLLEYBALL_COURT.interactionRadius, 'the two prompts never overlap');

// ── Worker ──
class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(m: string) { this.messages.push(JSON.parse(m)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }
async function worker() {
  const oldWS = globalThis.WebSocket, oldInterval = globalThis.setInterval, oldNow = Date.now, oldRandom = Math.random;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  let now = oldNow(); Date.now = () => now;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true' } as any);
    const join = async (id: string, username: string, position: number[]) => {
      const socket = new Socket(); await w.handleSession(socket, null, 'world:funaab:main');
      await socket.packet({ type: 'join', player: { id, username, position } });
      const session = w.sessions.get(socket);
      session.trustedPosition = position; session.claimedPosition = position; session.movementClock = now;
      return socket;
    };
    const spot = [...VOLLEYBALL_COURT.serveSpot];
    const ade = await join('00000000-0000-4000-8000-0000000000a1', 'Ade', spot);
    const bisi = await join('00000000-0000-4000-8000-0000000000b2', 'Bisi', [spot[0] + 1.9, 0, spot[2] + 0.4]);
    const hooper = await join('00000000-0000-4000-8000-0000000000c3', 'Hooper', [...BASKETBALL_COURT.shooterSpot]);
    assert.equal(ade.messages.find((m) => m.type === 'snapshot').volleyball.status, 'LOBBY', 'snapshot carries the volleyball court');
    const call = async (socket: Socket, type: string, payload: object) => { now += 100; await socket.packet({ type, requestId: crypto.randomUUID(), ...payload }); return socket.messages.filter((m) => m.type === 'action_result').at(-1); };
    const lastState = (socket: Socket) => socket.messages.filter((m) => m.type === 'volleyball_state').at(-1)?.volleyball;

    assert.match((await call(hooper, 'volleyball', { op: 'practice', aim: 0, power: 0.5 })).error, /serving line/, 'must stand at the serving line');
    Math.random = () => 0.5;
    const practice = await call(ade, 'volleyball', { op: 'practice', aim: 0, power: 0.1, outcome: 'ACE' });
    assert.equal(practice.result.lastShot.outcome, 'NET', 'the Worker decides, not the client');
    assert.equal(lastState(hooper).lastShot.seq, practice.result.lastShot.seq, 'everyone sees the serve');
    assert.match((await call(ade, 'volleyball', { op: 'practice', aim: 0, power: 0.5 })).error, /ball to come back/);

    // The two courts are independent: a basketball shootout doesn't block the serve-off.
    assert.equal((await call(hooper, 'basketball', { op: 'create' })).result.status, 'WAITING');
    const created = await call(ade, 'volleyball', { op: 'create' });
    assert.equal(created.result.status, 'WAITING');
    const joined = await call(bisi, 'volleyball', { op: 'join', matchId: created.result.id });
    assert.equal(joined.result.status, 'ACTIVE');
    assert.equal(lastState(hooper).status, 'ACTIVE');
    assert.match((await call(bisi, 'volleyball', { op: 'shoot', aim: 0, power: 0.5 })).error, /turn/);
    // Turn clock: Ade lets it run out → recorded as a lost serve, Bisi to serve.
    // Run the Worker's own turn timer (captured instead of waiting 30 real seconds).
    const realTimeout = globalThis.setTimeout;
    let fire: Function | null = null;
    (globalThis as any).setTimeout = (fn: Function) => { fire = fn; return 0; };
    try {
      w.setCourt('volleyball', w.courts.volleyball.state); // re-arms the turn clock through the stub
    } finally { globalThis.setTimeout = realTimeout; }
    now += VOLLEYBALL_RULES.TURN_SECONDS * 1000 + 100;
    fire!();
    const after = lastState(bisi);
    assert.equal(after.lastShot.reason, 'timeout');
    assert.equal(after.turnUserId, '00000000-0000-4000-8000-0000000000b2');
    ade.close();
    assert.equal(lastState(bisi).endReason, 'forfeit');
    assert.equal(lastState(bisi).winnerUserId, '00000000-0000-4000-8000-0000000000b2');
    // Basketball challenge survives the volleyball forfeit.
    assert.equal(hooper.messages.filter((m) => m.type === 'basketball_state').at(-1).basketball.status, 'WAITING');
  } finally {
    (globalThis as any).WebSocket = oldWS; globalThis.setInterval = oldInterval; Date.now = oldNow; Math.random = oldRandom;
  }
}
worker().then(() => { console.log('VOLLEYBALL PASSED: serve model, receiver, serve-off, court placement, Worker authority, courts independent.'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
