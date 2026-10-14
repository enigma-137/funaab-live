import React from 'react';
import { CampusSign } from './CampusSign';
import { PHOTO_SPOTS, POS_KIOSK } from '../../config/hustles';

// Stable asset keys so Blender models can replace these later.
export const HUSTLE_ASSET_KEYS = { kiosk: 'hustle_pos_kiosk', photoSpot: 'hustle_photo_spot' } as const;

/** POS / recharge booth outside the Microfinance Bank. */
function PosKiosk() {
  const [x, , z] = POS_KIOSK.booth;
  return (
    <group name={HUSTLE_ASSET_KEYS.kiosk} position={[x, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[1.4, 1.1, 0.8]} /><meshStandardMaterial color="#1d4ed8" /></mesh>
      <mesh position={[0, 1.12, 0.05]}><boxGeometry args={[1.5, 0.06, 0.95]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      <mesh position={[-0.35, 1.22, 0.15]} rotation={[-0.5, 0, 0]}><boxGeometry args={[0.22, 0.04, 0.3]} /><meshStandardMaterial color="#0f172a" /></mesh>
      {[-0.65, 0.65].map((px) => (
        <mesh key={px} position={[px, 1.6, -0.35]}><cylinderGeometry args={[0.03, 0.03, 1, 6]} /><meshStandardMaterial color="#64748b" /></mesh>
      ))}
      <mesh position={[0, 2.12, -0.05]} rotation={[0.15, 0, 0]}><boxGeometry args={[1.7, 0.05, 1.1]} /><meshStandardMaterial color="#facc15" /></mesh>
      <CampusSign position={[0, 1.78, -0.36]} width={1.3} height={0.32} title="POS · RECHARGE" tone="cream" />
    </group>
  );
}

/** A tripod and a small sign: where the photographer hustle happens. */
function PhotoSpot({ position }: { position: [number, number, number] }) {
  return (
    <group name={HUSTLE_ASSET_KEYS.photoSpot} position={position}>
      {[0, 2.1, 4.2].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.22, 0.6, Math.cos(a) * 0.22]} rotation={[Math.cos(a) * 0.32, 0, -Math.sin(a) * 0.32]}>
          <cylinderGeometry args={[0.02, 0.02, 1.25, 5]} /><meshStandardMaterial color="#334155" />
        </mesh>
      ))}
      <mesh position={[0, 1.28, 0]}><boxGeometry args={[0.32, 0.22, 0.2]} /><meshStandardMaterial color="#0f172a" /></mesh>
      <mesh position={[0, 1.28, 0.14]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.08, 0.12, 12]} /><meshStandardMaterial color="#475569" /></mesh>
      <CampusSign position={[0.75, 1.05, 0]} width={0.9} height={0.26} title="PHOTO SPOT" tone="green" />
    </group>
  );
}

export function HustleProps() {
  return (
    <group name="hustle-props">
      <PosKiosk />
      {PHOTO_SPOTS.map((s) => <PhotoSpot key={s.id} position={s.position} />)}
    </group>
  );
}
