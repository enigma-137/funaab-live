import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  CHANCEL, CHAPEL, CHAPEL_PEWS, IMAM_SPOT, MAT_SIZE, MOSQUE, MOSQUE_MATS, PASTOR_SPOT, PEW_SIZE, PULPIT,
  inWorshipPlace, worshipOpen, worshipSign, type WorshipPlace,
} from '../../config/worship';
import { npcAppearance } from '../../config/npcAppearance';
import { useGameStore } from '../../stores/gameStore';
import { AvatarBody } from '../player/AvatarBody';
import { VisualBuilder, type Batch, type MaterialKey, type V3 } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';
import { InnerShell } from './InnerShell';

const T = 0.3; // wall thickness

/** Four walls with a door gap in the south (+Z) wall. Building-local. */
function walls(b: VisualBuilder, p: WorshipPlace, m: MaterialKey) {
  const [W, D] = p.size, H = p.wallHeight, DOOR = p.doorHalfWidth;
  b.box([0, H / 2, -D / 2], [W, H, T], m);
  for (const s of [-1, 1]) b.box([s * W / 2, H / 2, 0], [T, H, D], m);
  const side = (W / 2 - DOOR) / 2;
  for (const s of [-1, 1]) b.box([s * (DOOR + side), H / 2, D / 2], [side * 2, H, T], m);
  b.box([0, H - 0.9, D / 2], [DOOR * 2, 1.8, T], m); // lintel
}

/** Arched window on an outside wall: glass with a coloured surround. */
function archWindow(b: VisualBuilder, at: V3, rotY: number, w: number, h: number, frame: MaterialKey, glass: MaterialKey) {
  const r: V3 = [0, rotY, 0];
  b.box(at, [w + 0.24, h + 0.24, 0.08], frame, r);
  b.box([at[0], at[1], at[2]], [w, h, 0.1], glass, r);
  // Upper half-disc in the wall plane: start the sweep at 90° so it rises above the opening.
  const arch = (r: number, t: number) => new THREE.CylinderGeometry(r, r, t, 14, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateY(rotY);
  b.add(arch(w / 2 + 0.12, 0.08), frame, [at[0], at[1] + h / 2, at[2]]);
  b.add(arch(w / 2, 0.1), glass, [at[0], at[1] + h / 2, at[2]]);
}

/** Windows on both long sides and the back, placed just proud of the outside face. */
function sideWindows(b: VisualBuilder, p: WorshipPlace, n: number, w: number, h: number, y: number, frame: MaterialKey, glass: (i: number) => MaterialKey) {
  const [W, D] = p.size;
  for (let i = 0; i < n; i++) {
    const z = -D / 2 + (D / (n + 1)) * (i + 1);
    for (const s of [-1, 1]) archWindow(b, [s * (W / 2 + T / 2 + 0.05), y, z], Math.PI / 2, w, h, frame, glass(i));
  }
}

// ---------------------------------------------------------------- Mosque

function buildMosqueOutside(): Batch[] {
  const b = new VisualBuilder(), p = MOSQUE, [W, D] = p.size, H = p.wallHeight;
  walls(b, p, 'mosqueCream');
  // Green plinth and cornice bands all round.
  b.box([0, 0.35, 0], [W + T + 0.1, 0.7, D + T + 0.1], 'mosqueGreenDark');
  b.box([0, H - 0.25, 0], [W + T + 0.25, 0.5, D + T + 0.25], 'mosqueGreen');
  // Flat roof with a low parapet; drum and green dome in the middle.
  b.box([0, H + 0.1, 0], [W + 0.3, 0.2, D + 0.3], 'mosqueCream');
  for (const s of [-1, 1]) {
    b.box([0, H + 0.45, s * (D / 2 + 0.05)], [W + 0.3, 0.5, 0.25], 'mosqueCream');
    b.box([s * (W / 2 + 0.05), H + 0.45, 0], [0.25, 0.5, D + 0.3], 'mosqueCream');
  }
  b.add(new THREE.CylinderGeometry(3.7, 3.7, 1.6, 24), 'mosqueCream', [0, H + 0.95, -1]);
  b.add(new THREE.CylinderGeometry(3.85, 3.85, 0.25, 24), 'mosqueGreen', [0, H + 1.8, -1]);
  b.add(new THREE.SphereGeometry(3.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 'mosqueGreen', [0, H + 1.8, -1]);
  b.pole([0, H + 6.0, -1], 0.08, 1.2, 'gold');
  b.orb([0, H + 5.6, -1], [0.22, 0.22, 0.22], 'gold');
  b.add(new THREE.TorusGeometry(0.36, 0.07, 6, 16, Math.PI * 1.4), 'gold', [0, H + 6.75, -1], [1, 1, 1], [0, 0, 0.9]);
  // Arched windows along the sides and the back.
  sideWindows(b, p, 4, 1.3, 2.2, 3.1, 'mosqueGreen', () => 'glass');
  for (const x of [-6.5, 0, 6.5]) archWindow(b, [x, 3.1, -D / 2 - T / 2 - 0.05], 0, 1.3, 2.2, 'mosqueGreen', 'glass');
  // Grand entrance portal: a tall green arch frame around the door, with steps.
  const z = D / 2 + 0.2;
  for (const s of [-1, 1]) b.box([s * 2.6, 2.6, z], [0.7, 5.2, 0.5], 'mosqueGreen');
  b.box([0, 5.0, z], [5.9, 0.8, 0.5], 'mosqueGreen');
  for (let i = 0; i < 3; i++) b.box([0, 0.06 + i * 0.06, D / 2 + 0.9 + (2 - i) * 0.35], [7 - i * 0.6, 0.12 + i * 0.12, 0.7], 'paving');
  // Minaret at the front-right corner.
  const mx = W / 2 + 1.6, mz = D / 2 - 1.6;
  b.add(new THREE.CylinderGeometry(1.0, 1.15, 14, 16), 'mosqueCream', [mx, 7, mz]);
  for (const y of [5, 9.5]) b.add(new THREE.CylinderGeometry(1.08, 1.08, 0.4, 16), 'mosqueGreen', [mx, y, mz]);
  b.add(new THREE.CylinderGeometry(1.5, 1.5, 0.25, 16), 'mosqueCream', [mx, 12.2, mz]);
  b.add(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16, 1, true), 'mosqueGreen', [mx, 12.6, mz]);
  b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.6, 12), 'mosqueCream', [mx, 14.6, mz]);
  b.add(new THREE.ConeGeometry(0.95, 1.8, 12), 'mosqueGreen', [mx, 16.3, mz]);
  b.pole([mx, 17.5, mz], 0.06, 0.8, 'gold');
  b.add(new THREE.TorusGeometry(0.25, 0.05, 6, 14, Math.PI * 1.4), 'gold', [mx, 18.05, mz], [1, 1, 1], [0, 0, 0.9]);
  return b.finish();
}

function buildMosqueInside(): Batch[] {
  const b = new VisualBuilder(), [W, D] = MOSQUE.size;
  b.box([0, 0.02, 0], [W - 0.4, 0.04, D - 0.4], 'mosqueGreenDark');
  // Prayer mats: green with a red head band toward the qibla wall.
  const [mw, md] = MAT_SIZE;
  MOSQUE_MATS.forEach((m, i) => {
    b.box([m.x, 0.05, m.z], [mw, 0.02, md], (i + Math.floor(i / 8)) % 2 ? 'matGreen' : 'matRed');
    b.box([m.x, 0.065, m.z - md / 2 + 0.12], [mw, 0.012, 0.18], 'gold');
  });
  // Mihrab: a niche framed in green and gold in the middle of the qibla (north) wall.
  const z = -D / 2 + 0.2;
  b.box([0, 1.9, z], [2.4, 3.8, 0.12], 'mosqueGreen');
  b.box([0, 1.6, z + 0.05], [1.6, 3.2, 0.06], 'mosqueGreenDark');
  b.add(new THREE.TorusGeometry(0.85, 0.1, 6, 18, Math.PI), 'gold', [0, 3.2, z + 0.1]);
  // Minbar (pulpit stairs) to the right of the mihrab.
  for (let i = 0; i < 4; i++) b.box([2.6, 0.2 + i * 0.2, z + 0.6 + (3 - i) * 0.35], [0.9, 0.4 + i * 0.4, 0.35], 'wood');
  b.box([2.6, 2.0, z + 0.45], [1.0, 0.12, 0.6], 'wood');
  // Chandelier ring.
  b.add(new THREE.TorusGeometry(1.4, 0.05, 6, 24), 'gold', [0, 4.8, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.orb([Math.cos(a) * 1.4, 4.75, Math.sin(a) * 1.4], [0.09, 0.12, 0.09], 'ivory'); }
  b.pole([0, 5.4, 0], 0.02, 1.2, 'gold');
  return b.finish();
}

// ---------------------------------------------------------------- Chapel

/** A gable roof whose ridge runs north–south (along Z). */
function gable(w: number, d: number, y: number, rise: number): THREE.BufferGeometry {
  const x = w / 2, z = d / 2;
  const v = [[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z], [0, y + rise, -z], [0, y + rise, z]];
  const faces = [[0, 4, 5], [0, 5, 3], [1, 2, 5], [1, 5, 4], [0, 1, 4], [3, 5, 2], [0, 3, 2], [0, 2, 1]];
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(faces.flatMap((f) => f.flatMap((i) => v[i])), 3));
  g.computeVertexNormals();
  return g;
}

function buildChapelOutside(): Batch[] {
  const b = new VisualBuilder(), p = CHAPEL, [W, D] = p.size, H = p.wallHeight;
  walls(b, p, 'chapelCream');
  b.box([0, 0.3, 0], [W + T + 0.1, 0.6, D + T + 0.1], 'stone');
  // Stone quoins on the corners.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) b.box([sx * (W / 2), 0.9 + i * 1.1, sz * (D / 2)], [0.62, 0.55, 0.62], 'stone');
  // Gable ends (triangles above the walls) and the slate roof.
  const rise = 3.6;
  const tri = (zz: number) => {
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-W / 2, H, zz, W / 2, H, zz, 0, H + rise, zz, W / 2, H, zz, -W / 2, H, zz, 0, H + rise, zz], 3));
    g.computeVertexNormals();
    b.add(g, 'chapelCream');
  };
  tri(D / 2 + 0.15); tri(-D / 2 - 0.15);
  b.add(gable(W + 1.2, D + 0.8, H, rise + 0.2), 'chapelSlate');
  // Rose window and cross on the front gable.
  b.add(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 18), 'gold', [0, H + 1.4, D / 2 + 0.18], [1, 1, 1], [Math.PI / 2, 0, 0]);
  b.add(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 18), 'stainBlue', [0, H + 1.4, D / 2 + 0.2], [1, 1, 1], [Math.PI / 2, 0, 0]);
  b.box([0, H + rise + 0.9, D / 2 + 0.3], [0.18, 1.6, 0.18], 'gold');
  b.box([0, H + rise + 1.25, D / 2 + 0.3], [0.9, 0.18, 0.18], 'gold');
  // Tall stained-glass windows along the sides.
  const glass: MaterialKey[] = ['stainBlue', 'stainRed', 'stainAmber'];
  sideWindows(b, p, 4, 1.0, 2.8, 3.0, 'stone', (i) => glass[i % 3]);
  // Porch: a canopy on two pillars over the door, with steps.
  const pz = D / 2 + 1.6;
  for (const s of [-1, 1]) b.box([s * 2.2, 1.9, pz + 0.9], [0.5, 3.8, 0.5], 'chapelCream');
  b.box([0, 3.95, pz + 0.2], [5.2, 0.3, 3.2], 'chapelCream');
  b.add(gable(5.4, 3.4, 4.11, 1.1), 'chapelSlate', [0, 0, pz + 0.2]);
  for (let i = 0; i < 3; i++) b.box([0, 0.06 + i * 0.06, D / 2 + 0.5 + (2 - i) * 0.4], [5 - i * 0.4, 0.12 + i * 0.12, 0.8], 'paving');
  return b.finish();
}

function buildChapelInside(): Batch[] {
  const b = new VisualBuilder(), [W, D] = CHAPEL.size;
  b.box([0, 0.02, 0], [W - 0.4, 0.04, D - 0.4], 'paving');
  // Red carpet down the central aisle to the chancel.
  b.box([0, 0.05, (CHANCEL.maxZ + D / 2) / 2], [1.6, 0.02, D / 2 - CHANCEL.maxZ], 'aisleRed');
  // Pews: seat, back and end panels, facing the pulpit (north).
  const [pw, pd] = PEW_SIZE;
  for (const p of CHAPEL_PEWS) {
    b.box([p.x, 0.45, p.z], [pw, 0.08, pd], 'pewWood');
    b.box([p.x, 0.75, p.z + pd / 2 - 0.04], [pw, 0.6, 0.07], 'pewWood');
    for (const s of [-1, 1]) b.box([p.x + s * (pw / 2 - 0.04), 0.45, p.z], [0.07, 0.9, pd], 'pewWood');
  }
  // Raised chancel with steps, pulpit, altar and a large cross on the north wall.
  const cd = CHANCEL.maxZ - CHANCEL.minZ, cz = (CHANCEL.maxZ + CHANCEL.minZ) / 2;
  b.box([0, CHANCEL.height / 2, cz], [W - 0.6, CHANCEL.height, cd], 'wood');
  b.box([0, CHANCEL.height / 4, CHANCEL.maxZ + 0.3], [4, CHANCEL.height / 2, 0.6], 'wood');
  const [px, , pz] = PULPIT;
  b.box([px, CHANCEL.height + 0.55, pz], [0.9, 1.1, 0.6], 'pewWood');
  b.box([px, CHANCEL.height + 1.15, pz - 0.05], [1.0, 0.08, 0.7], 'wood', [0.25, 0, 0]);
  b.box([-3.2, CHANCEL.height + 0.45, -8.8], [1.8, 0.9, 0.8], 'ivory');
  b.box([0, 3.6, -D / 2 + 0.25], [0.35, 3.2, 0.15], 'pewWood');
  b.box([0, 4.3, -D / 2 + 0.25], [1.7, 0.35, 0.15], 'pewWood');
  // Stained glass seen from inside (the outside walls hide these from the street).
  const glass: MaterialKey[] = ['stainBlue', 'stainRed', 'stainAmber'];
  for (let i = 0; i < 4; i++) {
    const z = -D / 2 + (D / 5) * (i + 1);
    for (const s of [-1, 1]) b.box([s * (W / 2 - 0.17), 3.0, z], [0.02, 2.8, 1.0], glass[i % 3]);
  }
  return b.finish();
}

// ---------------------------------------------------------------- Shared shell

const LOOK = {
  imam: npcAppearance('mosque-imam', { bodyType: 'masculine', topStyle: 'kaftan', topColor: '#f8fafc', bottomStyle: 'trousers', bottomColor: '#f1f5f9', headwear: 'kufi', headwearColor: '#ffffff', shoeStyle: 'sandals' }),
  pastor: npcAppearance('chapel-pastor', { bodyType: 'masculine', topStyle: 'jacket', topColor: '#1f2937', bottomStyle: 'trousers', bottomColor: '#1f2937', headwear: 'none', shoeStyle: 'boots', shoeColor: '#111111' }),
};

function useWorshipState(place: WorshipPlace) {
  const [open, setOpen] = useState(() => worshipOpen(place, Date.now()));
  const [inside, setInside] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setOpen(worshipOpen(place, Date.now()));
      setInside(inWorshipPlace(place, useGameStore.getState().myPosition));
    }, 500);
    return () => clearInterval(t);
  }, [place]);
  return { open, inside };
}

function Building({ place, outside, inside: insideBatches, shell, children, colliders }: {
  place: WorshipPlace; outside: Batch[]; inside: Batch[]; shell: { wall: string; ceiling: string; dado: string };
  children?: React.ReactNode; colliders?: React.ReactNode;
}) {
  const { open, inside } = useWorshipState(place);
  const [W, D] = place.size, H = place.wallHeight, DOOR = place.doorHalfWidth;
  const side = (W / 2 - DOOR) / 2;
  const sign = worshipSign(place, Date.now());
  // Doors swing inward when open. Shut, they also block the way in (never the way out).
  const leaf = (s: number) => (
    <group key={s} position={[s * DOOR, 0, D / 2]} rotation={[0, open ? -s * 1.9 : 0, 0]}>
      <mesh position={[-s * DOOR / 2, (H - 1.8) / 2, 0]}>
        <boxGeometry args={[DOOR, H - 1.8, 0.1]} />
        <meshStandardMaterial color={place.id === 'mosque' ? '#14532d' : '#5b3a1e'} roughness={0.7} />
      </mesh>
    </group>
  );
  return (
    <group position={place.centre} name={place.id}>
      <StaticBatches batches={insideBatches} />
      {inside ? (
        <InnerShell rect={{ minX: -W / 2 + T / 2, maxX: W / 2 - T / 2, minZ: -D / 2 + T / 2, maxZ: D / 2 - T / 2 }} height={H}
          wall={shell.wall} ceiling={shell.ceiling} dado={{ color: shell.dado, height: 1.1 }}
          openings={[{ side: 'south', centre: 0, half: DOOR, top: H - 1.8 }]} />
      ) : (
        <StaticBatches batches={outside} />
      )}
      {[-1, 1].map(leaf)}
      <CampusSign position={[0, H - 0.6, D / 2 + 0.45]} width={place.id === 'mosque' ? 6.2 : 5.2} height={1.1}
        title={place.name.toUpperCase()} subtitle={sign.toUpperCase()} />
      {/* A post sign at the walkway so the opening day reads from a distance. */}
      <group position={[DOOR + 2.6, 0, D / 2 + 3.2]}>
        <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.06, 0.06, 1.8, 8]} /><meshStandardMaterial color="#334155" /></mesh>
        <CampusSign position={[0, 1.9, 0.05]} width={2.6} height={0.8} title={place.shortName.toUpperCase()} subtitle={sign} tone={open ? 'green' : 'cream'} />
      </group>
      {inside && open && <pointLight position={[0, H - 1.2, 0]} intensity={8} distance={D + 4} decay={1.4} color="#fff3d6" />}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, H / 2, -D / 2]} args={[W / 2, H / 2, T / 2]} />
        {[-1, 1].map((s) => <CuboidCollider key={`w${s}`} position={[s * W / 2, H / 2, 0]} args={[T / 2, H / 2, D / 2]} />)}
        {[-1, 1].map((s) => <CuboidCollider key={`f${s}`} position={[s * (DOOR + side), H / 2, D / 2]} args={[side, H / 2, T / 2]} />)}
        {colliders}
      </RigidBody>
      {!open && !inside && (
        <RigidBody type="fixed" colliders={false} key="shut">
          <CuboidCollider position={[0, 1.5, D / 2]} args={[DOOR, 1.5, T]} />
        </RigidBody>
      )}
      {children}
    </group>
  );
}

export function Mosque() {
  const outside = useMemo(buildMosqueOutside, []);
  const inside = useMemo(buildMosqueInside, []);
  const [W, D] = MOSQUE.size;
  return (
    <Building place={MOSQUE} outside={outside} inside={inside} shell={{ wall: '#f1e8cf', ceiling: '#e9dfc4', dado: '#1f6f43' }}
      colliders={<>
        {/* Minbar, and the minaret outside the front-right corner. */}
        <CuboidCollider position={[2.6, 0.9, -D / 2 + 1.1]} args={[0.5, 0.9, 0.8]} />
        <CuboidCollider position={[W / 2 + 1.6, 7, D / 2 - 1.6]} args={[1.1, 7, 1.1]} />
        {[-1, 1].map((s) => <CuboidCollider key={s} position={[s * 2.6, 2.6, D / 2 + 0.2]} args={[0.35, 2.6, 0.25]} />)}
        {/* The Imam stands his ground: walk round him, not through him. */}
        <CuboidCollider position={[IMAM_SPOT[0], 0.9, IMAM_SPOT[2]]} args={[0.3, 0.9, 0.3]} />
      </>}>
      <group position={IMAM_SPOT} rotation={[0, Math.PI, 0]}>
        <AvatarBody identity="mosque-imam" config={LOOK.imam} animation="idle" />
      </group>
    </Building>
  );
}

export function Chapel() {
  const outside = useMemo(buildChapelOutside, []);
  const inside = useMemo(buildChapelInside, []);
  const [, D] = CHAPEL.size;
  const [pw, pd] = PEW_SIZE;
  const cz = (CHANCEL.maxZ + CHANCEL.minZ) / 2, cd = CHANCEL.maxZ - CHANCEL.minZ;
  return (
    <Building place={CHAPEL} outside={outside} inside={inside} shell={{ wall: '#f3ead6', ceiling: '#6b4a2f', dado: '#7a4b2a' }}
      colliders={<>
        {CHAPEL_PEWS.map((p, i) => <CuboidCollider key={i} position={[p.x, 0.45, p.z]} args={[pw / 2, 0.45, pd / 2]} />)}
        <CuboidCollider position={[0, CHANCEL.height / 2, cz]} args={[CHAPEL.size[0] / 2 - 0.3, CHANCEL.height / 2, cd / 2]} />
        {[-1, 1].map((s) => <CuboidCollider key={s} position={[s * 2.2, 1.9, D / 2 + 2.5]} args={[0.25, 1.9, 0.25]} />)}
      </>}>
      <group position={[PASTOR_SPOT[0], CHANCEL.height, PASTOR_SPOT[2]]}>
        <AvatarBody identity="chapel-pastor" config={LOOK.pastor} animation="idle" />
      </group>
    </Building>
  );
}

export function WorshipPlaces() {
  return (<><Mosque /><Chapel /></>);
}
