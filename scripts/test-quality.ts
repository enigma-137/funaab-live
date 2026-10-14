// Graphics tiers: sensible starting tier per device, only ever stepping down in Auto, pixel-ratio cap.
import assert from 'node:assert/strict';
import { QUALITY, TIERS, effectiveDpr, lowerTier, resolveTier, startingTier } from '../src/config/quality';

// Tiers get cheaper, never dearer, going down.
for (let i = 1; i < TIERS.length; i++) {
  const lo = QUALITY[TIERS[i - 1]], hi = QUALITY[TIERS[i]];
  assert(lo.maxDpr <= hi.maxDpr && lo.shadowMapSize <= hi.shadowMapSize && lo.nightLights <= hi.nightLights && lo.stars <= hi.stars && lo.far <= hi.far);
  assert(!(lo.shadows && !hi.shadows) && !(lo.sky && !hi.sky) && !(lo.antialias && !hi.antialias));
}
assert.equal(QUALITY.low.shadows, false); assert.equal(QUALITY.low.sky, false); assert.equal(QUALITY.low.maxDpr, 1);
// Draw distance never exceeds where the fog ends (130 by day), so nothing visible is cut.
assert(QUALITY.low.far >= 115 && QUALITY.high.far >= 130);

// Starting tier.
assert.equal(startingTier({ touch: false }), 'high', 'computers start high');
assert.equal(startingTier({ touch: true, memory: 2, cores: 8 }), 'low');
assert.equal(startingTier({ touch: true, memory: 8, cores: 4 }), 'low', 'few cores is a slow phone');
assert.equal(startingTier({ touch: true, memory: 8, cores: 8 }), 'high');
assert.equal(startingTier({ touch: true, memory: 6, cores: 8 }), 'medium');
assert.equal(startingTier({ touch: true }), 'high', 'iPhones hide memory/cores: trust Auto to step down');
assert.equal(startingTier({ touch: false, saveData: true }), 'low', 'Save-Data means low');

// Stepping down, and the player's choice wins.
assert.equal(lowerTier('high'), 'medium'); assert.equal(lowerTier('medium'), 'low'); assert.equal(lowerTier('low'), 'low');
assert.equal(resolveTier('auto', 'medium'), 'medium'); assert.equal(resolveTier('low', 'high'), 'low'); assert.equal(resolveTier('high', 'low'), 'high');

// Pixel ratio: the device's own, capped by tier, never below 1.
assert.equal(effectiveDpr('low', 3), 1); assert.equal(effectiveDpr('medium', 3), 1.25); assert.equal(effectiveDpr('high', 3), 1.75);
assert.equal(effectiveDpr('high', 1), 1); assert.equal(effectiveDpr('high', 0), 1);
console.log('QUALITY PASSED: tiers monotonic, device start tier, step-down only, player choice wins, pixel-ratio caps.');
