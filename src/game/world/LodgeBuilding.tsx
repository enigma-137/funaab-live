import React from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { campusMaterials } from './campusVisualGeometry';
import { CampusSign } from './CampusSign';
import { LODGE } from '../../config/lodge';

// Stable asset key so a Blender model can replace this later.
export const LODGE_ASSET_KEY = 'offcampus_lodge';

/** Two-storey off-campus lodge across the gate road, facing campus. */
export function LodgeBuilding() {
  const [w, d] = LODGE.footprint;
  const f = LODGE.frontage;
  return (
    <group name="offcampus-lodge">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(f.minX + f.maxX) / 2, 0.016, (f.minZ + f.maxZ) / 2]} material={campusMaterials.paving} receiveShadow>
        <planeGeometry args={[f.maxX - f.minX, f.maxZ - f.minZ]} />
      </mesh>
      <group name={LODGE_ASSET_KEY} position={LODGE.position}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[w / 2, 3.2, d / 2]} position={[0, 3.2, 0]} />
        </RigidBody>
        <mesh position={[0, 1.6, 0]} castShadow receiveShadow><boxGeometry args={[w, 3.2, d]} /><meshStandardMaterial color="#efe0bf" /></mesh>
        <mesh position={[0, 3.3, 0]}><boxGeometry args={[w + 0.3, 0.2, d + 0.3]} /><meshStandardMaterial color="#b45309" /></mesh>
        <mesh position={[0, 4.8, 0]} castShadow><boxGeometry args={[w, 2.8, d]} /><meshStandardMaterial color="#f6ead2" /></mesh>
        <mesh position={[0, 6.35, 0]}><boxGeometry args={[w + 0.5, 0.3, d + 0.5]} /><meshStandardMaterial color="#7c2d12" /></mesh>
        {/* Front: windows with burglar-proof bars on both floors, gate in the middle. */}
        {[1.5, 4.7].map((y) => [-3.4, -1.7, 1.7, 3.4].map((x) => (
          <group key={`${x}-${y}`} position={[x, y, -d / 2 - 0.02]}>
            <mesh><boxGeometry args={[1.1, 1, 0.04]} /><meshStandardMaterial color="#1e3a5f" /></mesh>
            {[-0.35, 0, 0.35].map((bx) => <mesh key={bx} position={[bx, 0, -0.03]}><boxGeometry args={[0.04, 1, 0.03]} /><meshStandardMaterial color="#334155" /></mesh>)}
          </group>
        )))}
        <mesh position={[0, 1.15, -d / 2 - 0.03]}><boxGeometry args={[1.3, 2.3, 0.05]} /><meshStandardMaterial color="#14532d" /></mesh>
        <mesh position={[0.45, 1.15, -d / 2 - 0.07]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#facc15" /></mesh>
        <group position={[0, 3.3, -d / 2 - 0.25]} rotation={[0, Math.PI, 0]}>
          <CampusSign width={4.2} height={0.6} title={LODGE.name.toUpperCase()} subtitle="SELF-CONTAIN  •  TO LET" tone="cream" />
        </group>
      </group>
    </group>
  );
}
