// Sports Centre penalty challenge (shot model + 1v1 state machine) and Love Garden placement.
import assert from 'node:assert/strict';
import {
  FOOTBALL_PITCH, FOOTBALL_RULES, resolveShot, isValidShotInput, createLobby, createChallenge, joinChallenge, cancelChallenge,
  takeMatchShot, takePracticeShot, expireTurn, leaveMatch, voteRematch, shotFlightPath, isFootballError,
  type FootballMatchState, type ShotOutcome,
} from '../src/config/football';
import { LOVE_GARDEN, LOVE_GARDEN_PAVING, loveGardenBenches, isInLoveGarden } from '../src/config/loveGarden';
import { campusLocations, campusZoneName } from '../src/config/campusLocations';
import { roadBounds } from '../src/config/kekeRoutes';
import worldData, { pedestrianPaths } from '../src/config/campusWorld';
import { classifyTerrain } from '../src/game/rules/lawnSecuritySystem';
import { avenueTrees, gardenTrees } from '../src/game/world/CampusLandscape';

const seq = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]; };
const seeded = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const ok = <T,>(v: T | { error: string }): T => { assert(!isFootballError(v), (v as any)?.error); return v as T; };

// ── Shot input validation: only bounded numbers are accepted ────────────────────────────────
for (const bad of [null, {}, { aim: 0 }, { aim: '0', power: 0.5 }, { aim: NaN, power: 0.5 }, { aim: 0, power: Infinity }, { aim: 1.01, power: 0.5 }, { aim: 0, power: -0.1 }, { aim: 0, power: 1.2 }])
  assert(!isValidShotInput(bad), `rejects ${JSON.stringify(bad)}`);
assert(isValidShotInput({ aim: -1, power: 0 }) && isValidShotInput({ aim: 1, power: 1 }));

// ── Shot model: deterministic, every outcome reachable from understandable inputs ────────────
// rng draws: x noise, height noise, keeper dive (<.4 left, <.6 centre, else right), save roll.
const still = 0.5; // zero noise
assert.deepEqual(resolveShot({ aim: 0.6, power: 0.6 }, seq(still, still, 0.95, 0.99)), resolveShot({ aim: 0.6, power: 0.6 }, seq(still, still, 0.95, 0.99)), 'deterministic');
assert.equal(resolveShot({ aim: 0.6, power: 0.6 }, seq(still, still, 0.95, 0.99)).outcome, 'GOAL', 'keeper guessed right but the placed shot beats him');
assert.equal(resolveShot({ aim: 0.6, power: 0.6 }, seq(still, still, 0.95, 0.0)).outcome, 'SAVED', 'keeper guessed right and won the save roll');
assert.equal(resolveShot({ aim: 0.6, power: 0.6 }, seq(still, still, 0.1, 0.0)).outcome, 'GOAL', 'keeper dived the wrong way');
assert.equal(resolveShot({ aim: 1, power: 0.6 }, seq(still, still, 0.5, 0.5)).outcome, 'MISS', 'wide of the post');
assert.equal(resolveShot({ aim: FOOTBALL_PITCH.goalHalfWidth / 2.85, power: 0.6 }, seq(still, still, 0.5, 0.5)).outcome, 'POST', 'hits the post');
assert.equal(resolveShot({ aim: 0.3, power: 1 }, seq(still, 1, 0.5, 0.5)).outcome, 'MISS', 'blazed over the bar');
assert.equal(resolveShot({ aim: 0.3, power: 1 }, seq(still, still, 0.5, 0.5)).outcome, 'POST', 'full power clips the crossbar');
assert.equal(resolveShot({ aim: 0.6, power: 0.1 }, seq(still, still, 0.1, 0.85)).outcome, 'SAVED', 'a roller is saved even the wrong way… mostly');
const dives = new Set([0.1, 0.5, 0.9].map((d) => resolveShot({ aim: 0, power: 0.5 }, seq(still, still, d, 0.99)).keeperDive));
assert.deepEqual([...dives].sort(), [-1, 0, 1], 'keeper can dive left, stay, or dive right');

// Feel check over many seeded shots: sensible shots usually score, corner blasts usually don't.
const rate = (pick: (r: () => number) => { aim: number; power: number }, n = 6000) => {
  const r = seeded(42); const tally: Record<ShotOutcome, number> = { GOAL: 0, SAVED: 0, MISS: 0, POST: 0 };
  for (let i = 0; i < n; i++) tally[resolveShot(pick(r), r).outcome]++;
  return Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, v / n])) as Record<ShotOutcome, number>;
};
const sensible = rate((r) => ({ aim: (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.3), power: 0.45 + r() * 0.3 }));
const blast = rate(() => ({ aim: 1, power: 1 }));
const roller = rate((r) => ({ aim: r() * 2 - 1, power: r() * 0.2 }));
console.log('goal rates', { sensible: sensible.GOAL.toFixed(2), blast: blast.GOAL.toFixed(2), roller: roller.GOAL.toFixed(2) });
assert(sensible.GOAL > 0.5 && sensible.GOAL < 0.9, 'well-taken penalties mostly go in');
assert(sensible.SAVED > 0.05, 'but the keeper still saves some');
assert(blast.GOAL < 0.25 && blast.MISS > 0.5, 'top-corner full blasts are a gamble');
assert(roller.GOAL < 0.4, 'weak shots are easy for the keeper');

// Ball flight never leaves the pitch.
for (const outcome of ['GOAL', 'SAVED', 'MISS', 'POST'] as const)
  for (const x of [-4, -2.4, 0, 1.3, 2.9, 4])
    for (const rest of Object.values(shotFlightPath({ outcome, target: [x, 1], aim: x / 2.85 }))) {
      assert(rest[0] >= -113 && rest[0] <= -87 && rest[2] >= -18 && rest[2] <= 18, `${outcome} ${x} stays on the turf`);
    }

// ── 1v1 match state machine ─────────────────────────────────────────────────────────────────
const james = { userId: 'u-james', connectionId: 'c-james', name: 'James' };
const sarah = { userId: 'u-sarah', connectionId: 'c-sarah', name: 'Sarah' };
const tobi = { userId: 'u-tobi', connectionId: 'c-tobi', name: 'Tobi' };
let now = 1_000_000;
const goal = seq(still, still, 0.1, 0.99); // aim right (+0.6), keeper dives left: always GOAL
const miss = { aim: 1, power: 0.6 };
const scorer = { aim: 0.6, power: 0.6 };

let s: FootballMatchState = createLobby(now);
assert.equal(s.status, 'LOBBY');
assert(isFootballError(joinChallenge(s, sarah, 'x', now)), 'nothing to join yet');
s = ok(createChallenge(s, james, 'm1', now));
assert.equal(s.status, 'WAITING');
assert.match((createChallenge(s, sarah, 'm2', now) as any).error, /James is already waiting/);
assert(isFootballError(joinChallenge(s, james, 'm1', now)), 'cannot join own challenge');
assert(isFootballError(joinChallenge(s, sarah, 'wrong-id', now)), 'stale challenge id');
// Practice is allowed while waiting (host warms up).
s = ok(takePracticeShot(s, james, scorer, goal, now));
assert.equal(s.lastShot?.practice, true);
assert.deepEqual(s.score, {}, 'practice never scores');

s = ok(joinChallenge(s, sarah, 'm1', ++now));
assert.equal(s.status, 'ACTIVE');
assert.equal(s.turnUserId, james.userId, 'challenger shoots first');
assert.deepEqual(s.shotsRemaining, { [james.userId]: 3, [sarah.userId]: 3 });
assert.equal(s.turnDeadline, now + FOOTBALL_RULES.TURN_SECONDS * 1000);
assert.match((takeMatchShot(s, sarah.userId, scorer, goal, now) as any).error, /turn/, 'out of turn');
assert.match((takeMatchShot(s, tobi.userId, scorer, goal, now) as any).error, /not in this match/);
assert.match((takePracticeShot(s, tobi, scorer, goal, now) as any).error, /match is being played/, 'pitch busy');
assert(isFootballError(takeMatchShot(s, james.userId, { aim: 0, power: 0.5, goal: true } as any, goal, now)) === false, 'extra fields are ignored…');
assert(isFootballError(takeMatchShot(s, james.userId, { goal: true } as any, goal, now)), '…but a "goal: true" claim is not a shot');
assert.match((createChallenge(s, tobi, 'm3', now) as any).error, /match is being played/);

// Alternating: J, S, J, S, J, S.
const order: string[] = [];
const plan: Record<string, Array<typeof scorer>> = { [james.userId]: [scorer, scorer, miss], [sarah.userId]: [miss, scorer, miss] };
while (s.status === 'ACTIVE') {
  const uid = s.turnUserId!;
  order.push(uid === james.userId ? 'J' : 'S');
  s = ok(takeMatchShot(s, uid, plan[uid].shift()!, goal, ++now));
}
assert.equal(order.join(''), 'JSJSJS', 'turns alternate');
assert.equal(s.status, 'RESULT');
assert.deepEqual(s.score, { [james.userId]: 2, [sarah.userId]: 1 });
assert.deepEqual(s.history[james.userId], ['GOAL', 'GOAL', 'MISS']);
assert.equal(s.winnerUserId, james.userId);
assert.equal(s.endReason, 'complete');
assert.equal(s.shotSeq, 7, 'every shot (practice included) has a fresh sequence number');
assert(isFootballError(takeMatchShot(s, james.userId, scorer, goal, now)), 'no shots after the whistle');
assert.match((createChallenge(s, tobi, 'm4', now) as any).error, /just ended/, 'scoreboard is held briefly for the players');
assert.equal(ok(createChallenge(s, tobi, 'm4', now + FOOTBALL_RULES.RESULT_HOLD_MS)).player1?.userId, tobi.userId, 'then the pitch frees up');

// Rematch needs both votes; the other player shoots first.
let r = ok(voteRematch(s, james.userId, ++now, 'm5'));
assert.equal(r.status, 'RESULT');
r = ok(voteRematch(r, james.userId, now, 'm5'));
assert.deepEqual(r.rematchVotes, [james.userId], 'double vote is idempotent');
r = ok(voteRematch(r, sarah.userId, ++now, 'm5'));
assert.equal(r.status, 'ACTIVE');
assert.equal(r.id, 'm5');
assert.equal(r.turnUserId, sarah.userId, 'rematch swaps who shoots first');
assert.deepEqual(r.score, { [sarah.userId]: 0, [james.userId]: 0 });
assert(isFootballError(voteRematch(s, tobi.userId, now, 'x')), 'spectators cannot rematch');

// Leaving after the whistle: once one leaves, no rematch; once both leave, the lobby is back.
let l = leaveMatch(s, sarah.userId, ++now)!;
assert.equal(l.status, 'RESULT');
assert.match((voteRematch(l, james.userId, now, 'x') as any).error, /left/);
l = leaveMatch(l, james.userId, ++now)!;
assert.equal(l.status, 'LOBBY');
assert.equal(l.lastShot?.seq, s.lastShot?.seq, 'ball state survives the reset');

// Draw.
let d = ok(joinChallenge(ok(createChallenge(createLobby(now), james, 'd1', now)), sarah, 'd1', now));
while (d.status === 'ACTIVE') d = ok(takeMatchShot(d, d.turnUserId!, scorer, goal, ++now));
assert.equal(d.winnerUserId, null, 'level scores are a draw');

// Turn clock: an idle shooter loses the shot; the other player continues.
let t = ok(joinChallenge(ok(createChallenge(createLobby(now), james, 't1', now)), sarah, 't1', now));
assert.equal(expireTurn(t, t.turnDeadline! - 1), null, 'not yet');
t = expireTurn(t, t.turnDeadline!)!;
assert.equal(t.lastShot?.reason, 'timeout');
assert.deepEqual(t.history[james.userId], ['MISS']);
assert.equal(t.turnUserId, sarah.userId);

// Forfeit: walking away mid-match hands the win to the opponent.
const f = leaveMatch(t, sarah.userId, ++now)!;
assert.equal(f.status, 'RESULT');
assert.equal(f.endReason, 'forfeit');
assert.equal(f.winnerUserId, james.userId);
assert.equal(leaveMatch(f, tobi.userId, now), null, 'spectators leaving changes nothing');
assert(isFootballError(voteRematch(f, james.userId, now, 'x')), 'no rematch against someone who walked off');
assert.equal(leaveMatch(f, james.userId, now)!.status, 'LOBBY', 'the winner leaving frees the pitch');

// Waiting host leaves or cancels: back to the lobby.
const w = ok(createChallenge(createLobby(now), james, 'w1', now));
assert.equal(leaveMatch(w, james.userId, now)!.status, 'LOBBY');
assert.equal(ok(cancelChallenge(w, james.userId, now)).status, 'LOBBY');
assert(isFootballError(cancelChallenge(w, sarah.userId, now)), 'only the host can cancel');

// ── World placement: penalty spot and Love Garden ───────────────────────────────────────────
const spot = worldData.interactables.find((i: any) => i.id === 'sports-penalty-spot') as any;
assert(spot && spot.type === 'football', 'penalty spot interaction exists');
assert.equal(classifyTerrain(spot.position[0], spot.position[2]).type, 'sports', 'penalty spot is on the legal turf');
assert(Math.hypot(spot.position[0] - FOOTBALL_PITCH.penaltySpot[0], spot.position[2] - FOOTBALL_PITCH.penaltySpot[2]) + spot.radius < FOOTBALL_PITCH.serverRadius, 'anywhere the button shows, the server accepts the shot');

const seats = worldData.interactables.filter((i: any) => i.id.startsWith('love-garden-seat-')) as any[];
assert.equal(loveGardenBenches.length, 6);
assert.equal(seats.length, 12, 'two seats per bench');
const inside = (b: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number, pad = 0) => x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;
for (const seat of seats) {
  const [x, , z] = seat.position;
  assert.equal(seat.type, 'bench', 'reuses the campus sit flow');
  const terrain = classifyTerrain(x, z);
  assert(!terrain.restricted, `seat ${seat.id} is on paving, not a fined lawn`);
  assert(!roadBounds.some((b) => inside(b, x, z, 1)), `seat ${seat.id} is off the road`);
  assert(!campusLocations.some((l) => l.footprint[0] > 0 && Math.abs(x - l.position[0]) < l.footprint[0] / 2 + 1 && Math.abs(z - l.position[2]) < l.footprint[1] / 2 + 1), `seat ${seat.id} is clear of buildings`);
  // A seated student faces the tree.
  const facing = [Math.sin(seat.rotation), Math.cos(seat.rotation)];
  const toTree = [LOVE_GARDEN.centre[0] - x, LOVE_GARDEN.centre[2] - z];
  assert(facing[0] * toTree[0] + facing[1] * toTree[1] > 0.95 * Math.hypot(...toTree), `seat ${seat.id} faces the tree`);
  for (const other of seats) if (other !== seat) assert(Math.hypot(other.position[0] - x, other.position[2] - z) > 0.8, 'seats do not overlap');
  assert(isInLoveGarden(x, z));
}
// Garden paving must not cover a road and must not swallow existing trees or walkways.
for (const p of Object.values(LOVE_GARDEN_PAVING)) {
  for (const t of [...avenueTrees, ...gardenTrees]) assert(!inside(p, t.pos[0], t.pos[2], 0.4), `paving clear of tree ${t.pos}`);
  assert(!campusLocations.some((l) => l.footprint[0] > 0 && inside({ minX: l.position[0] - l.footprint[0] / 2, maxX: l.position[0] + l.footprint[0] / 2, minZ: l.position[2] - l.footprint[1] / 2, maxZ: l.position[2] + l.footprint[1] / 2 }, (p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2)), 'paving is not inside a building');
}
assert(!roadBounds.some((b) => inside(b, LOVE_GARDEN.centre[0], LOVE_GARDEN.centre[2], LOVE_GARDEN.benchRing + 1)), 'garden ring is off every road');
assert(pedestrianPaths.length > 0);
// Walk from the Library forecourt to the tree without touching a fined lawn.
const route: Array<[number, number]> = [[20, 14], [43, 14], [43, 6.6], [43, 2]];
for (let i = 1; i < route.length; i++)
  for (let k = 0; k <= 40; k++) {
    const x = route[i - 1][0] + (route[i][0] - route[i - 1][0]) * (k / 40), z = route[i - 1][1] + (route[i][1] - route[i - 1][1]) * (k / 40);
    assert(!classifyTerrain(x, z).restricted, `legal walk from the Library at ${x.toFixed(1)},${z.toFixed(1)}`);
  }
// And from the east road straight in.
for (let x = 50; x >= 44; x -= 0.5) assert(!classifyTerrain(x, 0).restricted, `legal walk from the east road at ${x}`);
assert.equal(campusZoneName(43, 1), 'Love Garden');
assert.equal(campusZoneName(20, 0), 'Library', 'neighbouring zones unchanged');

console.log('football + love garden: all checks passed');
