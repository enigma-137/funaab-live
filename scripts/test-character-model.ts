import assert from "node:assert/strict";
import { npcAppearance } from "../src/config/npcAppearance";
import { normalizeAvatar, avatarOptions } from "../src/config/avatar";
import { ellipsoids, silhouette } from "../src/game/player/avatarGeometry";

const original = {
  shirtColor: "#123456",
  skinColor: "#663c28",
  hairStyle: "afro",
  gender: "female",
};
const snapshot = JSON.stringify(original);
const legacy = normalizeAvatar(original);
assert.equal(legacy.topColor, original.shirtColor);
assert.equal(legacy.skinTone, original.skinColor);
assert.equal(legacy.hairstyle, "short-afro");
assert.equal(legacy.bodyType, "feminine");
assert.equal(JSON.stringify(original), snapshot);
const outfits = new Set<string>();
for (let i = 0; i < 100; i++) {
  const id = `student-${i}`,
    a = npcAppearance(id);
  assert.deepEqual(a, npcAppearance(id));
  assert(avatarOptions.hairstyle.includes(a.hairstyle as any));
  outfits.add(JSON.stringify(a));
}
assert(outfits.size > 90, "NPC identities must produce visibly varied outfits");
assert.equal(
  npcAppearance("officer", { topColor: "#84cc16" }).topColor,
  "#84cc16",
);
for (const geometry of [
  ellipsoids([
    [0, 1, 0, 0.18, 0.23, 0.17],
    [0, 0, 0, 0.1, 0.1, 0.1],
  ]),
  silhouette([
    [0, 0],
    [0.1, 0],
    [0.2, 0.5],
    [0, 0.5],
  ]),
]) {
  assert(geometry.index && geometry.index.count > 0);
  assert(Array.from(geometry.attributes.position.array).every(Number.isFinite));
  assert(Array.from(geometry.attributes.normal.array).every(Number.isFinite));
  geometry.computeBoundingBox();
  assert(geometry.boundingBox && !geometry.boundingBox.isEmpty());
  geometry.dispose();
}
console.log(
  "CHARACTER MODEL PASSED: deterministic diversity, uniform overrides, legacy preservation, finite merged geometry and normals.",
);
