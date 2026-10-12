import assert from 'node:assert/strict';
import { hasMeaningfulMovementChange, type MovementSnapshot } from '../src/game/multiplayer/movementSync';

const stationary: MovementSnapshot = {
  position: [1, 0, 1],
  rotation: 0,
  animation: 'idle',
  kekeRiding: false,
};

assert(hasMeaningfulMovementChange(null, stationary), 'The initial state must be sent');
assert(!hasMeaningfulMovementChange(stationary, { ...stationary, position: [1.05, 0, 1] }), 'Small position jitter is suppressed');
assert(hasMeaningfulMovementChange(stationary, { ...stationary, position: [1.13, 0, 1] }), 'Meaningful movement is sent');
assert(!hasMeaningfulMovementChange(stationary, { ...stationary, rotation: 0.05 }), 'Small orientation jitter is suppressed');
assert(hasMeaningfulMovementChange(stationary, { ...stationary, rotation: 0.07 }), 'Meaningful rotation is sent');
assert(hasMeaningfulMovementChange(stationary, { ...stationary, animation: 'walk' }), 'Animation changes are sent');
assert(hasMeaningfulMovementChange({ ...stationary, rotation: Math.PI - 0.04 }, { ...stationary, rotation: -Math.PI + 0.04 }), 'Rotation comparison wraps across the angle boundary');

console.log('MOVEMENT SYNC PASSED: stationary suppression, position/rotation thresholds, animation changes, and angle wrapping.');
