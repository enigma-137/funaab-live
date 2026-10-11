import { classifyTerrain } from "../src/game/rules/lawnSecuritySystem";
import { forecourtPaving } from "../src/game/world/CampusLandscape";
import assert from "node:assert/strict";
import { buildLandmark } from "../src/game/world/CampusArchitecture";
import {
  buildTree,
  gardenTrees,
  isClearPlanting,
  buildForecourt,
} from "../src/game/world/CampusLandscape";
import { campusMaterials } from "../src/game/world/campusVisualGeometry";
import { locationById } from "../src/config/campusLocations";
const expected = {
  colerm: [100, 0, -25],
  colfhec: [-30, 0, -65],
  colvet: [-95, 0, -105],
  library: [20, 0, 0],
};
for (const id of ["colerm", "colfhec", "colvet", "library"] as const) {
  assert.deepEqual(
    locationById(id).position,
    expected[id],
    "Logical location must remain stable",
  );
  const batches = buildLandmark(id);
  assert(batches.length <= 12, "Building draw budget");
  let triangles = 0;
  for (const b of batches) {
    assert(
      Array.from(b.geometry.attributes.position.array).every(Number.isFinite),
    );
    assert(
      Array.from(b.geometry.attributes.normal.array).every(Number.isFinite),
    );
    assert(!b.geometry.boundingBox!.isEmpty());
    triangles += b.geometry.attributes.position.count / 3;
    b.geometry.dispose();
  }
  assert(triangles < 12000, "Landmark triangle budget");
  console.log(id, { draws: batches.length, triangles });
  for (const b of buildForecourt(id)) b.geometry.dispose();
}
assert(gardenTrees.length >= 8, "Four colleges need purposeful planting");
for (const t of gardenTrees)
  assert(
    isClearPlanting(t.pos[0], t.pos[2]),
    "Trees cannot obstruct roads, paths or building footprints",
  );
for (const type of ["palm", "neem"] as const) {
  const batches = buildTree(type);
  assert(batches.length <= 4);
  for (const b of batches) b.geometry.dispose();
}
for (const m of Object.values(campusMaterials)) {
  if (m.map) {
    assert(
      m.map.image.width <= 64 && m.map.image.height <= 64,
      "Surface textures stay tiny",
    );
  }
}
console.log(
  "CAMPUS VISUALS PASSED: coordinates, finite geometry, bounded detail, small textures and clear planting.",
);

for (const id of ["colerm", "colfhec", "colvet", "library"])
  for (const b of forecourtPaving(id)) {
    for (const x of [b.minX + 0.001, (b.minX + b.maxX) / 2, b.maxX - 0.001])
      for (const z of [b.minZ + 0.001, (b.minZ + b.maxZ) / 2, b.maxZ - 0.001])
        assert(
          !classifyTerrain(x, z).restricted,
          "New paving must not hide a restricted lawn",
        );
  }
console.log(
  "PAVING SAFETY PASSED: decorative paving stays on existing permitted terrain.",
);
