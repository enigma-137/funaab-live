import * as THREE from 'three';

// Watches and bags bought in the shop (migration 041). Shared geometry and materials: no per-avatar copies.
const mat = (color: string, metal = 0.1, emissive?: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: metal, ...(emissive ? { emissive, emissiveIntensity: 0.6 } : {}) });
const M = {
  black: mat('#1f2937'), silver: mat('#cbd5e1', 0.7), gold: mat('#d4a017', 0.85), smartFace: mat('#0b1220', 0.2, '#38bdf8'),
  navy: mat('#1d4ed8'), navyDark: mat('#1e3a8a'), strap: mat('#111827'), leather: mat('#8b4513'), leatherDark: mat('#5c2d0e'),
  cream: mat('#f5f0e6'), goldTrim: mat('#c9a227', 0.8),
};
const G = {
  band: new THREE.TorusGeometry(0.062, 0.014, 6, 18),
  face: new THREE.CylinderGeometry(0.03, 0.03, 0.014, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  handle: new THREE.TorusGeometry(0.07, 0.01, 5, 14, Math.PI),
};
const Box = ({ s, p, m }: { s: [number, number, number]; p: [number, number, number]; m: THREE.Material }) => (
  <mesh geometry={G.box} material={m} scale={s} position={p} />
);

/** On the left forearm, just above the hand (inside the elbow group). */
export function WristWatch({ kind }: { kind?: string }) {
  if (!kind || kind === 'none') return null;
  const band = kind === 'gold' ? M.gold : M.black;
  const face = kind === 'smart' ? M.smartFace : kind === 'gold' ? M.gold : M.silver;
  return (
    <group position={[0, -0.215, 0]}>
      <mesh geometry={G.band} material={band} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={G.face} material={face} position={[0.062, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
    </group>
  );
}

/** Backpack and shoulder handbag ride on the chest; `width` is the shoulder half-width. */
export function BodyBag({ kind, width }: { kind?: string; width: number }) {
  if (kind === 'backpack')
    return (
      <group position={[0, 1.2, -0.155]}>
        <Box s={[0.3, 0.38, 0.13]} p={[0, 0, 0]} m={M.navy} />
        <Box s={[0.22, 0.15, 0.05]} p={[0, -0.08, -0.08]} m={M.navyDark} />
        {[-0.09, 0.09].map((x) => <Box key={x} s={[0.035, 0.36, 0.02]} p={[x, 0.04, 0.09]} m={M.strap} />)}
      </group>
    );
  if (kind === 'handbag')
    return (
      <group position={[width + 0.04, 0, 0.02]}>
        <Box s={[0.02, 0.42, 0.02]} p={[-0.01, 1.2, 0.05]} m={M.leatherDark} />
        <Box s={[0.07, 0.19, 0.24]} p={[0.0, 0.92, 0]} m={M.leather} />
        <Box s={[0.075, 0.04, 0.245]} p={[0.0, 1.0, 0]} m={M.leatherDark} />
      </group>
    );
  return null;
}

/** The designer bag is carried in the left hand (inside the elbow group). */
export function HandBag({ kind }: { kind?: string }) {
  if (kind !== 'designer') return null;
  return (
    <group position={[0.01, -0.42, 0.02]}>
      <mesh geometry={G.handle} material={M.goldTrim} position={[0, 0.08, 0]} />
      <Box s={[0.26, 0.18, 0.11]} p={[0, -0.02, 0]} m={M.cream} />
      <Box s={[0.265, 0.06, 0.115]} p={[0, 0.04, 0]} m={M.goldTrim} />
    </group>
  );
}
