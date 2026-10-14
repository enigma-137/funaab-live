// Game Den shoot-out rules: equal kicks each, early finish when a side can't catch up, level = draw.
import assert from 'node:assert/strict';
import { resolvePSRound, PS_TOTAL_ROUNDS, PS_KICKS_EACH, type PSDirection } from '../src/config/psPenalty';

const newMatch = () => ({ status: 'in_progress', currentRound: 1, totalRounds: PS_TOTAL_ROUNDS, hostScore: 0, guestScore: 0,
  hostName: 'Ada', guestName: 'Tobi' } as Parameters<typeof resolvePSRound>[0]);
// Play kicks as goal (true) / miss (false) in round order until the match ends.
function play(kicks: boolean[]) {
  const m = newMatch(); let outcome: ReturnType<typeof resolvePSRound> = null, rounds = 0;
  for (const goal of kicks) {
    const shot: PSDirection = 'left', dive: PSDirection = goal ? 'right' : 'left';
    const hostShoots = m.currentRound % 2 === 1;
    m.hostChoice = hostShoots ? shot : dive; m.guestChoice = hostShoots ? dive : shot;
    outcome = resolvePSRound(m); rounds++;
    assert.equal(m.lastRound?.goal, goal);
    if (outcome) break;
  }
  return { m, outcome, rounds };
}

assert.equal(PS_KICKS_EACH, 3);
// Both perfect: the old 3-round format called this 2-1 to the host. Now it's a 3-3 draw.
let r = play([true, true, true, true, true, true]);
assert.equal(r.outcome, 'draw'); assert.equal(r.m.isDraw, true); assert.equal(r.m.winnerName, undefined);
assert.deepEqual([r.m.hostScore, r.m.guestScore, r.rounds], [3, 3, 6]);
// Nobody scores: 0-0 draw after all six kicks.
r = play([false, false, false, false, false, false]);
assert.equal(r.outcome, 'draw'); assert.equal(r.rounds, 6);
// Early finish: host 2-0 up with one kick each left after round 4.
r = play([true, false, true, false, true, true]);
assert.equal(r.outcome, 'host'); assert.equal(r.rounds, 4); assert.equal(r.m.winnerName, 'Ada');
// Guest early finish: 0-2 after four kicks, host has one left.
r = play([false, true, false, true, true, true]);
assert.equal(r.outcome, 'guest'); assert.equal(r.m.winnerName, 'Tobi'); assert.deepEqual([r.m.hostScore, r.m.guestScore, r.rounds], [0, 2, 4]);
// Decided on the very last kick: host misses kick 3 at 2-2, guest scores theirs.
r = play([true, true, true, true, false, true]);
assert.equal(r.outcome, 'guest'); assert.deepEqual([r.m.hostScore, r.m.guestScore, r.rounds], [2, 3, 6]);
// Choices are cleared between kicks and the round advances.
const m = newMatch(); m.hostChoice = 'left'; m.guestChoice = 'center';
assert.equal(resolvePSRound(m), null);
assert.deepEqual([m.currentRound, m.hostChoice, m.guestChoice, m.hostScore], [2, undefined, undefined, 1]);
console.log('PS PENALTY PASSED: 3 kicks each, perfect shoot-out is a draw, early finish, last-kick winner, choices reset.');
