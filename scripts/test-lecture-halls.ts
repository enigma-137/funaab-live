import assert from "node:assert/strict";
import { Box3 } from "three";
import { campusLocations, collegeCatalogue, locationById } from "../src/config/campusLocations";
import world from "../src/config/campusWorld";
import { campusRegistry } from "../src/config/campusRegistry";
import { campusObstacles } from "../src/config/kekeRoutes";
import {
  CHAIR_BACK_Z,
  CHAIR_OFFSET_Z,
  FACE_BOARD,
  HALL_STANDING_VIEW,
  LECTURE_HALLS,
  freeHallSeats,
  hallSeatPositions,
  lectureHallForCollege,
} from "../src/config/lectureHalls";
import { LECTURE_SCHEDULE, getHallScheduleState, normalizeHallLocationId } from "../src/config/lectureSchedule";
import { buildLandmark } from "../src/game/world/CampusArchitecture";

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// --- Every physical college has exactly one hall, with its own lecture --------------------
const physicalColleges = campusLocations.filter((l) => l.type === "college").map((l) => l.id).sort();
assert.deepEqual(
  physicalColleges,
  ["colanim", "colbios", "coleng", "colerm", "colfhec", "colphys", "colplant", "colvet", "colcoms", "collend"].sort(),
  "college locations",
);
for (const id of physicalColleges) {
  const halls = LECTURE_HALLS.filter((h) => h.collegeLocationId === id);
  assert.equal(halls.length, 1, `${id} has exactly one lecture hall`);
  assert.equal(lectureHallForCollege(id.toUpperCase())?.id, halls[0].id, `${id} lookup by college code`);
  assert(collegeCatalogue.some((c) => c.code === halls[0].collegeCode), `${id} uses a catalogue college code`);
}
assert.equal(new Set(LECTURE_HALLS.map((h) => h.id)).size, LECTURE_HALLS.length, "unique hall ids");
assert.equal(new Set(LECTURE_HALLS.map((h) => h.interactableId)).size, LECTURE_HALLS.length, "unique interactables");

for (const hall of LECTURE_HALLS) {
  const lectures = LECTURE_SCHEDULE.filter((l) => l.locationId === hall.id);
  assert.equal(lectures.length, 1, `${hall.id} has one timetabled lecture`);
  const [lecture] = lectures;
  if (hall.collegeCode !== "CLT") assert.equal(lecture.college, hall.collegeCode, `${hall.id} lecture belongs to its college`);
  assert.equal(lecture.timeline.length >= 5, true, `${hall.id} lecture has a script`);
  assert(lecture.timeline.every((t, i, all) => i === 0 || t.atSeconds > all[i - 1].atSeconds), `${hall.id} timeline is ordered`);
  assert(lecture.timeline.every((t) => !t.text.includes("\\n") && !(t.boardTopic ?? "").includes("\\n")), `${hall.id} has no escaped newlines`);

  // Every alias resolves to this hall, and the schedule state uses this hall's lecture.
  for (const alias of [hall.id, hall.interactableId, hall.collegeLocationId, lecture.id]) {
    assert.equal(normalizeHallLocationId(alias), hall.id, `${alias} → ${hall.id}`);
  }
  assert.equal(getHallScheduleState(hall.id).lecture.id, lecture.id);

  // World interaction opens this hall.
  const interactable = world.interactables.find((i: any) => i.id === hall.interactableId);
  assert(interactable, `${hall.id} has a world interactable`);
  assert.equal(interactable.type, "lecture_hall");
  assert.equal(normalizeHallLocationId(interactable.targetId), hall.id, `${hall.id} interactable target`);
  assert(dist(interactable.position, hall.entrance) < 0.01, `${hall.id} interactable at the configured entrance`);

  // Arch, entrance and exit are on open ground: outside every building envelope and clear of the
  // arch pillars (±1.6m, radius 0.25m) so the player never respawns inside geometry.
  for (const [label, p] of [["arch", hall.arch], ["entrance", hall.entrance], ["exit", hall.exit]] as const) {
    for (const o of campusObstacles) {
      const inside = p[0] > o.minX - 0.5 && p[0] < o.maxX + 0.5 && p[2] > o.minZ - 0.5 && p[2] < o.maxZ + 0.5;
      assert(!inside || o.id === hall.id, `${hall.id} ${label} is clear of ${o.id}`);
    }
    assert(p[0] > world.bounds.minX + 1 && p[0] < world.bounds.maxX - 1 && p[2] > world.bounds.minZ + 1 && p[2] < world.bounds.maxZ - 1);
  }
  for (const side of [-1.6, 1.6]) {
    assert(dist(hall.exit, [hall.arch[0] + side, 0, hall.arch[2]]) > 1.2, `${hall.id} exit clear of arch pillars`);
  }
  assert(dist(hall.exit, hall.arch) >= 2, `${hall.id} exit is in front of the arch`);
  // Arches don't collide with each other.
  for (const other of LECTURE_HALLS) if (other !== hall) assert(dist(other.arch, hall.arch) > 8, `${hall.id} vs ${other.id} arches`);

  // --- Interior: seats and free seats -------------------------------------------------
  const seats = hallSeatPositions(hall);
  assert.equal(seats.length, hall.seating.rows * hall.seating.cols);
  for (const s of seats) assert(Math.abs(s.pos[0]) < 5 && s.pos[2] > -4.5 && s.pos[2] < 4, `${hall.id} seat ${s.seatNumber} inside room, off the stage`);

  const rowGap = hall.seating.rows > 1 ? seats[hall.seating.cols].pos[2] - seats[0].pos[2] : 2;
  assert(CHAIR_OFFSET_Z - 0.21 > 0.3 - 0.2, "chair front edge leaves knee room under the 0.3m-deep desk half");
  assert(CHAIR_BACK_Z + 0.05 < rowGap - 0.3, `${hall.id} chair back clears the next row's desk`);
  // Only real students sit in a hall: with nobody in, every seat is free.
  const free = freeHallSeats(hall);
  assert.equal(free.length, seats.length, `${hall.id} has no fake students: every seat is free`);
  assert(!freeHallSeats(hall, [free[0].seatNumber]).some((s) => s.seatNumber === free[0].seatNumber), "taken seats excluded");
}
// Legacy aliases used by old links and the existing world.json interactables still resolve.
assert.equal(normalizeHallLocationId("funaab-fst-201"), "colfhec-lecture-hall");
assert.equal(normalizeHallLocationId("funaab-eng-203"), "central-lecture-hall");
assert.equal(normalizeHallLocationId("funaab-bio-205"), "colbios-lecture-hall");
assert.equal(normalizeHallLocationId("clt"), "central-lecture-hall");
assert.equal(normalizeHallLocationId(null), "colfhec-lecture-hall");

// --- COLPHYS is a registered, mapped, navigable college ----------------------------------
const colphys = campusRegistry.find((l) => l.id === "colphys");
assert(colphys, "COLPHYS in the map registry");
assert.equal(colphys.category, "college");
assert.equal(colphys.code, "COLPHYS");
assert.equal(colphys.name, "College of Physical Sciences");
assert.equal(campusRegistry.filter((l) => l.code === "COLPHYS").length, 1, "no duplicate COLPHYS marker");
const search = (q: string) => campusRegistry.filter((l) => [l.name, l.shortName, l.categoryLabel].some((t) => t.toLowerCase().includes(q)));
assert(search("phys").some((l) => l.id === "colphys"), "map search finds COLPHYS");
assert((world.kekeDestinations as any[]).some((d) => d.id === "colphys"), "COLPHYS is a selectable destination");

// --- COLENG is broad and two-storey; COLPHYS has a proper building ------------------------
const coleng = locationById("coleng");
assert.deepEqual(coleng.position, [80, 0, -65], "COLENG keeps its site");
assert(coleng.footprint[0] >= 30 && coleng.footprint[0] > locationById("colfhec").footprint[0], "COLENG is broader than COLFHEC");
for (const [id, minWidth, minHeight] of [["coleng", 30, 8.75], ["colphys", 20, 8]] as const) {
  const box = new Box3();
  const batches = buildLandmark(id);
  assert(batches.length <= 14, `${id} draw budget`);
  for (const b of batches) {
    assert(Array.from(b.geometry.attributes.position.array).every(Number.isFinite), `${id} finite geometry`);
    box.union(b.geometry.boundingBox!);
  }
  const loc = locationById(id);
  assert(box.max.x - box.min.x >= minWidth, `${id} width`);
  assert(box.max.y >= minHeight, `${id} has two storeys`);
  // Visual model stays within the registered footprint (used by the map and keke obstacle checks).
  assert(box.max.x - box.min.x <= loc.footprint[0] + 0.2 && box.max.z - box.min.z <= loc.footprint[1] + 0.2, `${id} fits its footprint`);
}

console.log(`LECTURE HALLS PASSED: ${LECTURE_HALLS.length} halls (${physicalColleges.length} colleges + CLT), COLPHYS registered, COLENG two-storey.`);
