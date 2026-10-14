import React, { useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { InnerShell } from './InnerShell';
import { useGameStore } from '../../stores/gameStore';
import { useDayNight } from './dayNight';
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

// ---- Inside: a reading hall (west) and a multipurpose hall with a stage (east), joined by one room.
// Walls are 0.6 m thick, centred on the old footprint edges so the outside collision is unchanged.
const WALL_X = W / 2 - 0.3, WALL_Z = D / 2; // wall centre lines
export const ACAD_ROOM = { minX: -W / 2 + 0.6, maxX: W / 2 - 0.6, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3, height: 4 };
const DOOR = { x: ENTRANCE_X, half: 0.9, top: 2.6 };
const TABLES: [number, number][] = [-13, -8.5, -4].flatMap((x) => [-1.4, 2.4].map((z) => [x, z] as [number, number]));

function buildInside() {
  const b = new VisualBuilder();
  b.box([0, 0.03, 0], [W - 1, 0.06, D - 0.5], 'clinicTile');
  // Skirting.
  b.box([0, 0.12, -D / 2 + 0.32], [W - 1.2, 0.24, 0.04], 'concrete');
  // Ceiling light panels.
  for (const x of [-12, -6, 0, 6, 12]) for (const z of [-2.5, 2.5]) b.box([x, ACAD_ROOM.height - 0.05, z], [2.2, 0.06, 0.5], 'clinicSheet');
  // Reading hall: bookshelves along the back wall, then tables with four chairs each.
  const spines = ['tomato', 'green', 'engBlue', 'ochre', 'terracotta'] as const;
  for (let i = 0; i < 6; i++) {
    const x = -15 + i * 2.2;
    b.box([x, 1.1, -D / 2 + 0.7], [1.9, 2.2, 0.5], 'wood');
    for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++)
      b.box([x - 0.8 + k * 0.27, 0.45 + r * 0.5, -D / 2 + 0.97], [0.18, 0.34, 0.06], spines[(i + r + k) % spines.length]);
  }
  const chair = (x: number, z: number, facing: 1 | -1) => {
    b.box([x, 0.45, z], [0.45, 0.06, 0.45], 'wood');
    b.box([x, 0.9, z - facing * 0.2], [0.45, 0.8, 0.05], 'wood');
    for (const dx of [-0.19, 0.19]) for (const dz of [-0.19, 0.19]) b.box([x + dx, 0.22, z + dz], [0.04, 0.44, 0.04], 'metal');
  };
  for (const [x, z] of TABLES) {
    b.box([x, 0.76, z], [3, 0.08, 1.2], 'wood');
    for (const dx of [-1.4, 1.4]) for (const dz of [-0.5, 0.5]) b.box([x + dx, 0.38, z + dz], [0.07, 0.76, 0.07], 'metal');
    for (const dx of [-0.9, 0.9]) { chair(x + dx, z - 1.0, -1); chair(x + dx, z + 1.0, 1); }
    b.box([x, 0.86, z], [0.5, 0.1, 0.35], 'engBlue'); // a book left open
  }
  // Multipurpose hall: stage, screen, lectern and rows of chairs facing the stage.
  b.box([8.5, 0.2, -D / 2 + 1.3], [11, 0.4, 2.2], 'wood');
  b.box([8.5, 2.5, -D / 2 + 0.34], [6.4, 2.2, 0.05], 'clinicSheet');
  b.box([8.5, 3.7, -D / 2 + 0.34], [6.6, 0.08, 0.06], 'metal');
  b.box([8.5, 0.95, -D / 2 + 1.5], [0.7, 1.1, 0.5], 'acadPink');
  b.box([8.5, 1.55, -D / 2 + 1.5], [0.8, 0.06, 0.6], 'acadWhite');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) chair(3.6 + c * 1.2 + (c > 3 ? 0.9 : 0), -1.2 + r * 1.2, -1);
  // Notice board by the door.
  b.box([W / 2 - 0.62, 1.8, 2.6], [0.06, 1.3, 2.4], 'wood');
  for (let k = 0; k < 6; k++) b.box([W / 2 - 0.66, 1.5 + (k % 2) * 0.55, 1.8 + (k >> 1) * 0.65], [0.02, 0.4, 0.5], spines[k % spines.length]);
  // A bench in the lobby.
  b.box([ENTRANCE_X - 2.5, 0.45, 4.9], [2, 0.08, 0.5], 'wood');
  for (const dx of [-0.8, 0.8]) b.box([ENTRANCE_X - 2.5 + dx, 0.22, 4.9], [0.08, 0.44, 0.4], 'metal');
  return b.finish();
}
// Solid furniture and the walls (with the doorway left open).
const SOLIDS: { p: [number, number, number]; h: [number, number, number] }[] = [
  { p: [0, 2.2, -WALL_Z], h: [W / 2, 2.2, 0.3] },
  { p: [-WALL_X, 2.2, 0], h: [0.3, 2.2, D / 2] },
  { p: [WALL_X, 2.2, 0], h: [0.3, 2.2, D / 2] },
  { p: [(-W / 2 + DOOR.x - DOOR.half) / 2, 2.2, WALL_Z], h: [(DOOR.x - DOOR.half + W / 2) / 2, 2.2, 0.3] },
  { p: [(DOOR.x + DOOR.half + W / 2) / 2, 2.2, WALL_Z], h: [(W / 2 - DOOR.x - DOOR.half) / 2, 2.2, 0.3] },
  { p: [DOOR.x, (DOOR.top + 4.4) / 2, WALL_Z], h: [DOOR.half, (4.4 - DOOR.top) / 2, 0.3] },
  ...TABLES.map(([x, z]) => ({ p: [x, 0.5, z] as [number, number, number], h: [1.5, 0.5, 0.6] as [number, number, number] })),
  { p: [8.5, 0.2, -D / 2 + 1.3], h: [5.5, 0.2, 1.1] },
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ p: [-15 + i * 2.2, 1.1, -D / 2 + 0.7] as [number, number, number], h: [0.95, 1.1, 0.25] as [number, number, number] })),
];

export function AcadBuilding() {
  const outside = useMemo(buildAcad, []);
  const insideBatches = useMemo(buildInside, []);
  useEffect(() => () => [...outside, ...insideBatches].forEach((g) => g.geometry.dispose()), [outside, insideBatches]);
  const night = useDayNight((st) => st.night);
  const [inside, setInside] = useState(false);
  useFrame(() => {
    const [x, , z] = useGameStore.getState().myPosition;
    const lx = x - ACAD.position[0], lz = z - ACAD.position[2];
    const now = lx > ACAD_ROOM.minX && lx < ACAD_ROOM.maxX && lz > ACAD_ROOM.minZ && lz < ACAD_ROOM.maxZ;
    setInside((was) => (was === now ? was : now));
  });
  const R = ACAD_ROOM;
  return (
    <group name="campus_acad" position={ACAD.position}>
      {/* Inside, the outer shell goes and the hall's own walls and ceiling close in around you. */}
      {!inside && <StaticBatches batches={outside} />}
      {inside && (
        <>
          <StaticBatches batches={insideBatches} />
          <InnerShell rect={{ minX: R.minX, maxX: R.maxX, minZ: R.minZ, maxZ: R.maxZ }} height={R.height} wall="#f3f1ea" ceiling="#fbfbf7"
            dado={{ color: '#cf3f7c', height: 0.9 }} openings={[{ side: 'south', centre: DOOR.x, half: DOOR.half, top: DOOR.top }]} />
          <group position={[-9, 3.35, -D / 2 + 0.36]}><CampusSign width={4.2} height={0.6} title="READING HALL" subtitle="Quiet study · bring your own notes" tone="cream" /></group>
          <group position={[8.5, 3.95, -D / 2 + 0.36]}><CampusSign width={4.6} height={0.4} title="MULTIPURPOSE HALL" tone="cream" /></group>
          <pointLight position={[-8, 3.4, 0]} intensity={night * 40} distance={20} decay={1.6} color="#fff1d6" />
          <pointLight position={[8, 3.4, 0]} intensity={night * 40} distance={20} decay={1.6} color="#fff1d6" />
        </>
      )}
      <RigidBody type="fixed" colliders={false}>
        {SOLIDS.map((c, i) => <CuboidCollider key={i} args={c.h} position={c.p} />)}
        <CuboidCollider args={[0.9, 4.5, 0.9]} position={[-W / 2 - 3, 4.5, -2]} />
      </RigidBody>
      {!inside && <CampusSign position={[8.25, FLOOR * 2 + 0.6, FRONT + 0.1]} width={4} height={0.85} title="ACADEMIC BUILDING" subtitle="ACAD · FUNAAB" tone="cream" />}
    </group>
  );
}
