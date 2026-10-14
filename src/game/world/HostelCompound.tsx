import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import {
  BUILDING, FLOOR_HEIGHT, HOSTEL_COMPOUND_ASSET, HOSTEL_COURTYARD_BOUND, HOSTEL_DOORS, IYA_IBEJI, LANDING,
  ROOM_WIDTH, ROOMS_PER_FLOOR, SECURITY_POST, STAIRS, doorFor, hostelCompoundColliders,
} from '../../config/hostelCompound';
import { useGameStore } from '../../stores/gameStore';
import { useHostelStore } from '../../stores/hostelStore';
import { useInputStore } from '../../stores/inputStore';
import { openHostel } from '../../ui/HostelLife';
import { useDayNight, NIGHT_LIGHTS_FROM } from './dayNight';

// Procedural stand-in for /models/hostel/hostel_compound_main.glb. Gameplay (doors, stairs, room
// travel) reads config/hostelCompound.ts, so a Blender model can replace these meshes untouched.
type V3 = [number, number, number];
const cube = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const mats = {
  wall: std('#e6d3a3'), wallLow: std('#b89a63'), concrete: std('#c9c3b4'), concreteDark: std('#a7a091'), ground: std('#b8b2a2'),
  roof: std('#2f6b46'), roofDark: std('#24543a'), door: std('#24553c'), frame: std('#f1e6c8'), louvre: std('#2c2a26'),
  rail: std('#1f4d36', { roughness: 0.6 }), metal: std('#3f3f46', { roughness: 0.5, metalness: 0.3 }), tank: std('#1c1c1c'),
  wood: std('#8a5a32'), plastic: std('#f5f5f0'), plasticGreen: std('#2f7d4f'), leaf: std('#4f8a3f'), bark: std('#6b4a2f'),
  shop: std('#2f6b46'), shopTrim: std('#e9d9ae'), bin: std('#1e3a8a'), cloth: [std('#1f2937'), std('#f5f5f4'), std('#15803d'), std('#2563eb')],
  bulb: new THREE.MeshBasicMaterial({ color: '#fff3c4' }),
  mine: new THREE.MeshBasicMaterial({ color: '#4ade80' }),
};

interface T { p: V3; s?: V3; r?: V3 }
/** One draw call for many identical props (doors, windows, columns, balusters, steps). */
function Instances({ geometry = cube, material, items, onClick, shadows = true }: {
  geometry?: THREE.BufferGeometry; material: THREE.Material; items: T[]; onClick?: (e: ThreeEvent<MouseEvent>) => void; shadows?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    items.forEach((t, i) => { q.setFromEuler(e.set(...(t.r ?? [0, 0, 0]))); mesh.setMatrixAt(i, m.compose(p.set(...t.p), q, s.set(...(t.s ?? [1, 1, 1])))); });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow onClick={onClick} />;
}
const Box = ({ p, s, m, r }: { p: V3; s: V3; m: THREE.Material; r?: V3 }) => <mesh geometry={cube} material={m} position={p} scale={s} rotation={r} castShadow receiveShadow />;

/** Canvas lettering with system fonts only (no font fetch can stall the world). */
function canvasMaterial(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d')!);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map, toneMapped: false });
}
function useDisposable<T extends THREE.Material | THREE.BufferGeometry>(make: () => T, deps: unknown[]) {
  const value = useMemo(make, deps);
  useEffect(() => () => { (value as any).map?.dispose?.(); value.dispose(); }, [value]);
  return value;
}
const FONT = (w: number, s: number) => `${w} ${s}px "Arial Black", Arial, sans-serif`;
const sign = (w: number, h: number, bg: string, fg: string, lines: [string, number][]) => (c: CanvasRenderingContext2D) => {
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.strokeStyle = fg; c.lineWidth = Math.max(3, h * 0.04); c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  const total = lines.reduce((a, [, s]) => a + s * 1.15, 0);
  let y = h / 2 - total / 2;
  for (const [text, size] of lines) { c.font = FONT(900, size); y += size * 0.575; c.fillText(text, w / 2, y); y += size * 0.575; }
};

/** All 12 door plaques share one atlas texture/material; each plaque is a tiny UV-offset plane. */
function DoorPlaques() {
  const cols = 6, rows = 2, cw = 128, ch = 56;
  const material = useDisposable(() => canvasMaterial(cols * cw, rows * ch, (c) => {
    HOSTEL_DOORS.forEach((d, i) => {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      c.fillStyle = '#f7efd6'; c.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      c.fillStyle = '#24553c'; c.font = FONT(900, 26); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(`ROOM ${d.number}`, x + cw / 2, y + ch / 2 + 1);
    });
  }), []);
  const geometries = useMemo(() => HOSTEL_DOORS.map((_, i) => {
    const g = new THREE.PlaneGeometry(0.62, 0.27);
    const u0 = (i % cols) / cols, u1 = u0 + 1 / cols, v1 = 1 - Math.floor(i / cols) / rows, v0 = v1 - 1 / rows;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2));
    return g;
  }), []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return <>{HOSTEL_DOORS.map((d, i) => <mesh key={d.number} geometry={geometries[i]} material={material}
    position={[d.position[0], d.position[1] + 2.32, BUILDING.facadeZ + 0.03]} />)}</>;
}

/** Green frame on your door always; a small "YOUR ROOM" sign appears when you're near it. */
function MyRoomMarker({ room }: { room: number }) {
  const door = doorFor(room);
  const signMat = useDisposable(() => canvasMaterial(256, 72, sign(256, 72, '#166534', '#ecfdf5', [['YOUR ROOM', 34]])), []);
  const group = useRef<THREE.Group>(null);
  const tag = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const me = useGameStore.getState().myPosition;
    const near = Math.abs(me[1] - door.position[1]) < 2 && Math.hypot(me[0] - door.position[0], me[2] - door.position[2]) < 9;
    if (tag.current) { tag.current.visible = near; tag.current.position.y = door.position[1] + 2.85 + Math.sin(clock.elapsedTime * 2) * 0.04; }
  });
  const [x, y, z] = door.position;
  return <group ref={group}>
    {[[x - 0.52, y + 1.05, 0.05, 2.1], [x + 0.52, y + 1.05, 0.05, 2.1]].map(([px, py, , h], i) =>
      <Box key={i} p={[px, py, z + 0.06]} s={[0.06, h, 0.03]} m={mats.mine} />)}
    <Box p={[x, y + 2.12, z + 0.06]} s={[1.1, 0.06, 0.03]} m={mats.mine} />
    <mesh ref={tag} position={[x, y + 2.85, z + 0.25]} material={signMat} scale={[0.95, 0.27, 1]}><planeGeometry args={[1, 1]} /></mesh>
  </group>;
}

function Building({ myRoom }: { myRoom: number | null }) {
  const { minX, maxX, backZ, facadeZ, corridorFrontZ } = BUILDING;
  const width = maxX - minX, depth = facadeZ - backZ, H = FLOOR_HEIGHT * 2;
  const cx = (minX + maxX) / 2;
  const columnXs = Array.from({ length: ROOMS_PER_FLOOR + 1 }, (_, i) => minX + i * ROOM_WIDTH);
  const doors = useMemo<T[]>(() => HOSTEL_DOORS.map((d) => ({ p: [d.position[0], d.position[1] + 1.02, facadeZ + 0.02], s: [0.92, 2.04, 0.08] })), []);
  const frames = useMemo<T[]>(() => HOSTEL_DOORS.map((d) => ({ p: [d.position[0], d.position[1] + 1.07, facadeZ + 0.005], s: [1.08, 2.18, 0.04] })), []);
  const windows = useMemo<T[]>(() => HOSTEL_DOORS.map((d) => ({ p: [d.position[0] + 1.35, d.position[1] + 1.55, facadeZ + 0.03], s: [0.9, 0.85, 0.05] })), []);
  const sills = useMemo<T[]>(() => HOSTEL_DOORS.map((d) => ({ p: [d.position[0] + 1.35, d.position[1] + 1.1, facadeZ + 0.07], s: [1.0, 0.06, 0.12] })), []);
  const bulbs = useMemo<T[]>(() => HOSTEL_DOORS.map((d) => ({ p: [d.position[0] + 0.65, d.position[1] + 2.55, facadeZ + 0.12], s: [0.08, 0.08, 0.08] })), []);
  const columns = useMemo<T[]>(() => columnXs.map((x) => ({ p: [x, H / 2, corridorFrontZ - 0.12], s: [0.28, H, 0.28] })), []);
  // Upper balcony railing: top bar + balusters, from the stair landing to the far end.
  const railFrom = STAIRS.maxX, railTo = maxX;
  const balusters = useMemo<T[]>(() => {
    const out: T[] = [];
    for (let x = railFrom + 0.15; x < railTo; x += 0.22) out.push({ p: [x, FLOOR_HEIGHT + 0.5, corridorFrontZ - 0.05], s: [0.035, 1, 0.035] });
    for (let z = LANDING.minZ + 0.15; z < LANDING.maxZ; z += 0.22) {
      out.push({ p: [LANDING.minX + 0.05, FLOOR_HEIGHT + 0.5, z], s: [0.035, 1, 0.035] }, { p: [maxX - 0.05, FLOOR_HEIGHT + 0.5, z], s: [0.035, 1, 0.035] });
    }
    for (let x = LANDING.minX + 0.15; x < LANDING.maxX; x += 0.22) out.push({ p: [x, FLOOR_HEIGHT + 0.5, LANDING.minZ + 0.05], s: [0.035, 1, 0.035] });
    return out;
  }, []);
  const onDoor = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const door = HOSTEL_DOORS[e.instanceId ?? -1];
    if (!door) return;
    useInputStore.getState().clearTargetDestination();
    if (door.number === myRoom) { void useHostelStore.getState().travel('room'); return; }
    useHostelStore.setState({ notice: `Room ${door.number} · ${door.number % 3 === 0 ? 'Door locked' : 'Occupied'}` });
  };
  const slabW = maxX - LANDING.minX, slabCx = (maxX + LANDING.minX) / 2, slabD = corridorFrontZ - facadeZ, slabCz = (corridorFrontZ + facadeZ) / 2;
  return <group>
    <>
      {/* Room block (solid: no interiors behind the doors) */}
      <Box p={[cx, H / 2, (backZ + facadeZ) / 2]} s={[width, H, depth]} m={mats.wall} />
      <Box p={[cx, 0.45, facadeZ + 0.01]} s={[width, 0.9, 0.02]} m={mats.wallLow} />
      <Box p={[cx, FLOOR_HEIGHT + 0.45, facadeZ + 0.01]} s={[width, 0.9, 0.02]} m={mats.wallLow} />
      {/* Ground walkway, upper balcony + stair landing slab, roof */}
      <Box p={[cx, 0.03, slabCz]} s={[width, 0.06, slabD]} m={mats.concreteDark} />
      <Box p={[slabCx, FLOOR_HEIGHT - 0.1, slabCz]} s={[slabW, 0.2, slabD]} m={mats.concrete} />
      <Box p={[slabCx + 0.15, H + 0.12, (backZ + corridorFrontZ) / 2]} s={[slabW + 0.6, 0.24, corridorFrontZ - backZ + 0.6]} m={mats.roofDark} />
      <Box p={[slabCx + 0.15, H + 0.5, (backZ + corridorFrontZ) / 2 - 0.3]} s={[slabW + 0.8, 0.12, corridorFrontZ - backZ + 0.9]} m={mats.roof} r={[0.07, 0, 0]} />
      {/* Columns */}
      <Instances material={mats.concrete} items={columns} />
      {/* Balcony railing colliders: front, far end, landing outer side and back */}
    </>
    <Instances material={mats.rail} items={balusters} shadows={false} />
    <Box p={[(railTo + railFrom) / 2, FLOOR_HEIGHT + 1.02, corridorFrontZ - 0.05]} s={[railTo - railFrom, 0.06, 0.08]} m={mats.rail} />
    <Box p={[maxX - 0.05, FLOOR_HEIGHT + 1.02, slabCz]} s={[0.08, 0.06, slabD]} m={mats.rail} />
    <Box p={[LANDING.minX + 0.05, FLOOR_HEIGHT + 1.02, slabCz]} s={[0.08, 0.06, slabD]} m={mats.rail} />
    <Box p={[(LANDING.maxX + LANDING.minX) / 2, FLOOR_HEIGHT + 1.02, LANDING.minZ + 0.05]} s={[LANDING.maxX - LANDING.minX, 0.06, 0.08]} m={mats.rail} />
    {/* Doors (clickable), frames, louvred windows, sills, corridor bulbs */}
    <Instances material={mats.frame} items={frames} shadows={false} />
    <Instances material={mats.door} items={doors} onClick={onDoor} />
    <Instances material={mats.louvre} items={windows} shadows={false} />
    <Instances material={mats.frame} items={sills} shadows={false} />
    <Instances geometry={cyl} material={mats.bulb} items={bulbs} shadows={false} />
    <DoorPlaques />
    {myRoom && <MyRoomMarker room={myRoom} />}
  </group>;
}

/** Concrete external stair: visual solid steps, a 30° ramp collider to walk on, rails, and stepped fill so nothing gets under it. */
function Staircase() {
  const { minX, maxX, bottomZ, topZ, steps } = STAIRS;
  const run = bottomZ - topZ, rise = FLOOR_HEIGHT, h = rise / steps, d = run / steps;
  const w = maxX - minX, cx = (minX + maxX) / 2;
  const angle = Math.atan2(rise, run), hyp = Math.hypot(rise, run);
  const stepItems = useMemo<T[]>(() => Array.from({ length: steps }, (_, i) => {
    const top = (i + 0.5) * h; // half-step down so feet sit evenly on the ramp line
    return { p: [cx, top / 2, bottomZ - (i + 0.5) * d], s: [w, top, d + 0.01] };
  }), []);
  const midY = rise / 2, midZ = (bottomZ + topZ) / 2;
  return <group>
    <Instances material={mats.concrete} items={stepItems} />
    <>
      {/* Walking surface */}
      {/* Side rails along the slope */}
    </>
    {[minX, maxX].map((x) => <group key={x}>
      <Box p={[x, midY + 1.0, midZ]} s={[0.06, 0.06, hyp]} m={mats.rail} r={[angle, 0, 0]} />
      {Array.from({ length: 7 }, (_, i) => {
        const t = (i + 0.5) / 7;
        return <Box key={i} p={[x, rise * t + 0.5, bottomZ - run * t]} s={[0.04, 1, 0.04]} m={mats.rail} />;
      })}
    </group>)}
  </group>;
}

function IyaIbejiShop() {
  const signMat = useDisposable(() => canvasMaterial(512, 110, sign(512, 110, '#f7efd6', '#24553c', [['IYA IBEJI SHOP', 52]])), []);
  const [x, , z] = IYA_IBEJI.position;
  const open = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useInputStore.getState().clearTargetDestination(); openHostel('shop'); };
  const shelfItems = useMemo<T[]>(() => Array.from({ length: 12 }, (_, i) => ({ p: [-2.13, 0.95 + Math.floor(i / 4) * 0.32, -0.9 + (i % 4) * 0.6], s: [0.2, 0.22, 0.35] })), []);
  const goods = useMemo(() => ['#ef4444', '#facc15', '#3b82f6', '#22c55e'].map((c) => std(c)), []);
  useEffect(() => () => goods.forEach((g) => g.dispose()), [goods]);
  return <group position={[x, 0, z]}>
    <>
      <Box p={[0, 1.5, 0]} s={[4.4, 3, 6]} m={mats.wall} />
      <Box p={[0, 0.45, 0]} s={[4.42, 0.9, 6.02]} m={mats.shop} />
      <Box p={[-0.5, 3.15, 0]} s={[5.6, 0.18, 6.8]} m={mats.shop} r={[0, 0, 0.12]} />
    </>
    {/* Door + serving window face the courtyard (−x) */}
    <mesh geometry={cube} material={mats.door} position={[-2.22, 1.05, 1.6]} scale={[0.06, 2.1, 1]} onClick={open} />
    <Box p={[-2.22, 1.25, -0.6]} s={[0.04, 1.1, 2.4]} m={mats.louvre} />
    <Box p={[-2.5, 0.95, -0.6]} s={[0.55, 0.08, 2.6]} m={mats.wood} />
    {shelfItems.map((t, i) => <Box key={i} p={t.p} s={t.s!} m={goods[i % goods.length]} />)}
    <mesh position={[-2.24, 2.5, -0.2]} rotation={[0, -Math.PI / 2, 0]} material={signMat} scale={[3.2, 0.69, 1]} onClick={open}><planeGeometry args={[1, 1]} /></mesh>
    <Box p={[-2.9, 2.6, -0.6]} s={[1.2, 0.08, 3.2]} m={mats.shop} r={[0, 0, -0.25]} />
  </group>;
}

function SecurityPost() {
  const signMat = useDisposable(() => canvasMaterial(256, 72, sign(256, 72, '#24553c', '#f7efd6', [['SECURITY', 36]])), []);
  return <group position={SECURITY_POST}>
    <>
      <Box p={[0, 1.2, 0]} s={[2, 2.4, 2]} m={mats.wall} />
      <Box p={[0, 2.5, 0]} s={[2.4, 0.18, 2.4]} m={mats.roof} />
    </>
    <Box p={[0, 1.45, -1.02]} s={[1.2, 0.7, 0.04]} m={mats.louvre} />
    <mesh position={[0, 2.05, -1.02]} rotation={[0, Math.PI, 0]} material={signMat} scale={[1.3, 0.37, 1]}><planeGeometry args={[1, 1]} /></mesh>
  </group>;
}

function Courtyard() {
  const B = HOSTEL_COURTYARD_BOUND, wallAt = B + 0.6, gateHalf = 2.2;
  const noticeMat = useDisposable(() => canvasMaterial(256, 200, (c) => {
    c.fillStyle = '#7c5a3a'; c.fillRect(0, 0, 256, 200);
    c.fillStyle = '#f7efd6'; c.fillRect(14, 14, 228, 172);
    c.fillStyle = '#24553c'; c.font = FONT(900, 28); c.textAlign = 'center'; c.fillText('NOTICE', 128, 50);
    c.font = '600 17px Arial'; c.fillStyle = '#3f3f46';
    ['Light bill due Friday', 'No cooking on corridor', 'Gate locks at 11 PM', 'Keep the tap closed!'].forEach((t, i) => c.fillText(t, 128, 86 + i * 26));
  }), []);
  const chairs = useMemo<T[]>(() => [[-6.8, 2.2], [-5.2, 2.2], [-6.8, 3.8], [-5.2, 3.8]].map(([x, z]) => ({ p: [x, 0.25, z] as V3, s: [0.45, 0.5, 0.45] as V3 })), []);
  const chairBacks = useMemo<T[]>(() => [[-6.8, 1.98], [-5.2, 1.98], [-6.8, 4.02], [-5.2, 4.02]].map(([x, z]) => ({ p: [x, 0.75, z] as V3, s: [0.45, 0.5, 0.05] as V3 })), []);
  return <group>
    <>
      {/* Concrete compound floor + walkway */}
      <Box p={[0, -0.2, 0]} s={[2 * wallAt + 1, 0.4, 2 * wallAt + 1]} m={mats.ground} />
      {/* Perimeter wall with a gate gap at the front */}
      <Box p={[0, 1, -wallAt]} s={[2 * wallAt, 2, 0.3]} m={mats.wall} />
      <Box p={[-wallAt, 1, 0]} s={[0.3, 2, 2 * wallAt]} m={mats.wall} />
      <Box p={[wallAt, 1, 0]} s={[0.3, 2, 2 * wallAt]} m={mats.wall} />
      {[-1, 1].map((side) => <Box key={side} p={[side * (wallAt + gateHalf) / 2, 1, wallAt]} s={[wallAt - gateHalf, 2, 0.3]} m={mats.wall} />)}
      {[-1, 1].map((side) => <Box key={`cap${side}`} p={[side * gateHalf, 1.2, wallAt]} s={[0.6, 2.4, 0.6]} m={mats.wall} />)}
      <Box p={[0, 1, wallAt + 0.05]} s={[2 * gateHalf - 0.6, 2, 0.08]} m={mats.tank} />
      {/* Tree planter with benches */}
      <Box p={[5, 0.2, 3]} s={[3.2, 0.4, 3.2]} m={mats.concreteDark} />
      {/* Plastic table */}
      {/* Water tank stand */}
    </>
    <Box p={[0, 0.005, 6.5]} s={[2.4, 0.02, 2 * HOSTEL_COURTYARD_BOUND - 13]} m={mats.concreteDark} />
    {/* Tree */}
    <mesh geometry={cyl} material={mats.bark} position={[5, 1.4, 3]} scale={[0.16, 2.2, 0.16]} castShadow />
    <mesh material={mats.leaf} position={[5, 3.0, 3]} castShadow><icosahedronGeometry args={[1.5, 0]} /></mesh>
    {[[3.2, 3], [6.8, 3]].map(([x, z]) => <group key={x}>
      <Box p={[x, 0.45, z]} s={[0.4, 0.08, 2]} m={mats.wood} />
      <Box p={[x, 0.22, z - 0.8]} s={[0.35, 0.44, 0.08]} m={mats.metal} />
      <Box p={[x, 0.22, z + 0.8]} s={[0.35, 0.44, 0.08]} m={mats.metal} />
    </group>)}
    {/* Plastic table + chairs */}
    <mesh geometry={cyl} material={mats.plasticGreen} position={[-6, 0.74, 3]} scale={[0.6, 0.05, 0.6]} castShadow />
    <mesh geometry={cyl} material={mats.plasticGreen} position={[-6, 0.37, 3]} scale={[0.06, 0.74, 0.06]} />
    <Instances material={mats.plastic} items={chairs} />
    <Instances material={mats.plastic} items={chairBacks} />
    {/* Lamp post, bin, water drum */}
    <mesh geometry={cyl} material={mats.metal} position={[-1.8, 1.9, 1]} scale={[0.07, 3.8, 0.07]} />
    <mesh material={mats.bulb} position={[-1.8, 3.9, 1]}><sphereGeometry args={[0.18, 8, 6]} /></mesh>
    <mesh geometry={cyl} material={mats.bin} position={[-1.2, 0.4, 0.4]} scale={[0.3, 0.8, 0.3]} castShadow />
    <mesh geometry={cyl} material={mats.bin} position={[-9.4, 0.45, -3.2]} scale={[0.4, 0.9, 0.4]} castShadow />
    {/* Overhead water tank */}
    <group position={[-14, 0, -14]}>
      {[[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].map(([x, z]) => <Box key={`${x}${z}`} p={[x, 1.6, z]} s={[0.12, 3.2, 0.12]} m={mats.metal} />)}
      <Box p={[0, 3.2, 0]} s={[2.1, 0.12, 2.1]} m={mats.metal} />
      <mesh geometry={cyl} material={mats.tank} position={[0, 4.2, 0]} scale={[0.95, 1.9, 0.95]} castShadow />
    </group>
    {/* Laundry line */}
    <group position={[-10, 0, 10]}>
      {[-3, 3].map((x) => <mesh key={x} geometry={cyl} material={mats.rail} position={[x, 0.95, 0]} scale={[0.04, 1.9, 0.04]} />)}
      <Box p={[0, 1.85, 0]} s={[6, 0.015, 0.015]} m={mats.metal} />
      {[-2.1, -0.9, 0.4, 1.7].map((x, i) => <Box key={x} p={[x, 1.45, 0]} s={[0.8, 0.75, 0.02]} m={mats.cloth[i]} />)}
    </group>
    {/* Notice board by the gate */}
    <group position={[-4, 0, 13.5]}>
      {[-0.7, 0.7].map((x) => <Box key={x} p={[x, 0.9, 0]} s={[0.08, 1.8, 0.08]} m={mats.wood} />)}
      {/* Faces into the courtyard (−z), where students read it. */}
      <mesh position={[0, 1.55, -0.05]} rotation={[0, Math.PI, 0]} material={noticeMat} scale={[1.6, 1.25, 1]}><planeGeometry args={[1, 1]} /></mesh>
    </group>
  </group>;
}

/** Every collider comes from config, the same list the physics test walks a capsule through. */
function CompoundColliders() {
  const colliders = useMemo(hostelCompoundColliders, []);
  return <RigidBody type="fixed" colliders={false}>
    {colliders.map((c) => <CuboidCollider key={c.id} args={c.half} position={c.pos} rotation={c.rot} />)}
  </RigidBody>;
}

/** Compound at night: corridor and courtyard lights (4 real lights) plus soft pools on the ground, and lit
 *  room windows behind the corridor so the block looks lived-in. Nothing renders in daylight. */
const POOL_TEX = (() => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,214,140,0.9)'); grad.addColorStop(1, 'rgba(255,214,140,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function CompoundNight() {
  const night = useDayNight((s) => s.night);
  if (night < NIGHT_LIGHTS_FROM || !POOL_TEX) return null;
  const k = (night - NIGHT_LIGHTS_FROM) / (1 - NIGHT_LIGHTS_FROM);
  const corridorZ = (BUILDING.facadeZ + BUILDING.corridorFrontZ) / 2;
  const lights: Array<{ p: [number, number, number]; i: number; d: number }> = [
    { p: [-4, 2.6, corridorZ], i: 6, d: 11 },
    { p: [4, 2.6 + FLOOR_HEIGHT, corridorZ], i: 6, d: 11 },
    { p: [-1.8, 3.6, 1], i: 9, d: 16 }, // courtyard pole lamp
    { p: [IYA_IBEJI.door[0], 2.4, IYA_IBEJI.door[2]], i: 5, d: 8 },
  ];
  const pools: Array<[number, number, number]> = [[-4, corridorZ, 4], [4, corridorZ, 4], [-1.8, 1, 7], [IYA_IBEJI.door[0], IYA_IBEJI.door[2], 4], [SECURITY_POST[0], SECURITY_POST[2], 3.5]];
  return <group name="hostel-night">
    {lights.map((l, n) => <pointLight key={n} position={l.p} color="#ffd6a0" intensity={l.i * k} distance={l.d} decay={1.6} />)}
    {pools.map(([x, z, r], n) => (
      <mesh key={n} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[r * 2, r * 2]} />
        <meshBasicMaterial map={POOL_TEX} transparent opacity={0.55 * k} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    ))}
    {/* Warm light behind most louvred windows (a couple stay dark: someone's asleep). */}
    {HOSTEL_DOORS.filter((d) => d.number % 5 !== 3).map((d) => (
      <mesh key={d.number} position={[d.position[0] + 1.35, d.position[1] + 1.55, BUILDING.facadeZ + 0.06]}>
        <planeGeometry args={[0.8, 0.75]} />
        <meshBasicMaterial color="#ffcf7a" transparent opacity={0.55 * k} toneMapped={false} />
      </mesh>
    ))}
  </group>;
}

export function HostelCompound({ myRoom }: { myRoom: number | null }) {
  return <group name={HOSTEL_COMPOUND_ASSET}>
    <CompoundNight />
    <CompoundColliders />
    <Courtyard />
    <Building myRoom={myRoom} />
    <Staircase />
    <IyaIbejiShop />
    <SecurityPost />
  </group>;
}
