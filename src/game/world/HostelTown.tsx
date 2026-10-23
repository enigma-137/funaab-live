import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier';
import {
  TOWN_BOUNDS, TOWN_BUILDINGS, TOWN_LAMPS, TOWN_LINK, TOWN_PARKED_CARS, TOWN_ROAD, TOWN_TRAFFIC, TOWN_WALKERS, type TownBuilding,
} from '../../config/hostelTown';
import { CAR_MODELS, DRIVE } from '../../config/cars';
import { npcAppearance } from '../../config/npcAppearance';
import { useGameStore } from '../../stores/gameStore';
import { CarBody } from '../vehicles/CarBody';
import { AvatarBody } from '../player/AvatarBody';
import { Box, Instances, canvasMaterial, sign, useDisposable, type T } from './HostelCompound';

// The town outside the hostel gate (config/hostelTown.ts): street, pavements, houses and shops,
// parked cars, through traffic, people walking, lamps, and the "To FUNAAB" arch at the west end.
// Materials are made here, not borrowed from HostelCompound, because the two modules import each other.
type V3 = [number, number, number];
const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const m = {
  verge: std('#8b9468'), asphalt: std('#2f3136'), kerb: std('#c9c3b4'), pavement: std('#b3ab99'), line: new THREE.MeshBasicMaterial({ color: '#e9e3c9' }),
  door: std('#5b3a24'), shopDoor: std('#1f2937'), glass: std('#25303b', { roughness: 0.3 }), frame: std('#f1e6c8'), counter: std('#8a5a32'),
  pole: std('#374151', { roughness: 0.5, metalness: 0.3 }), bulb: new THREE.MeshBasicMaterial({ color: '#fff3c4' }), arch: std('#1f6b45'), archCap: std('#e9d9ae'),
  fence: std('#6b7280'),
};
const wallMats = new Map<string, THREE.Material>();
const tint = (c: string) => { if (!wallMats.has(c)) wallMats.set(c, std(c)); return wallMats.get(c)!; };

function Street() {
  const { minX, maxX, minZ, maxZ, pavementNorth: pn, pavementSouth: ps } = TOWN_ROAD;
  const len = maxX - minX, cx = (minX + maxX) / 2, mid = (minZ + maxZ) / 2 - 0.4;
  const dashes = useMemo<T[]>(() => Array.from({ length: Math.floor(len / 6) }, (_, i) => ({ p: [minX + 3 + i * 6, 0.025, mid], s: [2.6, 0.01, 0.14] })), []);
  const { minX: bx0, maxX: bx1, minZ: bz0, maxZ: bz1 } = TOWN_BOUNDS;
  return <group name="town-street">
    {/* Verge under everything (the compound floor sits on top of it). */}
    <Box p={[(bx0 + bx1) / 2, -0.06, (bz0 + bz1) / 2]} s={[bx1 - bx0 + 40, 0.1, bz1 - bz0 + 40]} m={m.verge} />
    <Box p={[cx, 0.005, (minZ + maxZ) / 2]} s={[len, 0.02, maxZ - minZ]} m={m.asphalt} />
    <Instances material={m.line} items={dashes} shadows={false} />
    {[pn, ps].map((p, i) => <Box key={i} p={[cx, 0.02, (p.minZ + p.maxZ) / 2]} s={[len, 0.04, p.maxZ - p.minZ]} m={m.pavement} />)}
    {[pn.maxZ, ps.minZ].map((z) => <Box key={z} p={[cx, 0.04, z]} s={[len, 0.08, 0.18]} m={m.kerb} />)}
    {/* Gate apron from the hostel gate down to the road. */}
    <Box p={[0, 0.03, (16.6 + pn.maxZ) / 2]} s={[7, 0.06, pn.maxZ - 16.6]} m={m.pavement} />
  </group>;
}

function Building({ b }: { b: TownBuilding }) {
  const [w, d] = b.size, h = b.height, front = d / 2;
  const signMat = useDisposable(() => canvasMaterial(512, 110, sign(512, 110, b.roof, '#fffbeb', [[b.sign ?? '', b.sign && b.sign.length > 11 ? 40 : 52]])), [b.sign, b.roof]);
  const wall = tint(b.wall), roof = tint(b.roof);
  const shop = b.kind === 'shop';
  return <group position={b.position} rotation={[0, b.facing, 0]}>
    <Box p={[0, h / 2, 0]} s={[w, h, d]} m={wall} />
    {shop ? <>
      {/* Open shop front: counter, door, awning and a painted sign board. */}
      <Box p={[-w / 4, 1.3, front + 0.02]} s={[w / 2 - 0.4, 1.6, 0.04]} m={m.glass} />
      <Box p={[-w / 4, 0.5, front + 0.45]} s={[w / 2 - 0.4, 1, 0.8]} m={m.counter} />
      <Box p={[w / 4, 1.05, front + 0.02]} s={[1.2, 2.1, 0.05]} m={m.shopDoor} />
      <Box p={[0, 2.55, front + 0.9]} s={[w, 0.1, 1.8]} m={roof} r={[0.18, 0, 0]} />
      <mesh position={[0, h - 0.35, front + 0.04]} material={signMat} scale={[Math.min(w - 0.6, 6), 0.6, 1]}><planeGeometry args={[1, 1]} /></mesh>
      <Box p={[0, h + 0.15, 0]} s={[w + 0.3, 0.3, d + 0.3]} m={roof} />
    </> : <>
      {/* Bungalow: door, two windows, a pitched roof and a low front fence. */}
      <Box p={[0, 1.05, front + 0.02]} s={[1.1, 2.1, 0.06]} m={m.door} />
      {[-1, 1].map((sx) => <group key={sx}>
        <Box p={[sx * w / 3.2, 1.6, front + 0.02]} s={[1.3, 1.1, 0.05]} m={m.glass} />
        <Box p={[sx * w / 3.2, 1.02, front + 0.06]} s={[1.45, 0.08, 0.12]} m={m.frame} />
      </group>)}
      {[-1, 1].map((sz) => <Box key={sz} p={[0, h + 0.85, sz * d / 4]} s={[w + 0.6, 0.18, d / 2 + 0.7]} m={roof} r={[sz * -0.42, 0, 0]} />)}
      {[-1, 1].map((sx) => <Box key={`f${sx}`} p={[sx * (w / 4 + 0.9), 0.45, front + 1]} s={[w / 2 - 1.8, 0.9, 0.12]} m={m.fence} />)}
    </>}
  </group>;
}

function Lamps() {
  const poles = useMemo<T[]>(() => TOWN_LAMPS.map((p) => ({ p: [p[0], 2.2, p[2]] as V3, s: [0.12, 4.4, 0.12] as V3 })), []);
  const bulbs = useMemo<T[]>(() => TOWN_LAMPS.map((p) => ({ p: [p[0], 4.45, p[2] + (p[2] < 24 ? 0.5 : -0.5)] as V3, s: [0.5, 0.12, 0.3] as V3 })), []);
  return <><Instances material={m.pole} items={poles} /><Instances material={m.bulb} items={bulbs} shadows={false} /></>;
}

/** Over the road at the west end: the way to school. Stop under it and tap Drive to campus. */
function SchoolArch() {
  const [x] = TOWN_LINK.town.exit;
  const { minZ, maxZ } = TOWN_ROAD;
  const signMat = useDisposable(() => canvasMaterial(768, 150, sign(768, 150, '#1f6b45', '#fffbeb', [['TO FUNAAB MAIN GATE', 54], ['ROAD TO SCHOOL', 34]])), []);
  return <group name="town-school-arch">
    {[minZ - 1.4, maxZ + 1.4].map((z) => <Box key={z} p={[x, 2.8, z]} s={[0.8, 5.6, 0.8]} m={m.archCap} />)}
    <Box p={[x, 5.9, (minZ + maxZ) / 2]} s={[0.6, 1.4, maxZ - minZ + 3.6]} m={m.arch} />
    {/* Faces the town (east), so you read it as you drive toward school. */}
    <mesh position={[x + 0.32, 5.9, (minZ + maxZ) / 2]} rotation={[0, Math.PI / 2, 0]} material={signMat} scale={[8.4, 1.3, 1]}><planeGeometry args={[1, 1]} /></mesh>
  </group>;
}

/** Signpost across from the hostel gate: school is to the right. */
function GateSignpost() {
  const signMat = useDisposable(() => canvasMaterial(512, 120, sign(512, 120, '#f7efd6', '#1f6b45', [['FUNAAB  →', 52], ['turn right', 30]])), []);
  return <group position={[3.2, 0, TOWN_ROAD.pavementSouth.maxZ - 0.4]}>
    <Box p={[0, 1.3, 0]} s={[0.1, 2.6, 0.1]} m={m.pole} />
    {/* Faces the gate (−Z). Seen from the gate, "→" points west, toward school. */}
    <mesh position={[0, 2.55, -0.07]} rotation={[0, Math.PI, 0]} material={signMat} scale={[1.9, 0.45, 1]}><planeGeometry args={[1, 1]} /></mesh>
  </group>;
}

function ParkedCars() {
  return <>{TOWN_PARKED_CARS.map((c, i) => <group key={i} position={c.position} rotation={[0, c.rotation, 0]}><CarBody id={c.car} paint={c.paint} /></group>)}</>;
}

/** Where each passing car is right now (for tests and anything that needs to look). */
export const trafficNow: Array<{ id: string; x: number; z: number; v: number; lane: 'west' | 'east' }> = [];

/** Through traffic: each car runs its lane end to end and comes round again, and slows to a stop
 *  for anyone (you, other students, a car ahead) in front of it. Solid (a moving collider), so
 *  people walk round it and your car bumps it. Drawn per device, no server. */
function Traffic() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const state = useMemo(() => {
    const len = TOWN_ROAD.maxX - TOWN_ROAD.minX - 8;
    return TOWN_TRAFFIC.map((t) => ({ ...t, len, s: t.offset * len, v: t.speed }));
  }, []);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const { myPosition, players } = useGameStore.getState();
    const people: Array<[number, number]> = [[myPosition[0], myPosition[2]], ...Object.values(players).map((p) => [p.position[0], p.position[2]] as [number, number])];
    const xOf = (c: (typeof state)[number]) => c.lane === 'west' ? TOWN_ROAD.maxX - 4 - c.s : TOWN_ROAD.minX + 4 + c.s;
    state.forEach((c, i) => {
      const dir = c.lane === 'west' ? -1 : 1, z = c.lane === 'west' ? TOWN_ROAD.westLane : TOWN_ROAD.eastLane, x = xOf(c);
      const reach = 2.6 * (CAR_MODELS[c.car]?.scale ?? 1);
      let gap = Infinity;
      // Anyone in front of the bonnet, or already alongside the body (stepped off the pavement), stops it.
      for (const [px, pz] of people) if (Math.abs(pz - z) < 1.9) { const ahead = (px - x) * dir; if (ahead > -reach) gap = Math.min(gap, ahead - reach); }
      for (const o of state) if (o !== c && o.lane === c.lane) { const ahead = (xOf(o) - x) * dir; if (ahead > 0) gap = Math.min(gap, ahead - 2 * reach); }
      const want = gap < 2 ? 0 : gap < 9 ? c.speed * (gap - 2) / 7 : c.speed;
      c.v += Math.max(-10 * dt, Math.min(3 * dt, want - c.v));
      c.s = (c.s + Math.max(0, c.v) * dt) % c.len;
      const g = refs.current[i];
      if (g) { g.position.set(xOf(c), 0, z); g.rotation.y = dir * Math.PI / 2; }
      trafficNow[i] = { id: c.id, x: xOf(c), z, v: c.v, lane: c.lane };
      const b = bodies.current[i];
      if (b) { b.setNextKinematicTranslation({ x: xOf(c), y: 0, z }); b.setNextKinematicRotation({ x: 0, y: Math.sin(dir * Math.PI / 4), z: 0, w: Math.cos(dir * Math.PI / 4) }); }
    });
  });
  const startX = (c: (typeof state)[number]) => c.lane === 'west' ? TOWN_ROAD.maxX - 4 - c.s : TOWN_ROAD.minX + 4 + c.s;
  return <>{TOWN_TRAFFIC.map((t, i) => {
    const k = CAR_MODELS[t.car]?.scale ?? 1, z = t.lane === 'west' ? TOWN_ROAD.westLane : TOWN_ROAD.eastLane, dir = t.lane === 'west' ? -1 : 1;
    return <React.Fragment key={t.id}>
      <group ref={(g) => { refs.current[i] = g; }}><CarBody id={t.car} paint={t.paint} /></group>
      <RigidBody ref={(b) => { bodies.current[i] = b; }} type="kinematicPosition" colliders={false} position={[startX(state[i]), 0, z]} rotation={[0, dir * Math.PI / 2, 0]}>
        <CuboidCollider args={[DRIVE.half[0] * k, DRIVE.half[1], DRIVE.half[2] * k]} position={[0, DRIVE.half[1] + 0.12, 0]} />
      </RigidBody>
    </React.Fragment>;
  })}</>;
}

/** Neighbours walking up and down the pavements. */
function Walkers() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const configs = useMemo(() => TOWN_WALKERS.map((w) => npcAppearance(w.id)), []);
  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += Math.min(delta, 0.1);
    TOWN_WALKERS.forEach((w, i) => {
      const g = refs.current[i];
      if (!g) return;
      const span = w.to - w.from, period = (2 * span) / w.speed, phase = ((t.current / period + w.offset) % 1) * 2;
      const out = phase < 1, k = out ? phase : 2 - phase;
      g.position.set(w.from + span * k, 0, w.z);
      g.rotation.y = out ? Math.PI / 2 : -Math.PI / 2;
    });
  });
  return <>{TOWN_WALKERS.map((w, i) => <group key={w.id} ref={(g) => { refs.current[i] = g; }}><AvatarBody identity={w.id} trackMovement config={configs[i]} /></group>)}</>;
}

function TownColliders() {
  const { minX, maxX, minZ, maxZ } = TOWN_BOUNDS;
  return <RigidBody type="fixed" colliders={false}>
    <CuboidCollider args={[(maxX - minX) / 2 + 20, 0.2, (maxZ - minZ) / 2 + 20]} position={[(minX + maxX) / 2, -0.2, (minZ + maxZ) / 2]} />
    {TOWN_BUILDINGS.map((b) => {
      const [w, d] = b.size;
      return <CuboidCollider key={b.id} args={[w / 2, b.height / 2, d / 2]} position={[b.position[0], b.height / 2, b.position[2]]} />;
    })}
    {TOWN_PARKED_CARS.map((c, i) => {
      const k = CAR_MODELS[c.car]?.scale ?? 1, along = Math.abs(Math.sin(c.rotation)) > 0.5;
      const hx = (along ? DRIVE.half[2] : DRIVE.half[0]) * k, hz = (along ? DRIVE.half[0] : DRIVE.half[2]) * k;
      return <CuboidCollider key={`car${i}`} args={[hx, DRIVE.half[1], hz]} position={[c.position[0], DRIVE.half[1] + 0.12, c.position[2]]} />;
    })}
    {[TOWN_ROAD.minZ - 1.4, TOWN_ROAD.maxZ + 1.4].map((z) => <CuboidCollider key={`arch${z}`} args={[0.4, 2.8, 0.4]} position={[TOWN_LINK.town.exit[0], 2.8, z]} />)}
    {TOWN_LAMPS.map((p, i) => <CuboidCollider key={`lamp${i}`} args={[0.08, 2.2, 0.08]} position={[p[0], 2.2, p[2]]} />)}
  </RigidBody>;
}

export function HostelTown() {
  return <group name="hostel-town">
    <Street />
    {TOWN_BUILDINGS.map((b) => <Building key={b.id} b={b} />)}
    <Lamps />
    <SchoolArch />
    <GateSignpost />
    <ParkedCars />
    <Traffic />
    <Walkers />
    <TownColliders />
  </group>;
}
