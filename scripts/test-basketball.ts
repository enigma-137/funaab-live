// Basketball court: shot model, shootout state machine, Worker authority, and world placement.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import {
  BASKETBALL_COURT, BASKETBALL_RULES, createCourt, createHoopChallenge, expireHoopTurn, hoopFlightPath,
  isBasketballError, joinHoopChallenge, leaveCourt, resolveHoopShot, takeHoopPractice, takeHoopShot, type BasketballMatchState,
} from '../src/config/basketball';
import { VOLLEYBALL_COURT } from '../src/config/volleyball';
import world, { COURT_ZONES } from '../src/config/campusWorld';
import { campusLocations } from '../src/config/campusLocations';
import { classifyTerrain } from '../src/game/rules/lawnSecuritySystem';
import { FOOTBALL_PITCH } from '../src/config/football';
import { COURT_BENCHES, BENCH_LENGTH, courtBenchSeats } from '../src/config/courtBenches';

const fixed = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]; };
const mid = () => 0.5; // zero noise

// ── Shot model ──
assert.equal(resolveHoopShot({ aim: 0, power: BASKETBALL_RULES.SWEET_POWER }, mid).outcome, 'SWISH', 'dead centre, sweet power');
assert.equal(resolveHoopShot({ aim: 0.15, power: BASKETBALL_RULES.SWEET_POWER }, mid).outcome, 'SCORE', 'slightly off rolls in');
assert.equal(resolveHoopShot({ aim: 0, power: 0.2 }, mid).outcome, 'MISS', 'weak throw falls short');
assert.equal(resolveHoopShot({ aim: 0, power: 1 }, mid).outcome, 'MISS', 'full blast clangs long');
assert.equal(resolveHoopShot({ aim: 1, power: BASKETBALL_RULES.SWEET_POWER }, mid).outcome, 'MISS', 'wide');
// On the rim the roll decides.
assert.equal(resolveHoopShot({ aim: 0.3, power: BASKETBALL_RULES.SWEET_POWER }, fixed(0.5, 0.5, 0.0)).outcome, 'SCORE');
assert.equal(resolveHoopShot({ aim: 0.3, power: BASKETBALL_RULES.SWEET_POWER }, fixed(0.5, 0.5, 0.99)).outcome, 'RIM');
// Deterministic for a given rng.
const r1 = resolveHoopShot({ aim: 0.1, power: 0.7 }, fixed(0.2, 0.8, 0.4));
assert.deepEqual(r1, resolveHoopShot({ aim: 0.1, power: 0.7 }, fixed(0.2, 0.8, 0.4)));
// Flight: release at the shooter, apex above the rim, made shots cross the rim, rest on the court.
const made = hoopFlightPath({ outcome: 'SWISH', landing: [0, 0] });
assert.deepEqual(made.cross.map((n) => Number(n.toFixed(2))), [BASKETBALL_COURT.rim[0], 3.1, BASKETBALL_COURT.rim[2]]);
assert(made.apex[1] > BASKETBALL_COURT.rim[1]);
for (const o of ['SWISH', 'SCORE', 'RIM', 'MISS'] as const) for (const landing of [[0, 0], [0.5, 1], [-0.5, -1]] as [number, number][]) {
  const { rest } = hoopFlightPath({ outcome: o, landing });
  assert(rest[0] >= BASKETBALL_COURT.baselineX && Math.abs(rest[2] - BASKETBALL_COURT.centre[2]) < BASKETBALL_COURT.width / 2, `${o} ball stays on court`);
}

// ── State machine ──
const A = { userId: 'a', connectionId: 'ca', name: 'Ade' }, B = { userId: 'b', connectionId: 'cb', name: 'Bisi' };
let s: BasketballMatchState = createCourt(0);
s = takeHoopPractice(s, A, { aim: 0, power: 0.62 }, mid, 1) as BasketballMatchState;
assert.equal(s.lastShot?.practice, true);
assert.deepEqual(s.score, {}, 'practice never scores');
s = createHoopChallenge(s, A, 'm1', 2) as BasketballMatchState;
assert(isBasketballError(joinHoopChallenge(s, A, 'm1', 3)), 'cannot join own challenge');
s = joinHoopChallenge(s, B, 'm1', 3) as BasketballMatchState;
assert.equal(s.status, 'ACTIVE');
assert(isBasketballError(takeHoopPractice(s, A, { aim: 0, power: 0.5 }, mid, 4)), 'no practice mid-shootout');
assert(isBasketballError(takeHoopShot(s, 'b', { aim: 0, power: 0.5 }, mid, 4)), 'turn order');
for (let i = 0; i < BASKETBALL_RULES.SHOTS_PER_PLAYER * 2; i++) {
  const shooter = s.turnUserId!;
  s = takeHoopShot(s, shooter, { aim: shooter === 'a' ? 0 : 1, power: 0.62 }, mid, 10 + i) as BasketballMatchState;
}
assert.equal(s.status, 'RESULT');
assert.deepEqual(s.score, { a: 5, b: 0 });
assert.equal(s.winnerUserId, 'a');
// Timeout counts as a miss.
let t = joinHoopChallenge(createHoopChallenge(createCourt(0), A, 'm2', 0) as BasketballMatchState, B, 'm2', 0) as BasketballMatchState;
assert.equal(expireHoopTurn(t, 1000), null, 'clock still running');
t = expireHoopTurn(t, BASKETBALL_RULES.TURN_SECONDS * 1000 + 1)!;
assert.equal(t.lastShot?.reason, 'timeout');
assert.equal(t.turnUserId, 'b');
assert.equal(leaveCourt(t, 'b', 5)!.winnerUserId, 'a', 'walking off forfeits');

// ── World placement ──
const ids = new Set(campusLocations.map((l) => l.id));
assert(ids.has('acad') && ids.has('sports-courts'), 'Acad and the courts are campus locations');
assert(world.interactables.some((i) => i.type === 'basketball' && i.position === BASKETBALL_COURT.shooterSpot));
// The courts and Acad sit beside the Sports Centre pitch, not on it.
const pitch = { minX: FOOTBALL_PITCH.centre[0] - 13, maxX: FOOTBALL_PITCH.centre[0] + 13, minZ: -18, maxZ: 18 };
const overlaps = (a: typeof pitch, b: typeof pitch) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
assert(!overlaps(COURT_ZONES.basketball, pitch) && !overlaps(COURT_ZONES.volleyball, pitch));
assert(!overlaps(COURT_ZONES.basketball, COURT_ZONES.volleyball), 'courts side by side');
// Walking there is legal: the free-throw line, the courtside, Acad's front and the walk from the pitch.
for (const [x, z] of [[BASKETBALL_COURT.shooterSpot[0], BASKETBALL_COURT.shooterSpot[2]], [VOLLEYBALL_COURT.centre[0], VOLLEYBALL_COURT.centre[2]], [-100, 20], [-100, 40], [-80, 42], [-108, -21], [-108, -18.5], [-70, -22]])
  assert.equal(classifyTerrain(x, z).restricted, false, `(${x}, ${z}) is walkable`);

// Courtside benches: every bench has two sit spots, sits on walkable ground off the playing
// surface, faces its court, and no two benches overlap.
assert.equal(courtBenchSeats.length, COURT_BENCHES.length * 2);
for (const seat of courtBenchSeats) {
  assert(world.interactables.some((i) => i.id === seat.id && i.type === 'bench'), `${seat.id} is a sit spot`);
  assert.equal(classifyTerrain(seat.position[0], seat.position[2]).restricted, false, `${seat.id} is walkable`);
}
const inside = (p: number[], z: { minX: number; maxX: number; minZ: number; maxZ: number }, pad = 0) => p[0] > z.minX + pad && p[0] < z.maxX - pad && p[2] > z.minZ + pad && p[2] < z.maxZ - pad;
const surface = (c: { centre: number[] }, w: number, d: number) => ({ minX: c.centre[0] - w / 2, maxX: c.centre[0] + w / 2, minZ: c.centre[2] - d / 2, maxZ: c.centre[2] + d / 2 });
const playing = [surface(BASKETBALL_COURT, BASKETBALL_COURT.length, BASKETBALL_COURT.width), surface(VOLLEYBALL_COURT, VOLLEYBALL_COURT.width, VOLLEYBALL_COURT.length)];
for (const b of COURT_BENCHES) {
  assert(!playing.some((z) => inside(b.position, z, -0.6)), `${b.id} is off the playing surface`);
  const court = b.court === 'basketball' ? BASKETBALL_COURT.centre : VOLLEYBALL_COURT.centre;
  const facing = [Math.sin(b.rotation), Math.cos(b.rotation)];
  const toCourt = [court[0] - b.position[0], court[2] - b.position[2]];
  assert(facing[0] * toCourt[0] + facing[1] * toCourt[1] > 0, `${b.id} faces its court`);
  for (const o of COURT_BENCHES) if (o !== b) assert(Math.hypot(o.position[0] - b.position[0], o.position[2] - b.position[2]) > BENCH_LENGTH + 0.3, `${b.id} / ${o.id} apart`);
}

// ── Worker authority ──
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
    const spot = [...BASKETBALL_COURT.shooterSpot];
    const ade = await join('00000000-0000-4000-8000-0000000000a1', 'Ade', spot);
    const bisi = await join('00000000-0000-4000-8000-0000000000b2', 'Bisi', [spot[0] + 0.8, 0, spot[2] + 1.9]);
    const far = await join('00000000-0000-4000-8000-0000000000c3', 'Far', [20, 0, 12]);
    assert.equal(ade.messages.find((m) => m.type === 'snapshot').basketball.status, 'LOBBY', 'snapshot carries the court');
    const call = async (socket: Socket, payload: object) => { now += 100; await socket.packet({ type: 'basketball', requestId: crypto.randomUUID(), ...payload }); return socket.messages.filter((m) => m.type === 'action_result').at(-1); };
    const lastState = (socket: Socket) => socket.messages.filter((m) => m.type === 'basketball_state').at(-1)?.basketball;

    assert.match((await call(far, { op: 'practice', aim: 0, power: 0.6 })).error, /free-throw line/);
    Math.random = () => 0.5;
    const practice = await call(ade, { op: 'practice', aim: 0, power: 0.62, outcome: 'SWISH' });
    assert.equal(practice.result.lastShot.outcome, 'SWISH');
    assert.equal(lastState(far).lastShot.seq, practice.result.lastShot.seq, 'spectators see the throw');
    assert.match((await call(ade, { op: 'practice', aim: 0, power: 0.62 })).error, /ball to come back/);
    now += 3000;
    assert.match((await call(ade, { op: 'practice', aim: 3, power: 0.62 })).error, /Invalid shot/);

    const created = await call(ade, { op: 'create' });
    const joined = await call(bisi, { op: 'join', matchId: created.result.id });
    assert.equal(joined.result.status, 'ACTIVE');
    assert.deepEqual(lastState(ade), lastState(bisi));
    const forged = await call(ade, { op: 'shoot', aim: 1, power: 0.62, outcome: 'SWISH', score: { x: 5 } });
    assert.equal(forged.result.lastShot.outcome, 'MISS', 'the Worker decides, not the client');
    assert(!('x' in forged.result.score));
    bisi.close();
    assert.equal(lastState(far).endReason, 'forfeit', 'disconnect forfeits');
    assert.equal(lastState(far).winnerUserId, '00000000-0000-4000-8000-0000000000a1');
    // Football is untouched by the court.
    assert.equal(ade.messages.find((m) => m.type === 'snapshot').football.status, 'LOBBY');
  } finally {
    (globalThis as any).WebSocket = oldWS; globalThis.setInterval = oldInterval; Date.now = oldNow; Math.random = oldRandom;
  }
}
worker().then(() => { console.log('BASKETBALL PASSED: shot model, shootout, court placement, Worker authority.'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
