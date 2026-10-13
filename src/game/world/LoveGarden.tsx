import React, { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { LOVE_GARDEN, LOVE_GARDEN_ASSET_KEYS, LOVE_GARDEN_PAVING, isInLoveGarden, loveGardenBenches } from '../../config/loveGarden';
import { useGameStore } from '../../stores/gameStore';
import { VisualBuilder, type Batch, type V3 } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';

const [CX, , CZ] = LOVE_GARDEN.centre;
const SIGN_AT: V3 = [46.8, 0, 7.1];

/** Garden-local point for a bench-local offset (bench faces local +z, toward the trunk). */
const benchPoint = (bench: (typeof loveGardenBenches)[number], lx: number, y: number, lz: number): V3 => {
  const c = Math.cos(bench.rotation), s = Math.sin(bench.rotation);
  return [bench.position[0] - CX + lx * c + lz * s, y, bench.position[2] - CZ - lx * s + lz * c];
};

export function buildLoveGardenTree(): Batch[] {
  const b = new VisualBuilder();
  b.pole([0, 2.3, 0], LOVE_GARDEN.treeTrunkRadius, 4.6, 'bark');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    b.pole([Math.cos(a) * 0.9, 4.4, Math.sin(a) * 0.9], 0.16, 2.2, 'bark', [Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75]);
    b.orb([Math.cos(a) * 2.6, 5.5 + (i % 2) * 0.45, Math.sin(a) * 2.6], [2.1, 1.3, 2.1], i % 3 === 0 ? 'leafLight' : i % 3 === 1 ? 'foliage' : 'leafDark');
  }
  b.orb([0, 6.4, 0], [3.3, 1.6, 3.3], 'foliage');
  // Raised planter with flowers around the trunk.
  b.add(new THREE.CylinderGeometry(1.5, 1.55, 0.32, 20), 'curb', [0, 0.16, 0]);
  b.add(new THREE.CylinderGeometry(1.32, 1.32, 0.04, 20), 'gravel', [0, 0.33, 0]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    b.orb([Math.cos(a) * 1.05, 0.45, Math.sin(a) * 1.05], [0.22, 0.17, 0.22], i % 2 ? 'leafLight' : 'flower');
  }
  return b.finish();
}

export function buildLoveGardenGrounds(): Batch[] {
  const b = new VisualBuilder();
  // Paving exactly matches the legal (fine-free) terrain zones.
  for (const p of Object.values(LOVE_GARDEN_PAVING))
    b.box([(p.minX + p.maxX) / 2 - CX, 0.028, (p.minZ + p.maxZ) / 2 - CZ], [p.maxX - p.minX, 0.045, p.maxZ - p.minZ], 'paving');
  b.add(new THREE.CylinderGeometry(6.2, 6.2, 0.012, 40), 'brick', [0, 0.056, 0]);
  // Corner flower beds.
  for (const [x, z] of [[-6.4, -6.4], [6.4, -6.4], [-6.4, 6.4]]) {
    b.box([x, 0.07, z], [1.6, 0.08, 1.6], 'gravel');
    for (let j = 0; j < 4; j++) b.orb([x + (j % 2 ? 0.4 : -0.4), 0.3, z + (j < 2 ? 0.4 : -0.4)], [0.36, 0.26, 0.36], j % 2 ? 'flower' : 'leafLight');
  }
  // Benches (asset key love_garden_bench): slatted seat, backrest away from the tree, metal legs.
  for (const bench of loveGardenBenches) {
    const r: V3 = [0, bench.rotation, 0];
    for (const lz of [-0.28, 0, 0.28]) b.box(benchPoint(bench, 0, 0.48, lz), [1.7, 0.09, 0.2], 'wood', r);
    b.box(benchPoint(bench, 0, 0.86, -0.36), [1.7, 0.55, 0.08], 'wood', r);
    for (const lx of [-0.58, 0.58]) b.box(benchPoint(bench, lx, 0.24, 0), [0.1, 0.48, 0.5], 'metal', r);
  }
  return b.finish();
}

function StudentsHere() {
  const count = useGameStore((s) => {
    let n = isInLoveGarden(s.myPosition[0], s.myPosition[2]) ? 1 : 0;
    for (const p of Object.values(s.players)) if (isInLoveGarden(p.position[0], p.position[2])) n++;
    return n;
  });
  if (!count) return null;
  return (
    <Html position={[SIGN_AT[0], 3.1, SIGN_AT[2]]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
      <div className="px-2.5 py-0.5 rounded-lg bg-emerald-950/90 border border-emerald-400/70 text-emerald-100 text-[11px] font-bold font-['Outfit'] whitespace-nowrap">
        {count} {count === 1 ? 'student' : 'students'} here
      </div>
    </Html>
  );
}

export function LoveGarden() {
  const tree = useMemo(buildLoveGardenTree, []);
  const grounds = useMemo(buildLoveGardenGrounds, []);
  useEffect(() => () => [...tree, ...grounds].forEach((b) => b.geometry.dispose()), [tree, grounds]);
  return (
    <group name="love_garden">
      <group position={LOVE_GARDEN.centre}>
        <group name={LOVE_GARDEN_ASSET_KEYS.tree}>
          <StaticBatches batches={tree} />
          <RigidBody type="fixed" colliders={false}>
            <CylinderCollider args={[1, 1.5]} position={[0, 1, 0]} />
          </RigidBody>
        </group>
        <group name={LOVE_GARDEN_ASSET_KEYS.bench}>
          <StaticBatches batches={grounds} />
        </group>
      </group>
      <group name={LOVE_GARDEN_ASSET_KEYS.sign} position={SIGN_AT}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 1.05, 0.9, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 1.8, 6]} />
            <meshStandardMaterial color="#53615c" />
          </mesh>
        ))}
        <CampusSign position={[0, 1.8, 0]} width={2.4} height={0.8} title="LOVE GARDEN" subtitle="SIT DOWN  •  GIST  •  RELAX" tone="cream" />
      </group>
      <StudentsHere />
    </group>
  );
}
