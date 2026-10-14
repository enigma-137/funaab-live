// Party hall arcade rules: tic-tac-toe and pool (deterministic physics, groups, fouls, the black).
import assert from 'node:assert/strict';
import { createTtt, tttCreate, tttJoin, tttMove, tttExpire, tttLeave, tttRematch, isTttError, TTT_RULES, type TttState } from '../src/config/ticTacToe';
import { POOL, rack, simulateShot, createPool, poolCreate, poolJoin, poolShoot, poolExpire, poolLeave, poolRematch, isPoolError, type PoolState, type Ball } from '../src/config/pool';

const A = { userId: 'a', connectionId: 'ca', name: 'Ada' }, B = { userId: 'b', connectionId: 'cb', name: 'Bisi' };
const ok = <T,>(r: T | { error: string }): T => { assert(!(r as any).error, (r as any).error); return r as T; };

// ---- Tic-tac-toe ----
let t: TttState = createTtt('ttt-1', 0);
t = ok(tttCreate(t, A, 'g1', 0));
assert.match((tttCreate(t, B, 'g2', 0) as any).error, /waiting for a challenger/);
assert.match((tttJoin(t, A, 'g1', 0) as any).error, /yourself/);
t = ok(tttJoin(t, B, 'g1', 0));
assert.equal(t.status, 'ACTIVE');
assert.match((tttMove(t, 'b', 0, 1) as any).error, /not your turn/);
for (const [u, c] of [['a', 0], ['b', 3], ['a', 1], ['b', 4]] as const) t = ok(tttMove(t, u, c, 1));
assert.match((tttMove(t, 'a', 3, 1) as any).error, /empty/);
assert.match((tttMove(t, 'a', 9, 1) as any).error, /empty/);
t = ok(tttMove(t, 'a', 2, 2));
assert.equal(t.status, 'RESULT'); assert.equal(t.winner, 'X'); assert.deepEqual(t.line, [0, 1, 2]); assert.equal(t.endReason, 'complete');
t = ok(tttRematch(t, 'a', 3)); assert.equal(t.status, 'RESULT');
t = ok(tttRematch(t, 'b', 3)); assert.equal(t.status, 'ACTIVE'); assert.equal(t.x?.userId, 'b', 'loser starts the rematch');
// Draw.
for (const [u, c] of [['b', 0], ['a', 1], ['b', 2], ['a', 4], ['b', 3], ['a', 5], ['b', 7], ['a', 6], ['b', 8]] as const) t = ok(tttMove(t, u, c, 4));
assert.equal(t.endReason, 'draw'); assert.equal(t.winner, null);
// Timeout and leaving.
let t2 = ok(tttJoin(ok(tttCreate(createTtt('ttt-2', 0), A, 'g3', 0)), B, 'g3', 0));
assert.equal(tttExpire(t2, TTT_RULES.TURN_MS - 1), null);
assert.equal(tttExpire(t2, TTT_RULES.TURN_MS)!.winner, 'O');
assert.equal(tttLeave(t2, 'b', 5)!.winner, 'X');
assert(isTttError(tttMove(createTtt('x', 0), 'a', 0, 0)));

// ---- Pool physics ----
const balls = rack();
assert.equal(balls.length, 16);
assert.equal(balls.filter((b) => b.kind === 'red').length, 7);
assert.equal(balls.filter((b) => b.kind === 'yellow').length, 7);
assert.equal(balls.filter((b) => b.kind === 'black').length, 1);
for (const a of balls) for (const b of balls) if (a !== b) assert(Math.hypot(a.x - b.x, a.z - b.z) >= 2 * POOL.R, 'rack does not overlap');
const brk = simulateShot(balls, 1, 0, 1);
assert.deepEqual(brk, simulateShot(balls, 1, 0, 1), 'deterministic');
assert(brk.firstHit !== null, 'the break hits the rack');
for (const b of brk.balls) if (!b.potted) assert(Math.abs(b.x) <= POOL.HALF_X && Math.abs(b.z) <= POOL.HALF_Z, 'balls stay on the cloth');
assert(brk.frames.length > 2 && brk.frames.every((f) => f.length === 32 && f.every(Number.isFinite)));
// A straight shot into the corner pocket.
const lone: Ball[] = [{ id: 0, kind: 'cue', x: -0.3, z: -0.2, potted: false }, { id: 1, kind: 'red', x: 0.6, z: -0.38, potted: false }];
const toPocket = simulateShot(lone, 1.6 - 0.3 + 0, (-0.5 + 0.2) * (0.9 / 0.4), 0); // weak shot stops short
assert.equal(toPocket.potted.length, 0);
const aim: Ball[] = [{ id: 0, kind: 'cue', x: 0.5, z: -0.2, potted: false }, { id: 1, kind: 'red', x: 0.75, z: -0.35, potted: false }];
const sunk = simulateShot(aim, 0.25, -0.15, 0.6);
assert.deepEqual(sunk.potted, [1], 'object ball sunk in the corner');
assert.equal(sunk.firstHit, 1);

// ---- Pool rules ----
let p: PoolState = ok(poolJoin(ok(poolCreate(createPool(0), A, 'm1', 0)), B, 'm1', 0));
assert.equal(p.turnUserId, 'a');
assert.match((poolShoot(p, 'b', 1, 0, 1, 1) as any).error, /not your turn/);
const at = (state: PoolState, set: Ball[]): PoolState => ({ ...state, balls: set });
// Ada pots a red on an open table → she is red, shoots again.
const reds: Ball[] = [{ id: 0, kind: 'cue', x: 0.5, z: -0.2, potted: false }, { id: 1, kind: 'red', x: 0.75, z: -0.35, potted: false },
  { id: 2, kind: 'yellow', x: -0.8, z: 0.4, potted: false }, { id: 3, kind: 'black', x: -0.5, z: 0.3, potted: false }];
p = ok(poolShoot(at(p, reds), 'a', 0.25, -0.15, 0.6, 2));
assert.equal(p.groups.a, 'red'); assert.equal(p.groups.b, 'yellow');
assert.equal(p.turnUserId, 'a', 'potted her own colour: shoot again');
assert.equal(p.lastShot?.potted[0], 1);
// Missing everything is a foul → turn passes.
const empty: Ball[] = [{ id: 0, kind: 'cue', x: 0, z: 0, potted: false }, { id: 2, kind: 'yellow', x: -0.8, z: 0.4, potted: false }, { id: 3, kind: 'black', x: -0.5, z: 0.3, potted: false }];
p = ok(poolShoot(at(p, empty), 'a', 0, 1, 0.1, 3));
assert.match(p.lastShot!.foul!, /missed/); assert.equal(p.turnUserId, 'b');
// Potting the white: foul, the white comes back to the spot.
const scratch: Ball[] = [{ id: 0, kind: 'cue', x: 0.75, z: -0.35, potted: false }, { id: 2, kind: 'yellow', x: -0.8, z: 0.4, potted: false }, { id: 3, kind: 'black', x: -0.5, z: 0.3, potted: false }];
p = ok(poolShoot(at(p, scratch), 'b', 0.25, -0.15, 0.6, 4));
assert.match(p.lastShot!.foul!, /white|missed/); assert.equal(p.turnUserId, 'a');
assert(!p.balls.find((b) => b.kind === 'cue')!.potted);
// Black too early loses; black after clearing wins.
const blackShot: Ball[] = [{ id: 0, kind: 'cue', x: 0.5, z: -0.2, potted: false }, { id: 3, kind: 'black', x: 0.75, z: -0.35, potted: false }, { id: 2, kind: 'yellow', x: -0.8, z: 0.4, potted: false }];
const early = ok(poolShoot(at(p, blackShot.concat([{ id: 4, kind: 'red', x: -0.2, z: 0.4, potted: false }])), 'a', 0.25, -0.15, 0.6, 5));
assert.equal(early.status, 'RESULT'); assert.equal(early.winnerUserId, 'b');
const win = ok(poolShoot(at(p, blackShot), 'a', 0.25, -0.15, 0.6, 5));
assert.equal(win.status, 'RESULT'); assert.equal(win.winnerUserId, 'a'); assert.equal(win.endReason, 'complete');
// Rematch: loser breaks. Timeout and leaving forfeit.
let r = ok(poolRematch(win, 'a', 6)); r = ok(poolRematch(r, 'b', 6));
assert.equal(r.status, 'ACTIVE'); assert.equal(r.turnUserId, 'b');
assert.equal(poolExpire(r, 6 + POOL.TURN_MS)!.winnerUserId, 'a');
assert.equal(poolLeave(r, 'a', 7)!.winnerUserId, 'b');
assert(isPoolError(poolShoot(createPool(0), 'a', 1, 0, 1, 0)));

console.log('PARTY GAMES PASSED: tic-tac-toe turns, wins, draws, timeout, rematch; pool deterministic physics, pockets, groups, fouls, the black, rematch, forfeits.');
