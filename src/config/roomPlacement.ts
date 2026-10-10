import { hostelItem, ROOM_ANCHORS } from "./hostelItems";
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
  return [
    (Math.abs(Math.cos(r)) * f.width + Math.abs(Math.sin(r)) * f.depth) / 2,
    (Math.abs(Math.sin(r)) * f.width + Math.abs(Math.cos(r)) * f.depth) / 2,
  ];
}
export function candidate(
  item: string,
  x = 1,
  z = 0,
  rotation = 0,
): EditPlacement {
  const type = hostelItem(item)?.placementType;
  return {
    item,
    anchor: "free:" + item,
    x: type === "bed" ? -2.6 : snap(x),
    y: type === "wall" ? 1.8 : type === "bed" ? 0.32 : 0,
    z:
      type === "wall"
        ? -3.84
        : type === "bed"
          ? item === "hostel_pillow"
            ? -3.45
            : -2.8
          : snap(z),
    rotation: type === "wall" || type === "bed" ? 0 : rotation,
  };
}
export function placementError(
  p: EditPlacement,
  placed: RoomTransform[],
): string | null {
  const i = hostelItem(p.item);
  if (!i || i.placementType === "none") return "This item cannot be placed.";
  if (![p.x, p.y, p.z, p.rotation].every(Number.isFinite))
    return "Choose a position.";
  const [w, d] = extent(p.item, p.rotation);
  if (i.placementType === "wall") {
    if (Math.abs(p.x) + w > 3.8) return "Keep it inside the wall.";
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
  if (Math.abs(p.x) + w > 3.8 || Math.abs(p.z) + d > 3.8)
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
      ["wall", "bed"].includes(j.placementType)
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
): [number, number, number] | null {
  const candidates: [number, number, number][] = [];
  for (let x = -3.25; x <= 3.25; x += 0.5)
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
              p.item_id === "hostel_rug"
            )
              return true;
            const [px, , pz] = position(p),
              [w, d] = extent(p.item_id, p.rotation);
            return Math.abs(x - px) >= w + 0.4 || Math.abs(z - pz) >= d + 0.4;
          }),
      ) || null
  );
}
