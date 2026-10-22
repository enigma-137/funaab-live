import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { InnerShell } from './InnerShell';
import { VisualBuilder, type Batch, type V3 } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';
import { AvatarBody } from '../player/AvatarBody';
import { npcAppearance } from '../../config/npcAppearance';
import { GYM, GYM_BARRIER, GYM_STATIONS, gymOpen, gymPassKey, inGym, type GymStation } from '../../config/gym';
import { useGameStore } from '../../stores/gameStore';
import { useGymStore } from '../../stores/gymStore';

// FUNAAB Fitness Gym (config/gym.ts): rubber floor, mirrors, treadmills, a dumbbell rack, a squat rack,
// a punching bag and a skipping mat, with a coach at the door and members training while it's open.
const [CX, , CZ] = GYM.centre;
const [W, D] = GYM.size;
const H = GYM.wallHeight;
const DOOR = GYM.doorHalfWidth;
const T = 0.3;
const L = (p: readonly number[]): V3 => [p[0] - CX, 0, p[2] - CZ];

/** Walls with the door gap in the west wall (drawn only from outside). Gym-local. */
function buildGymWalls(): Batch[] {
  const b = new VisualBuilder();
  b.box([W / 2, H / 2, 0], [T, H, D], 'gymWall');
  b.box([0, H / 2, -D / 2], [W, H, T], 'gymWall');
  b.box([0, H / 2, D / 2], [W, H, T], 'gymWall');
  const side = (D / 2 - DOOR) / 2;
  for (const s of [-1, 1]) b.box([-W / 2, H / 2, s * (DOOR + side)], [T, H, side * 2], 'gymWall');
  b.box([-W / 2, H - 0.5, 0], [T, 1, DOOR * 2], 'gymWall');
  // An orange band all round, at the height of the signboard.
  for (const [p, s] of [[[W / 2 + 0.02, 1, 0], [T, 0.3, D]], [[0, 1, -D / 2 - 0.02], [W, 0.3, T]], [[0, 1, D / 2 + 0.02], [W, 0.3, T]]] as Array<[V3, V3]>) b.box(p, s, 'gymTrim');
  return b.finish();
}

/** Floor and every station's equipment. Gym-local. */
function buildGym(): Batch[] {
  const b = new VisualBuilder();
  b.box([0, 0.02, 0], [W, 0.04, D], 'gymFloor');
  // Mirror along the north wall behind the dumbbells.
  b.box([3, 1.4, -D / 2 + 0.2], [7, 1.8, 0.04], 'glass');
  b.box([3, 0.48, -D / 2 + 0.2], [7.2, 0.08, 0.06], 'metal');
  const stationKit = (s: GymStation) => {
    const [x, , z] = L(s.spot);
    switch (s.kind) {
      case 'treadmill': // facing north: console ahead of the runner
        b.box([x, 0.09, z - 0.1], [0.85, 0.18, 1.9], 'tankBlack');
        b.box([x, 0.185, z - 0.1], [0.62, 0.01, 1.7], 'roofDark');
        for (const sx of [-0.4, 0.4]) b.box([x + sx, 0.65, z - 0.95], [0.06, 1.1, 0.06], 'metal');
        b.box([x, 1.2, z - 0.98], [0.9, 0.28, 0.12], 'tankBlack');
        b.box([x, 1.22, z - 0.92], [0.5, 0.16, 0.01], 'engBlue');
        for (const sx of [-0.4, 0.4]) b.box([x + sx, 1.0, z - 0.6], [0.05, 0.05, 0.75], 'metal');
        break;
      case 'dumbbells': { // a two-tier rack in front of the mirror
        const rz = z - 1.2;
        b.box([x, 0.35, rz], [2.2, 0.06, 0.5], 'metal');
        b.box([x, 0.75, rz - 0.1], [2.2, 0.06, 0.4], 'metal');
        for (const sx of [-1.05, 1.05]) b.box([x + sx, 0.4, rz], [0.06, 0.8, 0.5], 'metal');
        for (let i = 0; i < 6; i++) {
          for (const [y, dz] of [[0.43, 0], [0.83, -0.1]] as const) {
            const dx = x - 0.85 + i * 0.34;
            b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), 'metal', [dx, y, rz + dz], [1, 1, 1], [0, 0, Math.PI / 2]);
            for (const e of [-0.1, 0.1]) b.add(new THREE.CylinderGeometry(0.05 + i * 0.006, 0.05 + i * 0.006, 0.05, 10), 'tankBlack', [dx + e, y, rz + dz], [1, 1, 1], [0, 0, Math.PI / 2]);
          }
        }
        break;
      }
      case 'squat': { // power rack around the lifter, barbell resting on the hooks
        for (const sx of [-0.65, 0.65]) for (const sz of [-0.65, 0.65]) b.box([x + sx, 1.15, z + sz], [0.08, 2.3, 0.08], 'gymTrim');
        for (const sx of [-0.65, 0.65]) b.box([x + sx, 2.28, z], [0.08, 0.08, 1.38], 'gymTrim');
        b.add(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 8), 'metal', [x + 0.25, 1.45, z], [1, 1, 1], [Math.PI / 2, 0, 0]);
        for (const e of [-0.85, 0.85]) b.add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18), 'tankBlack', [x + 0.25, 1.45, z + e], [1, 1, 1], [Math.PI / 2, 0, 0]);
        b.box([x, 0.025, z], [1.4, 0.05, 1.4], 'roofDark');
        break;
      }
      case 'bag': // the bag itself sways (PunchingBag below); here the beam it hangs from
        b.box([x, H - 0.3, z + 0.75], [0.12, 0.12, 1.4], 'metal');
        b.box([x, 0.02, z + 0.3], [1.6, 0.03, 1.6], 'matRed');
        break;
      case 'mat':
        b.box([x, 0.02, z], [1.6, 0.03, 1.8], 'matGreen');
        break;
    }
  };
  for (const s of GYM_STATIONS) stationKit(s);
  // Decor: benches, a water dispenser, rolled-up mats, the coach's desk by the door.
  b.box([-6.2, 0.22, -6.6], [1.2, 0.08, 0.35], 'tankBlack');
  b.box([-6.2, 0.11, -6.6], [0.1, 0.22, 0.3], 'metal');
  b.box([-8.8, 0.45, -6.8], [0.4, 0.9, 0.4], 'ivory');
  b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12), 'glass', [-8.8, 1.1, -6.8]);
  for (let i = 0; i < 4; i++) b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.65, 10), (['matGreen', 'matRed', 'engBlue', 'gymTrim'] as const)[i], [-8.9, 0.1 + i * 0.001, 4.5 + i * 0.25], [1, 1, 1], [0, 0, Math.PI / 2]);
  b.box([-7.6, 0.5, -3.2], [1.4, 1.0, 0.6], 'wood');
  b.box([-7.6, 1.02, -3.2], [1.5, 0.05, 0.7], 'roofDark');
  // The extra treadmill a member runs on.
  b.box([-5.5, 0.09, -5.7], [0.85, 0.18, 1.9], 'tankBlack');
  b.box([-5.5, 1.2, -6.58], [0.9, 0.28, 0.12], 'tankBlack');
  for (const sx of [-0.4, 0.4]) b.box([-5.5 + sx, 0.65, -6.55], [0.06, 1.1, 0.06], 'metal');
  return b.finish();
}

/** Hanging punching bag, swinging a little more while someone hits it. */
function PunchingBag({ at, busy }: { at: V3; busy: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.x = busy ? Math.max(0, Math.sin(t * 1.6 * Math.PI * 2)) * 0.12 : Math.sin(t * 0.8) * 0.015;
  });
  return (
    <group ref={ref} position={[at[0], H - 0.3, at[2] + 0.75]}>
      <mesh position={[0, -0.7, 0]}><cylinderGeometry args={[0.012, 0.012, 1.4, 4]} /><meshStandardMaterial color="#9ca3af" metalness={0.6} /></mesh>
      <mesh position={[0, -1.95, 0]} castShadow><cylinderGeometry args={[0.2, 0.2, 1.1, 14]} /><meshStandardMaterial color="#b91c1c" roughness={0.55} /></mesh>
      <mesh position={[0, -1.38, 0]}><cylinderGeometry args={[0.21, 0.21, 0.06, 14]} /><meshStandardMaterial color="#111827" /></mesh>
    </group>
  );
}

const COACH = npcAppearance('gym-coach', { bodyType: 'masculine', topStyle: 'polo', topColor: '#ea580c', bottomStyle: 'trousers', bottomColor: '#111827' });
const MEMBERS = [
  { id: 'gym-member-0', at: [-5.5, 0.18, -5.7] as V3, yaw: Math.PI, pose: 'jog' },
  { id: 'gym-member-1', at: [-6.4, 0, 1.2] as V3, yaw: Math.PI / 2, pose: 'lift' },
  { id: 'gym-member-2', at: [6.6, 0, 5.2] as V3, yaw: -Math.PI / 2, pose: 'skip' },
].map((m) => ({ ...m, look: npcAppearance(m.id, { topStyle: 't-shirt' }) }));

export function GymHall() {
  const batches = useMemo(buildGym, []);
  const walls = useMemo(buildGymWalls, []);
  const [open, setOpen] = useState(() => gymOpen(Date.now()));
  const [inside, setInside] = useState(false);
  const pass = useGymStore((s) => s.pass);
  const workout = useGymStore((s) => s.workout);
  const players = useGameStore((s) => s.players);
  useEffect(() => {
    const t = setInterval(() => {
      setOpen(gymOpen(Date.now()));
      setInside(inGym(useGameStore.getState().myPosition));
    }, 500);
    return () => clearInterval(t);
  }, []);
  const barrierClosed = !open || pass !== gymPassKey(Date.now());
  const bag = GYM_STATIONS.find((s) => s.kind === 'bag')!;
  const bagBusy = workout?.station === bag.id || Object.values(players).some((p) => p.animation === 'punch' && inGym(p.position));
  const side = (D / 2 - DOOR) / 2;
  return (
    <group position={[CX, 0, CZ]} name="gym">
      <StaticBatches batches={batches} />
      {inside ? (
        <InnerShell rect={{ minX: -W / 2 + T / 2, maxX: W / 2 - T / 2, minZ: -D / 2 + T / 2, maxZ: D / 2 - T / 2 }} height={H}
          wall="#efe9dd" ceiling="#d9d4ca" dado={{ color: '#ea580c', height: 0.9 }}
          openings={[{ side: 'west', centre: 0, half: DOOR, top: H - 1 }]} />
      ) : (
        <>
          <StaticBatches batches={walls} />
          <mesh position={[0, H + 0.1, 0]}><boxGeometry args={[W + 0.6, 0.2, D + 0.6]} /><meshStandardMaterial color="#374151" /></mesh>
          <group position={[-W / 2 - 0.2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <CampusSign position={[0, H - 1.4, 0]} width={6} height={1.3} title="FUNAAB GYM" subtitle={open ? 'Open now · ₦1,000 pass' : '6–10 AM · 4–9 PM'} />
          </group>
        </>
      )}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[W / 2, H / 2, 0]} args={[T / 2, H / 2, D / 2]} />
        <CuboidCollider position={[0, H / 2, -D / 2]} args={[W / 2, H / 2, T / 2]} />
        <CuboidCollider position={[0, H / 2, D / 2]} args={[W / 2, H / 2, T / 2]} />
        {[-1, 1].map((s) => <CuboidCollider key={s} position={[-W / 2, H / 2, s * (DOOR + side)]} args={[T / 2, H / 2, side]} />)}
        {/* Treadmill consoles, the dumbbell rack, the coach's desk. The belts and mats stay walkable. */}
        {GYM_STATIONS.filter((s) => s.kind === 'treadmill').map((s) => { const [x, , z] = L(s.spot); return <CuboidCollider key={s.id} position={[x, 0.6, z - 0.97]} args={[0.45, 0.6, 0.1]} />; })}
        {GYM_STATIONS.filter((s) => s.kind === 'dumbbells').map((s) => { const [x, , z] = L(s.spot); return <CuboidCollider key={s.id} position={[x, 0.45, z - 1.25]} args={[1.1, 0.45, 0.3]} />; })}
        <CuboidCollider position={[-7.6, 0.5, -3.2]} args={[0.75, 0.5, 0.35]} />
      </RigidBody>
      {/* Pass barrier just inside the door: red and closed without this session's pass. */}
      <group position={[GYM_BARRIER.x, 0, 0]}>
        {[-1, 1].map((s) => <mesh key={s} position={[0, 0.5, s * GYM_BARRIER.halfWidth]}><cylinderGeometry args={[0.06, 0.06, 1, 8]} /><meshStandardMaterial color="#d4d4d8" metalness={0.6} roughness={0.3} /></mesh>)}
        <mesh position={[0, barrierClosed ? 0.9 : 0.3, 0]}><boxGeometry args={[0.06, 0.06, GYM_BARRIER.halfWidth * 2]} /><meshBasicMaterial color={barrierClosed ? '#ef4444' : '#22c55e'} /></mesh>
      </group>
      {barrierClosed && (
        <RigidBody type="fixed" colliders={false} key="barrier">
          <CuboidCollider position={[GYM_BARRIER.x, 1, 0]} args={[0.1, 1, GYM_BARRIER.halfWidth]} />
        </RigidBody>
      )}
      <PunchingBag at={L(bag.spot)} busy={bagBusy} />
      {/* Strip lights down the hall: bright while open, one left on after hours. */}
      {(open ? [-5, 0, 5] : [0]).map((x) => (
        <group key={x} position={[x, H - 0.25, 0]}>
          <mesh><boxGeometry args={[0.25, 0.06, D - 3]} /><meshBasicMaterial color={open ? '#fffbeb' : '#a8a29e'} /></mesh>
          <pointLight position={[0, -0.6, 0]} intensity={open ? 9 : 3} distance={13} decay={1.4} color="#fff7ed" />
        </group>
      ))}
      <group position={[-7.6, 0, -2.5]} rotation={[0, Math.PI / 2, 0]}><AvatarBody identity="gym-coach" config={COACH} animation="idle" /></group>
      {open && MEMBERS.map((m) => (
        <group key={m.id} position={m.at} rotation={[0, m.yaw, 0]}><AvatarBody identity={m.id} config={m.look} animation={m.pose} /></group>
      ))}
    </group>
  );
}
