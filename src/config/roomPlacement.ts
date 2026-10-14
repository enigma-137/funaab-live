import { hostelItem, ROOM_ANCHORS } from "./hostelItems";
import { ROOM_REACH_Z, ROOM_SIZES, SURFACES, roomReachX, type RoomSize } from "./roomMakeover";
export interface RoomTransform {
  item_id: string;
  anchor?: string;
  rotation: number;
  x?: number;
  y?: number;
  z?: number;
  active?: boolean;
  owner_id?: string;
}
export type EditPlacement = {
  item: string;
  anchor: string;
  rotation: number;
  x: number;
  y: number;
  z: number;
};
export const snap = (n: number) => Math.round(n * 4) / 4;
export function position(p: RoomTransform): [number, number, number] {
  const a = ROOM_ANCHORS.find((a) => a.id === p.anchor);
  return [
    p.x ?? a?.position[0] ?? 0,
    p.y ?? a?.position[1] ?? 0,
    p.z ?? a?.position[2] ?? 0,
  ];
}
export function extent(id: string, rotation: number): [number, number] {
  const f = hostelItem(id)?.footprint || { width: 1.25, depth: 2 };
  const r = (rotation * Math.PI) / 180;
  // Rounded like hostel_extent (migration 024) so a 90° turn is exactly 0/1 on both sides.
  const c = Math.round(Math.abs(Math.cos(r)) * 1e6) / 1e6, sn = Math.round(Math.abs(Math.sin(r)) * 1e6) / 1e6;
  return [(c * f.width + sn * f.depth) / 2, (sn * f.width + c * f.depth) / 2];
}
/** Items that can stand on a table or TV stand (small desk items, and the TV). */
export const isStackable = (id: string) => hostelItem(id)?.placementType === "desk" || id === "hostel_tv_basic";
const onTopOf = (q: RoomTransform) => SURFACES[q.item_id];

/** The placed table / TV stand whose top this point is over, if any. */
function surfaceUnder(placed: RoomTransform[], x: number, z: number, skip?: string) {
  return placed.find((q) => {
    if (q.item_id === skip || onTopOf(q) === undefined) return false;
    const [qx, , qz] = position(q), [w, d] = extent(q.item_id, q.rotation);
    return Math.abs(x - qx) <= w && Math.abs(z - qz) <= d;
  });
}

/** Things resting on a placed table / TV stand (they must come off before it moves). */
export function itemsOn(placed: RoomTransform[], surfaceId: string) {
  const s = placed.find((q) => q.item_id === surfaceId);
  const h = SURFACES[surfaceId];
  if (!s || h === undefined) return [];
  const [sx, , sz] = position(s), [w, d] = extent(surfaceId, s.rotation);
  return placed.filter((q) => {
    if (q.item_id === surfaceId) return false;
    const [x, y, z] = position(q);
    return Math.abs(y - h) < 0.001 && Math.abs(x - sx) <= w + 0.001 && Math.abs(z - sz) <= d + 0.001;
  });
}

export function candidate(
  item: string,
  x = 1,
  z = 0,
  rotation = 0,
  placed: RoomTransform[] = [],
  size: RoomSize = "standard",
): EditPlacement {
  const type = hostelItem(item)?.placementType;
  if (type === "wall") {
    const reach = roomReachX(size);
    return { item, anchor: "free:" + item, x: Math.max(-reach, Math.min(reach, snap(x))), y: 1.8, z: -3.84, rotation: 0 };
  }
  if (type === "bed")
    return { item, anchor: "free:" + item, x: -2.6, y: 0.32, z: item === "hostel_pillow" ? -3.45 : -2.8, rotation: 0 };
  // Over a table / TV stand: sit on its top, nudged so the whole item fits on it.
  const surface = isStackable(item) ? surfaceUnder(placed, x, z, item) : undefined;
  if (surface) {
    const [sx, , sz] = position(surface), [sw, sd] = extent(surface.item_id, surface.rotation), [w, d] = extent(item, rotation);
    const fit = (v: number, c: number, room: number) => Math.max(c - Math.max(0, room), Math.min(c + Math.max(0, room), v));
    return {
      item, anchor: "free:" + item, rotation,
      x: Number(fit(Math.round(x * 20) / 20, sx, sw - w).toFixed(3)),
      y: SURFACES[surface.item_id],
      z: Number(fit(Math.round(z * 20) / 20, sz, sd - d).toFixed(3)),
    };
  }
  return { item, anchor: "free:" + item, x: snap(x), y: 0, z: snap(z), rotation };
}
export function placementError(
  p: EditPlacement,
  placed: RoomTransform[],
  size: RoomSize = "standard",
): string | null {
  const i = hostelItem(p.item);
  if (!i || i.placementType === "none") return "This item cannot be placed.";
  if (![p.x, p.y, p.z, p.rotation].every(Number.isFinite))
    return "Choose a position.";
  const reach = roomReachX(size);
  const [w, d] = extent(p.item, p.rotation);
  if (i.placementType !== "wall" && i.placementType !== "bed" && itemsOn(placed, p.item).length)
    return `Take the items off the ${i.name} first.`;
  if (i.placementType === "wall") {
    if (Math.abs(p.x) + w > reach) return "Keep it inside the wall.";
    return placed.some(
      (q) =>
        q.item_id !== p.item &&
        hostelItem(q.item_id)?.placementType === "wall" &&
        Math.abs(position(q)[0] - p.x) < w + extent(q.item_id, q.rotation)[0],
    )
      ? "Wall space is occupied."
      : null;
  }
  if (i.placementType === "bed") return null;
  if (p.y > 0) {
    if (!isStackable(p.item)) return "This item goes on the floor.";
    const onIt = placed.some((q) => {
      const h = onTopOf(q);
      if (h === undefined || q.item_id === p.item || Math.abs(p.y - h) >= 0.001) return false;
      const [qx, , qz] = position(q), [qw, qd] = extent(q.item_id, q.rotation);
      return Math.abs(p.x - qx) + w <= qw + 0.001 && Math.abs(p.z - qz) + d <= qd + 0.001;
    });
    if (!onIt) return "Put it on a table or TV stand.";
    for (const q of placed) {
      if (q.item_id === p.item) continue;
      const [x, y, z] = position(q), [qw, qd] = extent(q.item_id, q.rotation);
      if (Math.abs(y - p.y) < 0.001 && Math.abs(p.x - x) < w + qw && Math.abs(p.z - z) < d + qd) return "That spot is taken.";
    }
    return null;
  }
  if (Math.abs(p.x) + w > reach || Math.abs(p.z) + d > ROOM_REACH_Z)
    return "Keep furniture inside the room.";
  if (Math.abs(p.x) < w + 0.8 && p.z + d > 2.6)
    return "Keep the entrance clear.";
  if (p.item === "hostel_rug") return null;
  if (Math.abs(p.x + 2.6) < w + 0.625 && Math.abs(p.z + 2.8) < d + 1)
    return "Leave space for the mattress.";
  for (const q of placed) {
    const j = hostelItem(q.item_id);
    if (
      q.item_id === p.item ||
      q.item_id === "hostel_rug" ||
      !j ||
      ["wall", "bed"].includes(j.placementType) ||
      position(q)[1] !== 0
    )
      continue;
    const [x, , z] = position(q),
      [qw, qd] = extent(q.item_id, q.rotation);
    if (Math.abs(p.x - x) < w + qw + 0.05 && Math.abs(p.z - z) < d + qd + 0.05)
      return "That space is occupied.";
  }
  return null;
}
export function safeStand(
  placed: RoomTransform[],
  near: [number, number, number],
  size: RoomSize = "standard",
): [number, number, number] | null {
  const candidates: [number, number, number][] = [];
  const reach = ROOM_SIZES[size].halfX - 0.75;
  for (let x = -reach; x <= reach + 1e-9; x += 0.5)
    for (let z = -3.25; z <= 3.25; z += 0.5) candidates.push([x, 0, z]);
  return (
    candidates
      .sort(
        (a, b) =>
          Math.hypot(a[0] - near[0], a[2] - near[2]) -
          Math.hypot(b[0] - near[0], b[2] - near[2]),
      )
      .find(
        ([x, , z]) =>
          !(Math.abs(x + 2.6) < 1.05 && Math.abs(z + 2.8) < 1.4) &&
          placed.every((p) => {
            const i = hostelItem(p.item_id);
            if (
              !i ||
              ["wall", "bed"].includes(i.placementType) ||
              p.item_id === "hostel_rug" ||
              position(p)[1] > 0
            )
              return true;
            const [px, , pz] = position(p),
              [w, d] = extent(p.item_id, p.rotation);
            return Math.abs(x - px) >= w + 0.4 || Math.abs(z - pz) >= d + 0.4;
          }),
      ) || null
  );
}
