import React, { useMemo } from 'react';
import * as THREE from 'three';

export interface ShellOpening { side: 'west' | 'east' | 'north' | 'south'; centre: number; half: number; top: number }
interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }

/**
 * The inside of a building as one-sided panels that face into the room: walls all round (with
 * openings for doors) and a ceiling. They're only drawn from the room side, so standing inside you
 * are enclosed, while a wall between the camera and you disappears instead of blocking the view.
 * Coordinates are local to the building. Show it only while the local player is inside.
 */
export function InnerShell({ rect, height, wall, ceiling, dado, neon = [], openings = [] }: {
  rect: Rect; height: number; wall: string; ceiling: string; dado?: { color: string; height: number }; openings?: ShellOpening[];
  /** Glowing strips running round the walls at a height (unlit, so they read in the dark). */
  neon?: Array<{ color: string; y: number }>;
}) {
  const mats = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: wall, roughness: 0.95 }),
    ceiling: new THREE.MeshStandardMaterial({ color: ceiling, roughness: 1 }),
    dado: new THREE.MeshStandardMaterial({ color: dado?.color ?? wall, roughness: 0.9 }),
  }), [wall, ceiling, dado?.color]);
  const { minX, maxX, minZ, maxZ } = rect;
  // Each side: where its plane sits, which way it faces, and how long it runs.
  const sides = [
    { side: 'north' as const, pos: (a: number): [number, number] => [a, minZ + 0.012], rotY: 0, from: minX, to: maxX },
    { side: 'south' as const, pos: (a: number): [number, number] => [a, maxZ - 0.012], rotY: Math.PI, from: minX, to: maxX },
    { side: 'west' as const, pos: (a: number): [number, number] => [minX + 0.012, a], rotY: Math.PI / 2, from: minZ, to: maxZ },
    { side: 'east' as const, pos: (a: number): [number, number] => [maxX - 0.012, a], rotY: -Math.PI / 2, from: minZ, to: maxZ },
  ];
  /** A flat panel from a to b along the side, between heights y0 and y1. */
  const panel = (key: string, s: (typeof sides)[number], a: number, b: number, y0: number, y1: number, material: THREE.Material) => {
    if (b - a < 0.01 || y1 - y0 < 0.01) return null;
    const [x, z] = s.pos((a + b) / 2);
    return (
      <mesh key={key} position={[x, (y0 + y1) / 2, z]} rotation={[0, s.rotY, 0]} material={material} receiveShadow>
        <planeGeometry args={[b - a, y1 - y0]} />
      </mesh>
    );
  };
  return (
    <group>
      {sides.flatMap((s) => {
        const holes = openings.filter((o) => o.side === s.side).sort((p, q) => p.centre - q.centre);
        const out: React.ReactNode[] = [];
        // Cut the side at each opening: full-height pieces between, a lintel above each opening.
        let cursor = s.from;
        holes.forEach((o, i) => {
          const a = o.centre - o.half, b = o.centre + o.half;
          out.push(panel(`${s.side}-w${i}`, s, cursor, a, 0, height, mats.wall), panel(`${s.side}-l${i}`, s, a, b, o.top, height, mats.wall));
          cursor = b;
        });
        out.push(panel(`${s.side}-w`, s, cursor, s.to, 0, height, mats.wall));
        neon.forEach((n, k) => {
          const m = new THREE.MeshBasicMaterial({ color: n.color, toneMapped: false });
          const inset = { ...s, pos: (a: number): [number, number] => { const [x, z] = s.pos(a); return [x + (s.side === 'west' ? 0.012 : s.side === 'east' ? -0.012 : 0), z + (s.side === 'north' ? 0.012 : s.side === 'south' ? -0.012 : 0)]; } };
          let c3 = s.from;
          holes.forEach((o, i) => { out.push(panel(`${s.side}-n${k}-${i}`, inset, c3, o.centre - o.half, n.y, n.y + 0.09, m)); c3 = o.centre + o.half; });
          out.push(panel(`${s.side}-n${k}`, inset, c3, s.to, n.y, n.y + 0.09, m));
        });
        if (dado) {
          let c2 = s.from;
          holes.forEach((o, i) => { out.push(panel(`${s.side}-d${i}`, { ...s, pos: (a) => { const [x, z] = s.pos(a); return [x + (s.side === 'west' ? 0.006 : s.side === 'east' ? -0.006 : 0), z + (s.side === 'north' ? 0.006 : s.side === 'south' ? -0.006 : 0)]; } }, c2, o.centre - o.half, 0, dado.height, mats.dado)); c2 = o.centre + o.half; });
          out.push(panel(`${s.side}-d`, { ...s, pos: (a) => { const [x, z] = s.pos(a); return [x + (s.side === 'west' ? 0.006 : s.side === 'east' ? -0.006 : 0), z + (s.side === 'north' ? 0.006 : s.side === 'south' ? -0.006 : 0)]; } }, c2, s.to, 0, dado.height, mats.dado));
        }
        return out;
      })}
      {/* Ceiling: faces down, so it shows from inside and vanishes when the camera is above it. */}
      <mesh position={[(minX + maxX) / 2, height - 0.01, (minZ + maxZ) / 2]} rotation={[Math.PI / 2, 0, 0]} material={mats.ceiling}>
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
      </mesh>
    </group>
  );
}
