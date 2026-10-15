import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CAR_MODELS } from '../../config/cars';

const box = new THREE.BoxGeometry(1, 1, 1);
const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14);
const shared = {
  glass: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.2, metalness: 0.4 }),
  tyre: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.9 }),
  rim: new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.3, metalness: 0.7 }),
  head: new THREE.MeshBasicMaterial({ color: '#fef3c7' }),
  tail: new THREE.MeshBasicMaterial({ color: '#dc2626' }),
  plate: new THREE.MeshStandardMaterial({ color: '#f8fafc' }),
  trim: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.6 }),
};

/**
 * A car facing +Z, wheels on the ground (y 0). The driver sits on the left (+X), as in Nigeria.
 * `id` picks the model (Corolla, Camry, Lexus, G-Wagon) from config/cars.
 */
function CarBodyInner({ id }: { id: string }) {
  const m = CAR_MODELS[id] ?? CAR_MODELS.car_corolla;
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: m.paint, roughness: 0.35, metalness: 0.5 }), [m.paint]);
  useEffect(() => () => paint.dispose(), [paint]);
  const k = m.scale, h = m.suv ? 1.2 : 1;
  const B = ({ s, p, mat }: { s: [number, number, number]; p: [number, number, number]; mat: THREE.Material }) => <mesh geometry={box} material={mat} scale={s} position={p} castShadow />;
  const cabinLen = (m.boxy ? 2.5 : 2.1) * k, cabinH = (m.boxy ? 0.75 : 0.52) * h, bodyTop = 0.95 * h;
  return (
    <group>
      <B s={[1.8 * k, 0.5 * h, 4.2 * k]} p={[0, 0.7 * h, 0]} mat={paint} />
      <B s={[1.62 * k, cabinH, cabinLen]} p={[0, bodyTop + cabinH / 2, m.boxy ? -0.15 : -0.25]} mat={paint} />
      {/* Windows: front, back and both sides. */}
      <B s={[1.5 * k, cabinH * 0.75, 0.04]} p={[0, bodyTop + cabinH * 0.5, (m.boxy ? -0.15 : -0.25) + cabinLen / 2 + 0.01]} mat={shared.glass} />
      <B s={[1.5 * k, cabinH * 0.75, 0.04]} p={[0, bodyTop + cabinH * 0.5, (m.boxy ? -0.15 : -0.25) - cabinLen / 2 - 0.01]} mat={shared.glass} />
      {[-1, 1].map((s) => <B key={s} s={[0.04, cabinH * 0.7, cabinLen * 0.86]} p={[s * (0.81 * k + 0.01), bodyTop + cabinH * 0.5, m.boxy ? -0.15 : -0.25]} mat={shared.glass} />)}
      {/* Bumpers, lights and plates. */}
      <B s={[1.82 * k, 0.18, 0.12]} p={[0, 0.5 * h, 2.12 * k]} mat={shared.trim} />
      <B s={[1.82 * k, 0.18, 0.12]} p={[0, 0.5 * h, -2.12 * k]} mat={shared.trim} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <B s={[0.36, 0.14, 0.04]} p={[s * 0.62 * k, 0.82 * h, 2.11 * k]} mat={shared.head} />
          <B s={[0.36, 0.14, 0.04]} p={[s * 0.62 * k, 0.82 * h, -2.11 * k]} mat={shared.tail} />
        </group>
      ))}
      <B s={[0.5, 0.14, 0.02]} p={[0, 0.5 * h, 2.19 * k]} mat={shared.plate} />
      {[-1, 1].map((sx) => [-1, 1].map((sz) => (
        <group key={`${sx}${sz}`} position={[sx * 0.86 * k, 0.36 * h, sz * 1.35 * k]} rotation={[0, 0, Math.PI / 2]} scale={[h, 1, h]}>
          <mesh geometry={wheel} material={shared.tyre} />
          <mesh geometry={wheel} material={shared.rim} scale={[0.6, 1.05, 0.6]} />
        </group>
      )))}
    </group>
  );
}
export const CarBody = React.memo(CarBodyInner);
