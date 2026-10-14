import React, { useMemo } from 'react';
import * as THREE from 'three';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { FPY_FARM, FARM_STEPS } from '../../config/fpyFarm';
import { npcAppearance } from '../../config/npcAppearance';
import { useHustleStore } from '../../stores/hustleStore';
import { AvatarBody } from '../player/AvatarBody';
import { VisualBuilder, type Batch, type V3 } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';

const [CX, , CZ] = FPY_FARM.centre;
const [W, D] = FPY_FARM.size;
const GATE_HALF = 2.2;
const local = (p: readonly number[]): V3 => [p[0] - CX, p[1] ?? 0, p[2] - CZ];

/** Soil beds, crops, fence (with the west gate), shed and water tank, in farm-local metres. */
export function buildFpyFarm(): Batch[] {
  const b = new VisualBuilder();
  b.box([0, 0.02, 0], [W, 0.03, D], 'grass');
  // Three beds: maize (north-west), cassava (south), tomatoes (east), with walkable paths between.
  const beds: Array<{ x: number; z: number; w: number; d: number; crop: 'maize' | 'cassava' | 'tomato' }> = [
    { x: -6.2, z: -9, w: 6.5, d: 12, crop: 'maize' },
    { x: 0, z: 9, w: 15, d: 7, crop: 'cassava' },
    { x: 6.2, z: -5, w: 6.5, d: 12, crop: 'tomato' },
  ];
  for (const bed of beds) {
    b.box([bed.x, 0.06, bed.z], [bed.w, 0.1, bed.d], 'soil');
    const rows = Math.max(2, Math.floor(bed.w / 1.3));
    for (let r = 0; r < rows; r++) {
      const x = bed.x - bed.w / 2 + 0.65 + r * ((bed.w - 1.3) / Math.max(1, rows - 1));
      b.box([x, 0.13, bed.z], [0.45, 0.08, bed.d - 0.6], 'soil');
      for (let z = bed.z - bed.d / 2 + 0.8; z < bed.z + bed.d / 2 - 0.5; z += 1.1) {
        if (bed.crop === 'maize') {
          b.pole([x, 0.95, z], 0.05, 1.7, 'leafLight');
          b.box([x + 0.2, 1.1, z], [0.45, 0.05, 0.12], 'foliage', [0, 0, 0.5]);
          b.box([x + 0.1, 1.35, z + 0.05], [0.09, 0.28, 0.09], 'maize');
        } else if (bed.crop === 'cassava') {
          b.pole([x, 0.55, z], 0.035, 1, 'bark');
          b.orb([x, 1.1, z], [0.42, 0.22, 0.42], (r + Math.round(z)) % 2 ? 'leafDark' : 'foliage');
        } else {
          b.orb([x, 0.4, z], [0.32, 0.3, 0.32], 'leafLight');
          for (const [dx, dz] of [[0.18, 0.1], [-0.15, -0.12], [0.02, 0.2]]) b.orb([x + dx, 0.42, z + dz], [0.08, 0.08, 0.08], 'tomato');
        }
      }
    }
  }
  // Fence: posts and two rails, open at the west gate.
  const rail = (a: V3, c: V3) => {
    const len = Math.hypot(c[0] - a[0], c[2] - a[2]);
    const mid: V3 = [(a[0] + c[0]) / 2, 0, (a[2] + c[2]) / 2];
    const yaw = Math.atan2(-(c[2] - a[2]), c[0] - a[0]);
    for (const y of [0.55, 1.05]) b.box([mid[0], y, mid[2]], [len, 0.08, 0.06], 'wood', [0, yaw, 0]);
    for (let t = 0; t <= len; t += 2.5) b.box([a[0] + ((c[0] - a[0]) * t) / len, 0.6, a[2] + ((c[2] - a[2]) * t) / len], [0.12, 1.2, 0.12], 'wood');
  };
  const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  rail([x0, 0, z0], [x1, 0, z0]);
  rail([x1, 0, z0], [x1, 0, z1]);
  rail([x0, 0, z1], [x1, 0, z1]);
  rail([x0, 0, z0], [x0, 0, -GATE_HALF]);
  rail([x0, 0, GATE_HALF], [x0, 0, z1]);
  // Gate posts.
  for (const z of [-GATE_HALF, GATE_HALF]) b.box([x0, 0.9, z], [0.22, 1.8, 0.22], 'wood');
  // Tool shed with a tin roof and an overhead water tank on a stand.
  const [sx, , sz] = local(FPY_FARM.shed);
  b.box([sx, 1.3, sz], [5, 2.6, 3.2], 'cream');
  b.box([sx, 2.75, sz], [5.6, 0.15, 3.8], 'roof', [0, 0, 0.06]);
  b.box([sx - 0.8, 1, sz + 1.62], [1.1, 2, 0.06], 'wood');
  for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) b.pole([sx + 3.6 + dx, 1.3, sz + dz], 0.07, 2.6, 'metal');
  b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 14), 'tankBlack', [sx + 3.6, 3.2, sz]);
  b.box([sx + 3.6, 2.6, sz], [1.4, 0.08, 1.4], 'metal');
  return b.finish();
}

const WORKERS: Array<{ id: string; at: V3; yaw: number; feminine: boolean }> = [
  { id: 'fpy-worker-1', at: [-4.6, 0, -5.5], yaw: -2.4, feminine: false },
  { id: 'fpy-worker-2', at: [3.2, 0, 9.8], yaw: 0.4, feminine: true },
  { id: 'fpy-worker-3', at: [8.6, 0, -8.2], yaw: -1.2, feminine: true },
  { id: 'fpy-worker-4', at: [-8.3, 0, 3.4], yaw: 1.9, feminine: false },
];
const WORKER_LOOKS = WORKERS.map((w) =>
  npcAppearance(w.id, { bodyType: w.feminine ? 'feminine' : 'masculine', topStyle: 'jumpsuit', topColor: FPY_FARM.jumpsuitGreen, shoeStyle: 'boots', shoeColor: '#2a2522' }),
);

/** Glowing ring on the plot for the next job of your farm shift. */
function NextPlot() {
  const step = useHustleStore((s) => s.farm?.step);
  if (step == null || step >= FARM_STEPS.length) return null;
  const [x, , z] = local(FARM_STEPS[step].spot);
  return (
    <mesh position={[x, 0.22, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.6, 2.1, 32]} />
      <meshBasicMaterial color="#facc15" transparent opacity={0.8} />
    </mesh>
  );
}

export function FpyFarm() {
  const batches = useMemo(buildFpyFarm, []);
  const [sx, , sz] = local(FPY_FARM.shed);
  const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  const southLen = z1 - GATE_HALF, northLen = -GATE_HALF - z0;
  return (
    <group position={[CX, 0, CZ]} name="fpy_farm">
      <StaticBatches batches={batches} />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0, 0.6, z0]} args={[W / 2, 0.6, 0.08]} />
        <CuboidCollider position={[0, 0.6, z1]} args={[W / 2, 0.6, 0.08]} />
        <CuboidCollider position={[x1, 0.6, 0]} args={[0.08, 0.6, D / 2]} />
        <CuboidCollider position={[x0, 0.6, z0 + northLen / 2]} args={[0.08, 0.6, northLen / 2]} />
        <CuboidCollider position={[x0, 0.6, GATE_HALF + southLen / 2]} args={[0.08, 0.6, southLen / 2]} />
        <CuboidCollider position={[sx, 1.3, sz]} args={[2.5, 1.3, 1.6]} />
      </RigidBody>
      <CampusSign position={[x0 - 1.2, 0, -GATE_HALF - 2.4]} width={4.6} height={1.2} title="FPY FARM" subtitle="Teaching & Research Farm" />
      {WORKERS.map((w, i) => (
        <group key={w.id} position={w.at} rotation={[0, w.yaw, 0]}>
          <AvatarBody identity={w.id} config={WORKER_LOOKS[i]} animation="idle" />
        </group>
      ))}
      <NextPlot />
    </group>
  );
}
