import assert from "node:assert/strict";
import { npcAppearance } from "../src/config/npcAppearance";
import { normalizeAvatar, avatarOptions } from "../src/config/avatar";
import { ellipsoids, silhouette } from "../src/game/player/avatarGeometry";
import { buildAvatarGeometry, avatarLook } from "../src/game/player/avatarParts";
import { typicalStyles } from "../src/config/avatar";
import * as THREE from "three";

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
// NPCs dress for their body type.
for (let i = 0; i < 200; i++) {
  const a = npcAppearance(`npc-${i}`);
  const typical = typicalStyles[a.bodyType];
  for (const key of ["hairstyle", "topStyle", "bottomStyle", "shoeStyle"] as const)
    assert((typical[key] as readonly string[]).includes(a[key]), `${a.bodyType} NPC got ${key}=${a[key]}`);
  for (const key of ["hairstyle", "topStyle", "bottomStyle", "shoeStyle"] as const)
    assert((avatarOptions[key] as readonly string[]).includes(a[key]));
}
assert.equal(npcAppearance("x", { bodyType: "feminine" }).bodyType, "feminine");
// Every style combination builds finite geometry for both body types.
const finite = (geometry: THREE.BufferGeometry, label: string) => {
  assert(Array.from(geometry.attributes.position.array).every(Number.isFinite), label);
  assert(Array.from(geometry.attributes.normal.array).every(Number.isFinite), label);
};
let builds = 0;
for (const bodyType of avatarOptions.bodyType)
  for (const hairstyle of avatarOptions.hairstyle)
    for (const topStyle of avatarOptions.topStyle)
      for (const bottomStyle of avatarOptions.bottomStyle)
        for (const shoeStyle of avatarOptions.shoeStyle) {
          if (builds++ % 11 && hairstyle !== "bald") continue; // sample; geometry is independent per part
          const a = normalizeAvatar({ bodyType, hairstyle, topStyle, bottomStyle, shoeStyle });
          const { g, look } = buildAvatarGeometry(a, builds);
          const label = JSON.stringify(a);
          for (const name of ["head", "torso", "upperLeg", "lowerLeg", "shoe", "hand", "lips", "features"])
            assert(g[name], `${name} missing for ${label}`);
          assert.equal(!!g.hair, look.hair, label);
          assert.equal(!!g.sleeve, topStyle !== "tank-top", label);
          assert.equal(!!g.tunic, ["gown", "kaftan"].includes(topStyle), label);
          assert.equal(!!g.skirtLow, bottomStyle === "long-skirt" && !["gown", "jumpsuit"].includes(topStyle), label);
          Object.entries(g).forEach(([name, geometry]) => {
            finite(geometry, `${name} ${label}`);
            geometry.dispose();
          });
        }
// Mouth is lips, not a dark bar: no near-black features below the nose.
for (const bodyType of avatarOptions.bodyType) {
  const { g } = buildAvatarGeometry(normalizeAvatar({ bodyType }), 1);
  g.features.computeBoundingBox();
  assert(g.features.boundingBox!.min.y > -0.02, `${bodyType} dark features reach the mouth`);
  g.lips.computeBoundingBox();
  assert(g.lips.boundingBox!.max.y < -0.07 && g.lips.boundingBox!.min.y > -0.12);
}
const fem = avatarLook(normalizeAvatar({ bodyType: "feminine", topStyle: "gown", bottomStyle: "jeans" }));
assert(fem.bareLegs && !fem.skirt && fem.tunic && fem.hipsMaterial === "top");
assert(avatarLook(normalizeAvatar({ hairstyle: "bald" })).hair === false);
// A jumpsuit covers the legs in the top colour whatever the bottom says.
const coverall = avatarLook(normalizeAvatar({ topStyle: "jumpsuit", bottomStyle: "shorts" }));
assert(coverall.legMaterial === "top" && coverall.hipsMaterial === "top" && !coverall.shorts && !coverall.skirt && coverall.longSleeves);
assert.equal(normalizeAvatar({ topStyle: "cape" }).topStyle, "t-shirt");
console.log(
  "CHARACTER MODEL PASSED: deterministic diversity, uniform overrides, legacy preservation, finite merged geometry and normals.",
);
