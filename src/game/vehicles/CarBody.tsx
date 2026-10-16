import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CAR_MODELS } from '../../config/cars';

const box = new THREE.BoxGeometry(1, 1, 1);
const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14);
const shared = {
  // See-through tint: you can look out from the inside view, and the cabin reads as dark glass outside.
  glass: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.45, depthWrite: false }),
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

// Inside view: everything drawn from both sides, since the camera sits among it.
const two = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide, ...extra });
const dash = two('#1f2937');
const dashTrim = two('#334155', { metalness: 0.3, roughness: 0.5 });
const gauge = new THREE.MeshBasicMaterial({ color: '#f59e0b' });
const screen = new THREE.MeshBasicMaterial({ color: '#0e7490' });
const wheelGeo = new THREE.TorusGeometry(0.15, 0.022, 8, 24);
const wheelMat = two('#64748b', { metalness: 0.4, roughness: 0.4 });
const pillar = two('#111827');
const seatMat = two('#3f2d24', { roughness: 0.9 });

/**
 * The view from a seat (car-local, facing +Z): bonnet ahead, dashboard with gauges and the steering
 * wheel, windscreen pillars, roof edge and door sills. Used instead of the outside body when the
 * camera is inside, so nothing blocks the view of campus.
 */
export function Cockpit({ id }: { id: string }) {
  const m = CAR_MODELS[id] ?? CAR_MODELS.car_corolla;
  const paint = useMemo(() => two(m.paint, { metalness: 0.4, roughness: 0.35 }), [m.paint]);
  useEffect(() => () => paint.dispose(), [paint]);
  const k = m.scale, h = m.suv ? 1.2 : 1, top = 0.95 * h, roof = top + (m.boxy ? 0.75 : 0.52) * h, front = 0.8 * k;
  const B = ({ s, p, mat, r }: { s: [number, number, number]; p: [number, number, number]; mat: THREE.Material; r?: [number, number, number] }) =>
    <mesh geometry={box} material={mat} scale={s} position={p} rotation={r} />;
  return (
    <group>
      {/* Bonnet sloping away ahead of the windscreen. */}
      <B s={[1.76 * k, 0.06, 1.3 * k]} p={[0, top - 0.02, front + 0.7 * k]} mat={paint} r={[-0.06, 0, 0]} />
      {/* Dashboard, gauges, centre screen. */}
      <B s={[1.6 * k, 0.24, 0.42]} p={[0, top - 0.14, front - 0.12]} mat={dash} />
      <B s={[1.6 * k, 0.04, 0.44]} p={[0, top - 0.01, front - 0.12]} mat={dashTrim} />
      <B s={[0.26, 0.07, 0.02]} p={[0.42, top - 0.08, front - 0.34]} mat={gauge} />
      <B s={[0.22, 0.12, 0.02]} p={[0, top - 0.1, front - 0.34]} mat={screen} />
      {/* Steering wheel in front of the driver. */}
      <group position={[0.42, top - 0.13, front - 0.42]} rotation={[-0.45, 0, 0]}>
        <mesh geometry={wheelGeo} material={wheelMat} />
        <B s={[0.28, 0.03, 0.03]} p={[0, 0, 0]} mat={wheelMat} />
        <B s={[0.03, 0.14, 0.03]} p={[0, -0.07, 0]} mat={wheelMat} />
      </group>
      {/* Windscreen pillars (raked back to the roof), roof edge, door sills. */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B s={[0.07, Math.hypot(roof - top, 0.5), 0.07]} p={[sx * 0.78 * k, (top + roof) / 2, front - 0.3]} mat={pillar} r={[-Math.atan2(0.5, roof - top), 0, 0]} />
          <B s={[0.06, 0.22, 2.2 * k]} p={[sx * 0.8 * k, top + 0.12, -0.3]} mat={paint} />
        </group>
      ))}
      <B s={[1.6 * k, 0.07, 0.18]} p={[0, roof, front - 0.55]} mat={pillar} />
      <B s={[1.6 * k, 0.03, 1.6 * k]} p={[0, roof + 0.02, -0.95]} mat={pillar} />
      {/* Front seats either side. */}
      {[0.42, -0.42].map((x) => <B key={x} s={[0.5, 0.6, 0.1]} p={[x, top + 0.35, -0.6]} mat={seatMat} />)}
    </group>
  );
}
