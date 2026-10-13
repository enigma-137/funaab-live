// Ambient student NPCs walking the campus pavements. Pure and clock-driven: every client derives
// the same positions from Date.now(), so all players see the same crowd with zero network traffic.
import { roadNodes, roadEdges } from './kekeRoutes';
import { LOVE_GARDEN } from './loveGarden';
import type { Point } from './campusLocations';

export const CAMPUS_STUDENT_COUNT = 10;
const WALK_SPEED = 1.25; // m/s, an unhurried stroll
const PAVEMENT_OFFSET = 4.6; // just past the 4.3 m kerb, still inside the paved road corridor
const LOOP_EDGES = 28;

const neighbours = new Map<string, string[]>();
for (const [a, b] of roadEdges) {
  neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
  neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
}
const nodeIds = Object.keys(roadNodes).sort();

function seeded(id: string) {
  let n = 2166136261;
  for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => ((n = Math.imul(n ^ (n >>> 15), 2246822507) ^ 0x9e3779b9) >>> 0) / 2 ** 32;
}

export interface StudentWalk { id: string; points: Point[]; cumulative: number[]; length: number; phase: number }

/** A closed walk over the road graph (no immediate U-turns), shifted onto one pavement side. */
export function buildWalk(id: string): StudentWalk {
  const rnd = seeded(id);
  const side = rnd() < 0.5 ? -1 : 1;
  const start = nodeIds[Math.floor(rnd() * nodeIds.length)];
  const path = [start];
  for (let i = 0; i < LOOP_EDGES; i++) {
    const here = path[path.length - 1], prev = path[path.length - 2];
    const options = (neighbours.get(here) ?? []).filter((n) => n !== prev);
    const pick = options.length ? options : neighbours.get(here) ?? [here];
    path.push(pick[Math.floor(rnd() * pick.length)]);
  }
  // Walk back the same way so the loop closes without teleporting.
  const there = [...path, ...path.slice(0, -1).reverse()];
  // Each road edge keeps one pavement side whichever way it's walked (side chosen from the
  // edge's sorted node keys), so the out-and-back loop ends exactly where it started.
  const points: Point[] = [];
  for (let i = 1; i < there.length; i++) {
    const [k1, k2] = [there[i - 1], there[i]].sort();
    const p1 = roadNodes[k1], p2 = roadNodes[k2];
    const dx = p2[0] - p1[0], dz = p2[2] - p1[2], len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * PAVEMENT_OFFSET * side, nz = (dx / len) * PAVEMENT_OFFSET * side;
    const from = roadNodes[there[i - 1]], to = roadNodes[there[i]];
    points.push([from[0] + nx, 0, from[2] + nz], [to[0] + nx, 0, to[2] + nz]);
  }
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]));
  const length = cumulative[cumulative.length - 1] || 1;
  return { id, points, cumulative, length, phase: rnd() * length };
}

/** Position and heading at a wall-clock instant. */
export function walkAt(w: StudentWalk, ms: number): { position: Point; rotation: number } {
  const d = ((ms / 1000) * WALK_SPEED + w.phase) % w.length;
  let i = 1;
  while (i < w.cumulative.length - 1 && w.cumulative[i] < d) i++;
  const a = w.points[i - 1], b = w.points[i];
  const seg = w.cumulative[i] - w.cumulative[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (d - w.cumulative[i - 1]) / seg));
  return { position: [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t], rotation: Math.atan2(b[0] - a[0], b[2] - a[2]) };
}

export const campusStudentWalks = Array.from({ length: CAMPUS_STUDENT_COUNT }, (_, i) => buildWalk(`campus-student-${i}`));

/** Two friends chatting at the Love Garden edge (standing, so they never take a player's seat). */
export const gardenChatters: Array<{ id: string; position: Point; rotation: number }> = [
  { id: 'garden-chat-a', position: [LOVE_GARDEN.centre[0] + 5.3, 0, LOVE_GARDEN.centre[2] - 5.2], rotation: 0 },
  { id: 'garden-chat-b', position: [LOVE_GARDEN.centre[0] + 5.3, 0, LOVE_GARDEN.centre[2] - 4.0], rotation: Math.PI },
];
