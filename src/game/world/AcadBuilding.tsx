import React, { useEffect, useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { locationById } from '../../config/campusLocations';
import { VisualBuilder, type MaterialKey } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';

// Acad, after the real Academic Building beside the Sports Centre: a long three-storey white
// block broken into bays: a painted-red end, face-brick stair towers, a projecting white bay
// with magenta-pink window surrounds and balcony, a dark glazed strip, and a pink end block
// with the entrance stairs. Front facade faces the pitch (+Z).
export const ACAD = locationById('acad');
const [W, D] = ACAD.footprint; // 34 × 12
const FRONT = D / 2;
const FLOOR = 3.4;

type Bay = { w: number; kind: 'red' | 'white' | 'brick' | 'feature' | 'glass' | 'pink'; h: number };
// Left (-X) to right (+X) as seen from the pitch.
const BAYS: Bay[] = [
  { w: 4, kind: 'red', h: 9.6 },
  { w: 2.5, kind: 'white', h: 10.2 },
  { w: 2.5, kind: 'brick', h: 11.6 },
  { w: 6, kind: 'feature', h: 11.2 },
  { w: 1.5, kind: 'glass', h: 10.6 },
  { w: 3.5, kind: 'white', h: 10.6 },
  { w: 3, kind: 'brick', h: 11.6 },
  { w: 4.5, kind: 'white', h: 10.2 },
  { w: 2.5, kind: 'brick', h: 11.2 },
  { w: 4, kind: 'pink', h: 10.6 },
];
const WALL: Record<Bay['kind'], MaterialKey> = {
  red: 'acadRed', white: 'acadWhite', brick: 'brick', feature: 'acadWhite', glass: 'shadow', pink: 'acadPink',
};
const ENTRANCE_X = -W / 2 + BAYS.slice(0, 9).reduce((n, b) => n + b.w, 0) + 2; // centre of the pink end bay

function buildAcad() {
  const b = new VisualBuilder();
  let x = -W / 2;
  for (const bay of BAYS) {
    const cx = x + bay.w / 2;
    const proud = bay.kind === 'brick' || bay.kind === 'feature' ? 0.6 : bay.kind === 'pink' ? 0.3 : 0;
    b.box([cx, bay.h / 2, proud / 2], [bay.w, bay.h, D + proud], WALL[bay.kind]);
    // Parapet cap.
    b.box([cx, bay.h + 0.12, proud / 2], [bay.w + 0.1, 0.24, D + proud + 0.1], bay.kind === 'brick' ? 'concrete' : 'acadWhite');
    const face = FRONT + proud + 0.02;
    if (bay.kind === 'glass') {
      // Full-height curtain wall with spandrel bands.
      for (let f = 0; f < 3; f++) b.box([cx, FLOOR * f + 0.15, face + 0.04], [bay.w - 0.1, 0.18, 0.08], 'metal');
      b.box([cx, bay.h / 2, face + 0.04], [0.06, bay.h - 0.4, 0.08], 'metal');
    } else if (bay.kind === 'brick') {
      // Stair tower: a slot of small windows near the top.
      b.window(cx, bay.h - 1.6, face, 0.7, 0.9, 'concrete');
    } else {
      const cols = Math.max(1, Math.floor(bay.w / 1.4));
      for (let f = 0; f < 3; f++) {
        const y = FLOOR * f + 1.75;
        if (y + 0.7 > bay.h) continue;
        for (let c = 0; c < cols; c++) {
          const wx = cx - bay.w / 2 + (bay.w / cols) * (c + 0.5);
          if (bay.kind === 'feature') b.box([wx, y, face - 0.01], [1.15, 1.45, 0.05], 'acadPink');
          b.window(wx, y, face + 0.02, 0.8, 1.05, 'acadWhite');
        }
        // Split air-conditioner units under some windows, as in the photo.
        if (bay.kind === 'white' && f < 2) b.box([cx + bay.w / 4, y - 1.0, face + 0.25], [0.7, 0.45, 0.3], 'clinicSheet');
      }
      // Floor bands.
      for (let f = 1; f < 3; f++) b.box([cx, FLOOR * f, face + 0.03], [bay.w, 0.12, 0.08], bay.kind === 'pink' ? 'acadWhite' : 'concrete');
    }
    if (bay.kind === 'feature') {
      // Projecting pink top-floor box with a balcony opening.
      b.box([cx, FLOOR * 2 + 1.7, face + 0.6], [bay.w * 0.7, 2.9, 1.2], 'acadPink');
      b.box([cx, FLOOR * 2 + 1.5, face + 1.22], [bay.w * 0.5, 1.6, 0.05], 'shadow');
      b.box([cx, FLOOR * 2 + 0.55, face + 1.24], [bay.w * 0.5, 0.9, 0.06], 'acadWhite');
    }
    x += bay.w;
  }
  // Plinth along the whole front, and entrance stairs with rails in front of the pink end bay.
  b.box([0, 0.2, FRONT + 0.9], [W, 0.4, 1.8], 'concrete');
  for (let i = 0; i < 4; i++) b.box([ENTRANCE_X, 0.1 + i * 0.1, FRONT + 3.4 - i * 0.4], [3.4, 0.2 + i * 0.2, 0.4], 'concrete');
  for (const side of [-1, 1]) {
    b.box([ENTRANCE_X + side * 1.75, 0.9, FRONT + 2.6], [0.05, 0.05, 2.2], 'metal', [0.25, 0, 0]);
    for (const dz of [1.6, 2.6, 3.6]) b.pole([ENTRANCE_X + side * 1.75, 0.55, FRONT + dz], 0.03, 0.9, 'metal');
  }
  // Door.
  b.box([ENTRANCE_X, 1.45, FRONT + 0.33], [1.8, 2.5, 0.05], 'glass');
  // Rooftop water tank on a steel stand at the west end (as in the photo).
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]] as const)
    b.pole([-W / 2 - 3 + dx, 4, -2 + dz], 0.07, 8, 'metal');
  b.box([-W / 2 - 3, 8.8, -2], [2.2, 1.6, 2.2], 'tankBlack');
  return b.finish();
}

export function AcadBuilding() {
  const batches = useMemo(buildAcad, []);
  useEffect(() => () => batches.forEach((g) => g.geometry.dispose()), [batches]);
  return (
    <group name="campus_acad" position={ACAD.position}>
      <StaticBatches batches={batches} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[W / 2, 5.5, D / 2 + 0.3]} position={[0, 5.5, 0.3]} />
        <CuboidCollider args={[0.9, 4.5, 0.9]} position={[-W / 2 - 3, 4.5, -2]} />
      </RigidBody>
      <CampusSign position={[8.25, FLOOR * 2 + 0.6, FRONT + 0.1]} width={4} height={0.85} title="ACADEMIC BUILDING" subtitle="ACAD · FUNAAB" tone="cream" />
    </group>
  );
}
