// Pool at the party hall: 7 reds, 7 yellows and the black (UK-style 8-ball, simplified).
// simulateShot is deterministic (only + − × ÷ and sqrt), so the Worker decides the result and
// every client can replay the same shot from the same start. Units are metres on the cloth.

export const POOL = {
  /** Cloth half-sizes: x along the table's length, z across it. */
  HALF_X: 1,
  HALF_Z: 0.5,
  R: 0.026,
  POCKET_R: 0.055,
  MAX_SPEED: 6,
  /** Rolling friction deceleration, m/s². */
  FRICTION: 0.6,
  CUSHION: 0.8,
  DT: 1 / 240,
  FRAME_EVERY: 8, // record 30 frames a second
  MAX_SECONDS: 14,
  TURN_MS: 30000,
  RESULT_HOLD_MS: 30000,
};
export type BallKind = 'cue' | 'red' | 'yellow' | 'black';
export interface Ball { id: number; kind: BallKind; x: number; z: number; potted: boolean }
export const POCKETS: Array<[number, number]> = [
  [-POOL.HALF_X, -POOL.HALF_Z], [0, -POOL.HALF_Z - 0.012], [POOL.HALF_X, -POOL.HALF_Z],
  [-POOL.HALF_X, POOL.HALF_Z], [0, POOL.HALF_Z + 0.012], [POOL.HALF_X, POOL.HALF_Z],
];
export const CUE_SPOT: [number, number] = [-0.6, 0];

/** Standard triangle with the black in the middle of the third row. */
export function rack(): Ball[] {
  const balls: Ball[] = [{ id: 0, kind: 'cue', x: CUE_SPOT[0], z: CUE_SPOT[1], potted: false }];
  const d = POOL.R * 2 + 0.001;
  const rowX = Math.sqrt(3) * d / 2;
  // Fixed pattern so racks are identical everywhere: r/y alternate, black at row 3 centre.
  const pattern: BallKind[] = ['red', 'yellow', 'red', 'red', 'black', 'yellow', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow'];
  let n = 0;
  for (let row = 0; row < 5; row++)
    for (let i = 0; i <= row; i++) {
      const kind = pattern[n++];
      balls.push({ id: n, kind, x: 0.5 + row * rowX, z: (i - row / 2) * d, potted: false });
    }
  return balls;
}

export interface ShotOutcome {
  /** Ball positions over time: frames[k] = [x0,z0,x1,z1,…] for all balls (potted balls frozen). */
  frames: number[][];
  balls: Ball[];
  potted: number[];
  firstHit: number | null;
  cushionAfterHit: boolean;
}

const round = (v: number) => Math.round(v * 10000) / 10000;

/** Strike the cue ball along (dx, dz) (normalised here) at power 0–1. */
export function simulateShot(start: Ball[], dx: number, dz: number, power: number): ShotOutcome {
  const balls = start.map((b) => ({ ...b }));
  const vx = new Array(balls.length).fill(0), vz = new Array(balls.length).fill(0);
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const p = Math.max(0.05, Math.min(1, power));
  const cue = balls.findIndex((b) => b.kind === 'cue');
  vx[cue] = (dx / len) * POOL.MAX_SPEED * p;
  vz[cue] = (dz / len) * POOL.MAX_SPEED * p;
  const potted: number[] = [];
  let firstHit: number | null = null, cushionAfterHit = false;
  const frames: number[][] = [];
  const snapshot = () => frames.push(balls.flatMap((b) => [round(b.x), round(b.z)]));
  snapshot();
  const steps = Math.ceil(POOL.MAX_SECONDS / POOL.DT);
  const minX = -POOL.HALF_X + POOL.R, maxX = POOL.HALF_X - POOL.R, minZ = -POOL.HALF_Z + POOL.R, maxZ = POOL.HALF_Z - POOL.R;
  for (let step = 1; step <= steps; step++) {
    let moving = false;
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].potted) continue;
      const s = Math.sqrt(vx[i] * vx[i] + vz[i] * vz[i]);
      if (s === 0) continue;
      const ns = Math.max(0, s - POOL.FRICTION * POOL.DT);
      if (ns < 0.005) { vx[i] = 0; vz[i] = 0; continue; }
      vx[i] *= ns / s; vz[i] *= ns / s;
      balls[i].x += vx[i] * POOL.DT;
      balls[i].z += vz[i] * POOL.DT;
      moving = true;
      // Pockets first, then cushions.
      for (const [px, pz] of POCKETS) {
        const ddx = balls[i].x - px, ddz = balls[i].z - pz;
        if (ddx * ddx + ddz * ddz < POOL.POCKET_R * POOL.POCKET_R) {
          balls[i].potted = true; vx[i] = 0; vz[i] = 0; potted.push(balls[i].id);
          break;
        }
      }
      if (balls[i].potted) continue;
      let hitCushion = false;
      if (balls[i].x < minX) { balls[i].x = 2 * minX - balls[i].x; vx[i] = -vx[i] * POOL.CUSHION; vz[i] *= POOL.CUSHION; hitCushion = true; }
      if (balls[i].x > maxX) { balls[i].x = 2 * maxX - balls[i].x; vx[i] = -vx[i] * POOL.CUSHION; vz[i] *= POOL.CUSHION; hitCushion = true; }
      if (balls[i].z < minZ) { balls[i].z = 2 * minZ - balls[i].z; vz[i] = -vz[i] * POOL.CUSHION; vx[i] *= POOL.CUSHION; hitCushion = true; }
      if (balls[i].z > maxZ) { balls[i].z = 2 * maxZ - balls[i].z; vz[i] = -vz[i] * POOL.CUSHION; vx[i] *= POOL.CUSHION; hitCushion = true; }
      if (hitCushion && firstHit !== null) cushionAfterHit = true;
    }
    // Ball–ball collisions (equal mass, nearly elastic). A few passes per step let a hit travel
    // through a packed rack the way it does on a real table.
    for (let pass = 0; pass < 4; pass++)
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].potted) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (balls[j].potted) continue;
        const ddx = balls[j].x - balls[i].x, ddz = balls[j].z - balls[i].z;
        const d2 = ddx * ddx + ddz * ddz, min = 2 * POOL.R;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = ddx / d, nz = ddz / d;
        // Separate the overlap evenly.
        const push = (min - d) / 2;
        balls[i].x -= nx * push; balls[i].z -= nz * push;
        balls[j].x += nx * push; balls[j].z += nz * push;
        const rel = (vx[i] - vx[j]) * nx + (vz[i] - vz[j]) * nz;
        if (rel <= 0) continue;
        const k = rel * 0.97;
        vx[i] -= k * nx; vz[i] -= k * nz;
        vx[j] += k * nx; vz[j] += k * nz;
        if (firstHit === null && (i === cue || j === cue)) firstHit = balls[i === cue ? j : i].id;
        moving = true;
      }
    }
    if (step % POOL.FRAME_EVERY === 0) snapshot();
    if (!moving) break;
  }
  snapshot();
  return { frames, balls: balls.map((b) => ({ ...b, x: round(b.x), z: round(b.z) })), potted, firstHit, cushionAfterHit };
}

// ---------- Match rules ----------
export interface PoolPlayer { userId: string; connectionId: string; name: string }
export interface PoolState {
  id: string;
  status: 'LOBBY' | 'WAITING' | 'ACTIVE' | 'RESULT';
  p1: PoolPlayer | null;
  p2: PoolPlayer | null;
  balls: Ball[];
  turnUserId: string | null;
  turnDeadline: number | null;
  /** Colour each player is on, once decided by their first legal pot. */
  groups: Record<string, 'red' | 'yellow'>;
  /** The last shot, so clients can replay it: start positions, direction, power, and what happened. */
  lastShot: { seq: number; by: string; start: Ball[]; dx: number; dz: number; power: number; potted: number[]; foul: string | null } | null;
  shots: number;
  winnerUserId: string | null;
  endReason: 'complete' | 'forfeit' | null;
  message: string;
  rematchVotes: string[];
  updatedAt: number;
}
export type PoolResult = PoolState | { error: string };
export const isPoolError = (r: PoolResult): r is { error: string } => 'error' in r;
const fail = (error: string) => ({ error });

export const createPool = (now: number): PoolState => ({
  id: '', status: 'LOBBY', p1: null, p2: null, balls: rack(), turnUserId: null, turnDeadline: null, groups: {},
  lastShot: null, shots: 0, winnerUserId: null, endReason: null, message: '', rematchVotes: [], updatedAt: now,
});
export const poolPlayers = (s: PoolState) => [s.p1, s.p2].filter(Boolean) as PoolPlayer[];
export const isPoolPlayer = (s: PoolState, userId: string) => poolPlayers(s).some((p) => p.userId === userId);
const other = (s: PoolState, userId: string) => (s.p1?.userId === userId ? s.p2 : s.p1);
const finish = (s: PoolState, now: number, winner: string | null, endReason: PoolState['endReason'], message: string): PoolState =>
  ({ ...s, status: 'RESULT', turnUserId: null, turnDeadline: null, winnerUserId: winner, endReason, message, rematchVotes: [], updatedAt: now });

export function poolCreate(s: PoolState, host: PoolPlayer, id: string, now: number): PoolResult {
  if (s.status === 'WAITING') return fail(s.p1?.userId === host.userId ? 'Your table is already open.' : `@${s.p1?.name} is waiting for an opponent. Join them!`);
  if (s.status === 'ACTIVE') return fail('A game of pool is on.');
  if (s.status === 'RESULT' && !isPoolPlayer(s, host.userId) && now - s.updatedAt < POOL.RESULT_HOLD_MS) return fail('The table is just finishing a game.');
  return { ...createPool(now), id, status: 'WAITING', p1: host };
}
export function poolJoin(s: PoolState, guest: PoolPlayer, id: string, now: number): PoolResult {
  if (s.status !== 'WAITING' || !s.p1 || s.id !== id) return fail('That table is no longer open.');
  if (s.p1.userId === guest.userId) return fail('You cannot play yourself.');
  return { ...s, status: 'ACTIVE', p2: guest, turnUserId: s.p1.userId, turnDeadline: now + POOL.TURN_MS, message: `@${s.p1.name} breaks`, updatedAt: now };
}

const remaining = (balls: Ball[], kind: BallKind) => balls.filter((b) => b.kind === kind && !b.potted).length;

/** Take a shot: direction and power come from the player; everything else is decided here. */
export function poolShoot(s: PoolState, userId: string, dx: number, dz: number, power: number, now: number): PoolResult {
  if (s.status !== 'ACTIVE') return fail('No game in progress.');
  if (s.turnUserId !== userId) return fail("It's not your turn.");
  if (![dx, dz, power].every(Number.isFinite) || (dx === 0 && dz === 0)) return fail('Aim first.');
  const me = userId, opp = other(s, me)!;
  const out = simulateShot(s.balls, dx, dz, power);
  const kindOf = (id: number) => s.balls.find((b) => b.id === id)!.kind;
  const groups = { ...s.groups };
  const mine = groups[me];
  const pottedKinds = out.potted.map(kindOf);
  const clearedBefore = mine ? remaining(s.balls, mine) === 0 : false;
  let foul: string | null = null;
  if (out.firstHit === null) foul = 'missed every ball';
  else if (pottedKinds.includes('cue')) foul = 'potted the white';
  else {
    const hit = kindOf(out.firstHit);
    if (mine && !clearedBefore && hit !== mine) foul = `hit a ${hit} first`;
    else if (mine && clearedBefore && hit !== 'black') foul = 'had to hit the black';
    else if (!mine && hit === 'black') foul = 'hit the black first';
  }
  const balls = out.balls.map((b) => (b.kind === 'cue' && b.potted ? { ...b, potted: false, x: CUE_SPOT[0], z: CUE_SPOT[1] } : b));
  const lastShot = { seq: s.shots + 1, by: me, start: s.balls, dx, dz, power, potted: out.potted, foul };
  const base = { ...s, balls, lastShot, shots: s.shots + 1, updatedAt: now };
  const name = (u: string) => (s.p1?.userId === u ? s.p1.name : s.p2?.name) ?? 'player';
  // The black decides the game.
  if (pottedKinds.includes('black')) {
    const legal = !foul && mine && clearedBefore;
    return legal
      ? finish(base, now, me, 'complete', `@${name(me)} potted the black and wins!`)
      : finish(base, now, opp.userId, 'complete', `@${name(me)} potted the black too early — @${opp.name} wins`);
  }
  // First legal pot of a colour decides groups.
  if (!mine && !foul) {
    const first = pottedKinds.find((k) => k === 'red' || k === 'yellow') as 'red' | 'yellow' | undefined;
    if (first) { groups[me] = first; groups[opp.userId] = first === 'red' ? 'yellow' : 'red'; }
  }
  const myGroup = groups[me];
  // Potting one of your own (or any colour while the table is open) earns another shot.
  const keepGoing = !foul && (myGroup ? pottedKinds.includes(myGroup) : pottedKinds.some((k) => k === 'red' || k === 'yellow'));
  const nextTurn = keepGoing ? me : opp.userId;
  const message = foul ? `Foul: @${name(me)} ${foul}. @${opp.name} to play.` : keepGoing ? `@${name(me)} potted — shoot again` : `@${opp.name} to play`;
  return { ...base, groups, turnUserId: nextTurn, turnDeadline: now + POOL.TURN_MS, message };
}

export function poolExpire(s: PoolState, now: number): PoolState | null {
  if (s.status !== 'ACTIVE' || !s.turnDeadline || now < s.turnDeadline || !s.turnUserId) return null;
  const opp = other(s, s.turnUserId)!;
  return finish(s, now, opp.userId, 'forfeit', `Time ran out — @${opp.name} wins`);
}
export function poolLeave(s: PoolState, userId: string, now: number): PoolState | null {
  if (!isPoolPlayer(s, userId)) return null;
  if (s.status === 'WAITING' || s.status === 'RESULT') return createPool(now);
  if (s.status === 'ACTIVE') { const opp = other(s, userId)!; return finish(s, now, opp.userId, 'forfeit', `@${opp.name} wins — opponent left`); }
  return null;
}
export function poolRematch(s: PoolState, userId: string, now: number): PoolResult {
  if (s.status !== 'RESULT' || !isPoolPlayer(s, userId) || !s.p1 || !s.p2) return fail('No finished game to replay.');
  const votes = s.rematchVotes.includes(userId) ? s.rematchVotes : [...s.rematchVotes, userId];
  if (votes.length < 2) return { ...s, rematchVotes: votes, updatedAt: now };
  // The loser breaks.
  const breaker = s.winnerUserId === s.p1.userId ? s.p2 : s.p1;
  const p2 = breaker === s.p1 ? s.p2 : s.p1;
  return { ...createPool(now), id: `${s.id}-r`, status: 'ACTIVE', p1: breaker, p2, turnUserId: breaker.userId, turnDeadline: now + POOL.TURN_MS, message: `@${breaker.name} breaks`, updatedAt: now };
}
