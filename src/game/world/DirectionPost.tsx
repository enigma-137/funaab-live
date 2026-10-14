import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { locationById, type Point } from '../../config/campusLocations';
import { bearingTo } from './navigationMath';
import { campusMaterials } from './campusVisualGeometry';

// Fingerposts: each arm is turned to point at its real destination, so the arrows can never
// disagree with the map. Both faces are lettered so the post reads from either side.
const ARM_LEN = 2.3;
const ARM_H = 0.34;

function armMaterial(label: string, tipOnRight: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 76;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#155642';
  c.fillRect(0, 0, 512, 76);
  c.fillStyle = '#faf4de';
  c.textBaseline = 'middle';
  let size = 40;
  c.font = `700 ${size}px Arial`;
  while (c.measureText(label).width > 400 && size > 14) c.font = `700 ${--size}px Arial`;
  c.textAlign = tipOnRight ? 'left' : 'right';
  c.fillText(label, tipOnRight ? 22 : 490, 40);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
}

// Arrow-shaped arm along local +X, tip at +X.
const armGeometry = (() => {
  const s = new THREE.Shape();
  const h = ARM_H / 2;
  s.moveTo(0, -h); s.lineTo(ARM_LEN - 0.3, -h); s.lineTo(ARM_LEN, 0); s.lineTo(ARM_LEN - 0.3, h); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false });
  g.translate(0, 0, -0.03);
  return g;
})();
const faceGeometry = new THREE.PlaneGeometry(ARM_LEN - 0.3, ARM_H - 0.04);

function Arm({ label, heading, y }: { label: string; heading: number; y: number }) {
  const [front, back] = useMemo(() => [armMaterial(`${label}  ▶`, true), armMaterial(`◀  ${label}`, false)], [label]);
  useEffect(() => () => [front, back].forEach((m) => { m.map?.dispose(); m.dispose(); }), [front, back]);
  // Local +X → world (sin h, cos h): a turn of h - PI/2 about Y.
  return (
    <group position={[0, y, 0]} rotation={[0, heading - Math.PI / 2, 0]}>
      <mesh geometry={armGeometry} material={campusMaterials.green} />
      <mesh geometry={faceGeometry} material={front} position={[(ARM_LEN - 0.3) / 2, 0, 0.035]} />
      <mesh geometry={faceGeometry} material={back} position={[(ARM_LEN - 0.3) / 2, 0, -0.035]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

export function DirectionPost({ at, to }: { at: Point; to: Array<{ id: string; label?: string }> }) {
  const arms = to.map((d, i) => {
    const l = locationById(d.id);
    return { key: d.id, label: d.label ?? l.shortName, heading: bearingTo(at, l.entrance), y: 3.15 - i * 0.4 };
  });
  return (
    <group position={at} name="direction_post">
      <mesh position={[0, 1.7, 0]} material={campusMaterials.metal}>
        <cylinderGeometry args={[0.07, 0.09, 3.4, 8]} />
      </mesh>
      <mesh position={[0, 3.45, 0]} material={campusMaterials.gold}>
        <sphereGeometry args={[0.11, 10, 8]} />
      </mesh>
      {arms.map((a) => <Arm key={a.key} label={a.label} heading={a.heading} y={a.y} />)}
    </group>
  );
}

/** Fingerposts along the Ceremonial Road and at the academic crossing. */
export function CampusDirectionPosts() {
  return (
    <group name="campus_direction_posts">
      <DirectionPost at={[-6.5, 0, 66]} to={[
        { id: 'library' }, { id: 'senate-library', label: 'Senate' }, { id: 'sports-centre', label: 'Sports Centre' },
        { id: 'hostel-social', label: 'Hostel' }, { id: 'car-park', label: 'Car Park' }, { id: 'acad' },
      ]} />
      <DirectionPost at={[-6.5, 0, 53]} to={[
        { id: 'w-landmark', label: 'W Landmark' }, { id: 'food-court', label: 'Food Court' }, { id: 'sports-courts', label: 'Courts' },
        { id: 'colanim' }, { id: 'bank-atm', label: 'Bank / ATM' },
      ]} />
      <DirectionPost at={[-6.5, 0, -34]} to={[
        { id: 'colfhec' }, { id: 'central-lecture-hall', label: 'Central Lecture' }, { id: 'acad' },
        { id: 'health-centre', label: 'Health Centre' }, { id: 'coleng' },
      ]} />
    </group>
  );
}
