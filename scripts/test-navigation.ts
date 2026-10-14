import assert from 'node:assert/strict';
import { bearingTo, compassPoint, screenTurn, turnHint } from '../src/game/world/navigationMath';

const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
const P = [0, 0, 0] as const;

// Default camera (yaw 0) sits behind the player at +Z looking toward -Z.
near(screenTurn(P, [0, 0, -50], 0), 0); // ahead
near(screenTurn(P, [50, 0, 0], 0), Math.PI / 2); // +X is screen right
near(screenTurn(P, [-50, 0, 0], 0), -Math.PI / 2); // -X is screen left
near(Math.abs(screenTurn(P, [0, 0, 50], 0)), Math.PI); // behind
// Swing the camera round to look along +X (yaw -PI/2): +X is now straight ahead, -Z on the left.
near(screenTurn(P, [50, 0, 0], -Math.PI / 2), 0);
near(screenTurn(P, [0, 0, -50], -Math.PI / 2), -Math.PI / 2);
// Bearings match the avatar's movement heading.
near(bearingTo(P, [0, 0, 10]), 0);
near(bearingTo(P, [10, 0, 0]), Math.PI / 2);

assert.equal(turnHint(0.1), 'Straight ahead');
assert.equal(turnHint(0.8), 'Bear right');
assert.equal(turnHint(-0.8), 'Bear left');
assert.equal(turnHint(Math.PI / 2), 'Turn right');
assert.equal(turnHint(-Math.PI / 2), 'Turn left');
assert.equal(turnHint(3), 'Turn around');

assert.equal(compassPoint(bearingTo(P, [0, 0, -10])), 'N');
assert.equal(compassPoint(bearingTo(P, [10, 0, 0])), 'E');
assert.equal(compassPoint(bearingTo(P, [0, 0, 10])), 'S');
assert.equal(compassPoint(bearingTo(P, [-10, 0, 0])), 'W');
assert.equal(compassPoint(bearingTo(P, [10, 0, -10])), 'NE');

console.log('NAVIGATION PASSED: screen arrow follows the camera, turn hints, compass points.');
