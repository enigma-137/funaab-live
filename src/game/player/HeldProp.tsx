import * as THREE from 'three';
import type { HeldKind } from '../../config/heldItems';

// Small low-poly props for food and drinks carried in hand. Shared materials and geometry keep
// a crowd of students holding things cheap to draw.
const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const M = {
  foam: mat('#f4f4ef', { roughness: 0.9 }),
  seam: mat('#d9d9d0', { roughness: 0.9 }),
  paper: mat('#e9dcbc', { roughness: 0.95 }),
  meat: mat('#7a3b1d'),
  bowl: mat('#ffffff', { roughness: 0.35 }),
  noodles: mat('#f2c75c', { roughness: 0.8 }),
  egg: mat('#fff7e0'),
  water: mat('#9fd8ff', { transparent: true, opacity: 0.8, roughness: 0.1 }),
  cap: mat('#1d6fd6'),
  malt: mat('#3b1d0e', { roughness: 0.3 }),
  label: mat('#d8a531', { roughness: 0.5 }),
  plate: mat('#fafafa', { roughness: 0.3 }),
  jollof: mat('#d9541e', { roughness: 0.85 }),
  chicken: mat('#a8571f', { roughness: 0.7 }),
};
const G = {
  pack: new THREE.BoxGeometry(0.2, 0.07, 0.15),
  packSeam: new THREE.BoxGeometry(0.202, 0.006, 0.152),
  wrap: new THREE.CylinderGeometry(0.036, 0.032, 0.17, 10),
  wrapTop: new THREE.CylinderGeometry(0.03, 0.036, 0.03, 10),
  bowl: new THREE.CylinderGeometry(0.09, 0.055, 0.065, 16),
  noodles: new THREE.CylinderGeometry(0.082, 0.082, 0.01, 16),
  egg: new THREE.SphereGeometry(0.028, 10, 6),
  bottle: new THREE.CylinderGeometry(0.03, 0.03, 0.17, 12),
  neck: new THREE.CylinderGeometry(0.012, 0.028, 0.045, 12),
  cap: new THREE.CylinderGeometry(0.014, 0.014, 0.018, 10),
  label: new THREE.CylinderGeometry(0.031, 0.031, 0.06, 12),
  plate: new THREE.CylinderGeometry(0.14, 0.11, 0.018, 20),
  mound: new THREE.SphereGeometry(0.085, 14, 8),
  drumstick: new THREE.SphereGeometry(0.04, 10, 6),
};

/** `served`: standing on a table (origin at the table top) instead of in a hand. */
export function HeldProp({ kind, served = false }: { kind: HeldKind; served?: boolean }) {
  if (served) return <group scale={1.35}><ServedProp kind={kind} /></group>;
  switch (kind) {
    case 'pack': // the classic white takeaway pack
      return (
        <group position={[0, -0.02, 0.05]}>
          <mesh geometry={G.pack} material={M.foam} castShadow />
          <mesh geometry={G.packSeam} material={M.seam} position={[0, 0.012, 0]} />
        </group>
      );
    case 'wrap': // shawarma or suya in paper
      return (
        <group position={[0, 0.02, 0.04]} rotation={[0.25, 0, 0]}>
          <mesh geometry={G.wrap} material={M.paper} castShadow />
          <mesh geometry={G.wrapTop} material={M.meat} position={[0, 0.098, 0]} />
        </group>
      );
    case 'bowl': // indomie
      return (
        <group position={[0, -0.01, 0.06]}>
          <mesh geometry={G.bowl} material={M.bowl} castShadow />
          <mesh geometry={G.noodles} material={M.noodles} position={[0, 0.028, 0]} />
          <mesh geometry={G.egg} material={M.egg} position={[0.025, 0.03, 0.01]} scale={[1, 0.45, 1]} />
        </group>
      );
    case 'water':
    case 'malt': {
      const body = kind === 'water' ? M.water : M.malt;
      return (
        <group position={[0, 0.04, 0.035]}>
          <mesh geometry={G.bottle} material={body} castShadow />
          <mesh geometry={G.neck} material={body} position={[0, 0.107, 0]} />
          <mesh geometry={G.cap} material={kind === 'water' ? M.cap : M.label} position={[0, 0.138, 0]} />
          {kind === 'malt' && <mesh geometry={G.label} material={M.label} />}
        </group>
      );
    }
  }
}

/** Food and drinks on a restaurant table: rice on a plate, everything else standing upright. */
function ServedProp({ kind }: { kind: HeldKind }) {
  switch (kind) {
    case 'pack': // a plate of jollof with chicken
      return (
        <group>
          <mesh geometry={G.plate} material={M.plate} position={[0, 0.009, 0]} castShadow />
          <mesh geometry={G.mound} material={M.jollof} position={[-0.02, 0.025, 0]} scale={[1, 0.45, 0.9]} />
          <mesh geometry={G.drumstick} material={M.chicken} position={[0.06, 0.04, 0.02]} scale={[1.4, 0.8, 1]} />
        </group>
      );
    case 'wrap':
      return (
        <group>
          <mesh geometry={G.plate} material={M.plate} position={[0, 0.009, 0]} castShadow />
          <group position={[0, 0.05, 0]} rotation={[0, 0.5, Math.PI / 2]}>
            <mesh geometry={G.wrap} material={M.paper} />
            <mesh geometry={G.wrapTop} material={M.meat} position={[0, 0.098, 0]} />
          </group>
        </group>
      );
    case 'bowl':
      return (
        <group position={[0, 0.033, 0]}>
          <mesh geometry={G.bowl} material={M.bowl} castShadow />
          <mesh geometry={G.noodles} material={M.noodles} position={[0, 0.028, 0]} />
          <mesh geometry={G.egg} material={M.egg} position={[0.025, 0.03, 0.01]} scale={[1, 0.45, 1]} />
        </group>
      );
    default:
      // Bottles: the hand version already stands upright; lift it so its base sits on the table.
      return <group position={[0.06, 0.045, -0.035]}><HeldProp kind={kind} /></group>;
  }
}
