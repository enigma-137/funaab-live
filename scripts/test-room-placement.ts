import assert from "node:assert/strict";
import {
  candidate,
  placementError,
  position,
  safeStand,
} from "../src/config/roomPlacement";
import { HOSTEL_SHOP } from "../src/config/hostelItems";
import {
  HOSTEL_ASSET_REGISTRY,
  createHostelAsset,
} from "../src/game/world/hostelAssets";
import { Box3 } from "three";
async function main() {
  for (const item of HOSTEL_SHOP) {
    assert(HOSTEL_ASSET_REGISTRY[item.modelKey], item.id);
    assert(
      !new Box3().setFromObject(await createHostelAsset(item.id)).isEmpty(),
      item.id,
    );
  }
  assert.equal(placementError(candidate("hostel_chair", 1, 0), []), null);
  assert(placementError(candidate("hostel_chair", 4, 0), []));
  assert(placementError(candidate("hostel_chair", 0, 3), []));
  assert(placementError(candidate("hostel_chair", -2.5, -3), []));
  const occupied = [
    { item_id: "hostel_table", x: 1, y: 0, z: 0, rotation: 45 },
  ];
  assert(placementError(candidate("hostel_chair", 1, 0), occupied));
  assert.equal(
    placementError(candidate("hostel_table", 1, 0, 45), occupied),
    null,
  );
  assert.deepEqual(
    position({ item_id: "hostel_chair", anchor: "floor-c", rotation: 0 }),
    [2, 0, 1],
  );
  assert(safeStand(occupied, [-2.6, 0.34, -1.9]));
  assert.equal(candidate("hostel_poster", 1, 1, 45).rotation, 0);
  console.log(
    "ROOM PLACEMENT PASSED: complete non-empty model registry, boundaries, entrance, bed, overlap, movement, legacy transforms and safe wake.",
  );
}
void main();
