import React, { useEffect, useMemo, useRef } from 'react';
import { QUALITY } from '../../config/quality';
import { useGraphicsStore } from '../../stores/graphicsStore';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useDayNight, NIGHT_LIGHTS_FROM } from './dayNight';
import { campusMaterials } from './campusVisualGeometry';
import { useGameStore } from '../../stores/gameStore';
import { campusObstacles } from '../../config/kekeRoutes';
import { locationById, CAR_PARK_BAY, type Point } from '../../config/campusLocations';
import { CAMPUS_BET_SHOP } from '../../config/campusBet';
import { LOVE_GARDEN } from '../../config/loveGarden';
import { VENDOR_PLAZA } from '../../config/foodVendors';
import { FOOTBALL_PITCH } from '../../config/football';

// Night on campus. Phones can't afford a real light per lamp, so most of the glow is faked:
// emissive lamp heads plus soft additive "light pools" on the ground (a handful of draw calls in
// total). Only the 4 light sources nearest the student get a real point light, so faces and
// walls next to you are lit warmly while the cost stays the same everywhere on campus.

type Source = { p: Point; r: number; strength: number; color: string };

/** Road centre lines (mirrors kekeRoutes). Lamps stand on alternate sides every ~24 m. */
const ROADS: Array<[Point, Point]> = [
  [[-55, 0, 76], [-55, 0, -85]], [[55, 0, 76], [55, 0, -85]],
  [[-55, 0, 45], [55, 0, 45]], [[-55, 0, -40], [55, 0, -40]],
  [[-55, 0, -85], [55, 0, -85]], [[0, 0, 78], [0, 0, -40]],
];
const SOLAR_LAMPS: Point[] = [[-7, 0, 70], [7, 0, 55], [-62, 0, 40], [-62, 0, -35], [62, 0, 40], [62, 0, -35], [40, 0, -92]];

function streetLamps(): Point[] {
  const out: Point[] = [];
  const blocked = (x: number, z: number) =>
    campusObstacles.some((o) => x > o.minX - 1.5 && x < o.maxX + 1.5 && z > o.minZ - 1.5 && z < o.maxZ + 1.5)
    // Keep lamps off every carriageway, including the crossing roads.
    || ROADS.some(([a, b]) => {
      const vertical = a[0] === b[0];
      return vertical
        ? Math.abs(x - a[0]) < 4 && z >= Math.min(a[2], b[2]) - 4 && z <= Math.max(a[2], b[2]) + 4
        : Math.abs(z - a[2]) < 4 && x >= Math.min(a[0], b[0]) - 4 && x <= Math.max(a[0], b[0]) + 4;
    })
    || [...out, ...SOLAR_LAMPS].some((p) => Math.hypot(p[0] - x, p[2] - z) < 12);
  for (const [a, b] of ROADS) {
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const dx = (b[0] - a[0]) / len, dz = (b[2] - a[2]) / len;
    for (let d = 8, i = 0; d < len - 4; d += 24, i++) {
      const side = i % 2 ? 1 : -1;
      const x = a[0] + dx * d + -dz * 4.8 * side, z = a[2] + dz * d + dx * 4.8 * side;
      if (!blocked(x, z)) out.push([x, 0, z]);
    }
  }
  return out;
}

const WARM = '#ffd27a';
const loc = (id: string, dz = 0): Point => { const e = locationById(id).entrance; return [e[0], 0, e[2] + dz]; };
/** Busy places stay brightly lit at night. */
const HUBS: Source[] = [
  { p: [0, 0, 84], r: 9, strength: 1.4, color: WARM }, // main gate
  { p: [CAMPUS_BET_SHOP.counter[0], 0, CAMPUS_BET_SHOP.counter[2] - 1], r: 6, strength: 1.3, color: '#ffe3a3' },
  { p: [locationById('food-court').position[0], 0, locationById('food-court').position[2] + 3], r: 9, strength: 1.5, color: WARM },
  { p: [(VENDOR_PLAZA.minX + VENDOR_PLAZA.maxX) / 2, 0, (VENDOR_PLAZA.minZ + VENDOR_PLAZA.maxZ) / 2], r: 7, strength: 1.3, color: '#ffc46b' },
  { p: [locationById('floral-world').position[0], 0, locationById('floral-world').position[2] + 1.5], r: 8, strength: 1.5, color: WARM },
  { p: loc('ps-room', -1), r: 6, strength: 1.4, color: '#c4b5fd' }, // Game Den
  { p: loc('hostel-social'), r: 8, strength: 1.3, color: WARM },
  { p: [LOVE_GARDEN.centre[0], 0, LOVE_GARDEN.centre[2]], r: 8, strength: 1.1, color: '#ffb3c7' },
  { p: loc('library'), r: 6, strength: 1.1, color: WARM },
  { p: loc('senate-library'), r: 7, strength: 1.1, color: WARM },
  { p: loc('bank-atm'), r: 5, strength: 1.1, color: '#bfe3ff' },
  { p: [CAR_PARK_BAY[0], 0, CAR_PARK_BAY[2]], r: 7, strength: 1.1, color: WARM },
  { p: loc('health-centre'), r: 6, strength: 1.2, color: '#e0f2ff' },
];
/** Stadium floodlights at the four corners of the pitch. */
const [PX, , PZ] = FOOTBALL_PITCH.centre;
const FLOODLIGHTS: Point[] = [[PX - 13, 0, PZ - 18], [PX + 13, 0, PZ - 18], [PX - 13, 0, PZ + 16], [PX + 13, 0, PZ + 16]];

/** Soft round glow, white in the middle and fading out; tinted by each pool's colour. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let sharedGlow: THREE.Texture | null = null;
export const glowMap = () => (sharedGlow ??= glowTexture());

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

/** Instanced lamp posts (pole + head) for the generated street lamps. */
function LampPosts({ lamps, night }: { lamps: Point[]; night: number }) {
  const poles = useRef<THREE.InstancedMesh>(null), heads = useRef<THREE.InstancedMesh>(null);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: WARM, emissiveIntensity: 0 }), []);
  useEffect(() => {
    lamps.forEach((p, i) => {
      poles.current!.setMatrixAt(i, _m.compose(_v.set(p[0], 2.3, p[2]), _q.identity(), _s.set(1, 1, 1)));
      heads.current!.setMatrixAt(i, _m.compose(_v.set(p[0], 4.65, p[2]), _q.identity(), _s.set(1, 1, 1)));
    });
    poles.current!.instanceMatrix.needsUpdate = true;
    heads.current!.instanceMatrix.needsUpdate = true;
  }, [lamps]);
  useEffect(() => { headMat.emissiveIntensity = 2.2 * night; }, [night, headMat]);
  return (
    <>
      <instancedMesh ref={poles} args={[undefined, undefined, lamps.length]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 4.6, 6]} />
        <meshStandardMaterial color="#3f4a52" metalness={0.6} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, lamps.length]} material={headMat}>
        <sphereGeometry args={[0.24, 10, 8]} />
      </instancedMesh>
    </>
  );
}

/** Additive ground glows: one instanced draw call per colour family. */
function GroundPools({ pools, night }: { pools: Source[]; night: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    map: glowMap(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  }), []);
  useEffect(() => {
    const c = new THREE.Color();
    pools.forEach((s, i) => {
      ref.current!.setMatrixAt(i, _m.compose(_v.set(s.p[0], 0.07, s.p[2]), FLAT, _s.set(s.r * 2, s.r * 2, 1)));
      ref.current!.setColorAt(i, c.set(s.color).multiplyScalar(0.55 * s.strength));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [pools]);
  useEffect(() => { mat.opacity = Math.min(1, night * 1.1); }, [night, mat]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pools.length]} material={mat} renderOrder={2} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </instancedMesh>
  );
}

/** Four real point lights that follow the light sources nearest the student, plus a viewer fill light. */
function NearestLights({ sources, night }: { sources: Source[]; night: number }) {
  // Every real light costs on every surface, so slower phones get fewer.
  const count = QUALITY[useGraphicsStore((s) => s.tier)].nightLights;
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const fill = useRef<THREE.PointLight>(null);
  const clock = useRef(0);
  useFrame(({ camera }, dt) => {
    // Soft fill from the viewer's side, so students seen from behind aren't silhouettes.
    if (fill.current) fill.current.position.copy(camera.position);
    clock.current -= dt;
    if (clock.current > 0) return;
    clock.current = 0.4;
    const [x, , z] = useGameStore.getState().myPosition;
    const nearest = [...sources].sort((a, b) => Math.hypot(a.p[0] - x, a.p[2] - z) - Math.hypot(b.p[0] - x, b.p[2] - z)).slice(0, count);
    nearest.forEach((s, i) => {
      const l = lights.current[i];
      if (!l) return;
      l.position.set(s.p[0], s.r > 8 ? 6 : 4.4, s.p[2]);
      l.color.set(s.color);
      l.distance = s.r * 2.6;
      l.intensity = 9 * s.strength * night;
    });
  });
  return (
    <>
      {Array.from({ length: count }, (_, i) => i).map((i) => <pointLight key={i} ref={(el) => { lights.current[i] = el; }} decay={1.6} intensity={0} />)}
      <pointLight ref={fill} color="#dbe4ff" intensity={14 * night} distance={22} decay={1.4} />
    </>
  );
}

/** Stadium floodlight masts (emissive heads), always standing; they glow at night. */
function Floodlights({ night }: { night: number }) {
  const head = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#ffffff', emissiveIntensity: 0 }), []);
  useEffect(() => { head.emissiveIntensity = 2.5 * night; }, [night, head]);
  return (
    <>
      {FLOODLIGHTS.map((p, i) => (
        <group key={i} position={p} rotation={[0, Math.atan2(PX - p[0], PZ - p[2]), 0]}>
          <mesh position={[0, 5, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.18, 10, 6]} />
            <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0, 10.1, 0.25]} rotation={[0.5, 0, 0]} material={head}>
            <boxGeometry args={[1.6, 0.9, 0.18]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Lamps, pools, floodlights, glowing windows and nearby real lights. Campus only. */
export function NightLights() {
  const night = useDayNight((s) => s.night);
  const lamps = useMemo(streetLamps, []);
  const sources = useMemo<Source[]>(() => [
    ...HUBS,
    ...lamps.map((p) => ({ p, r: 5.5, strength: 1, color: WARM })),
    ...SOLAR_LAMPS.map((p): Source => ({ p: [p[0] + 0.3, 0, p[2]], r: 5.5, strength: 1, color: '#fff1b8' })),
    ...FLOODLIGHTS.map((p): Source => ({ p: [p[0] + (PX - p[0]) * 0.35, 0, p[2] + (PZ - p[2]) * 0.35], r: 11, strength: 1.3, color: '#f1f5ff' })),
  ], [lamps]);

  // Windows light up warm after dark (every building shares the glass material).
  useEffect(() => {
    const glass = campusMaterials.glass;
    glass.emissive.set('#ffc56b');
    glass.emissiveIntensity = night * 0.85;
  }, [night]);

  const lit = night >= NIGHT_LIGHTS_FROM;
  return (
    <>
      <LampPosts lamps={lamps} night={night} />
      <Floodlights night={night} />
      {lit && <GroundPools pools={sources} night={night} />}
      {lit && <NearestLights sources={sources} night={night} />}
    </>
  );
}
