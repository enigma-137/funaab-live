import React from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useCarStore } from '../../stores/carStore';
import { useHostelStore } from '../../stores/hostelStore';
import { CAR_MODELS, DRIVE, FUEL_STATION } from '../../config/cars';
import { TOWN_LINK } from '../../config/hostelTown';
import { CarBody } from './CarBody';
import { CarRace } from './CarRace';
import { CampusSign } from '../world/CampusSign';

/** Your car where you left it (others see it while you drive). Solid, so people walk round it.
 *  `hostel`: draw the car kept in your hostel garage (the courtyard) instead of one on campus. */
export function ParkedCar({ hostel = false }: { hostel?: boolean }) {
  const parked = useCarStore((s) => s.parked);
  const driving = useCarStore((s) => s.driving);
  const paint = useCarStore((s) => (parked ? s.paint[parked.car] ?? null : null));
  if (!parked || driving || (parked.where === 'hostel') !== hostel) return null;
  const k = CAR_MODELS[parked.car]?.scale ?? 1;
  return (
    <group position={parked.position} rotation={[0, parked.rotation, 0]}>
      <CarBody id={parked.car} paint={paint} />
      <RigidBody type="fixed" colliders={false} key={`${parked.position.join(',')}`}>
        <CuboidCollider position={[0, DRIVE.half[1] + 0.12, 0]} args={[DRIVE.half[0] * k, DRIVE.half[1], DRIVE.half[2] * k]} />
      </RigidBody>
    </group>
  );
}

/** Fuel station on the gate road: canopy, two pumps and a price sign. */
function FuelStation() {
  const [cx, , cz] = FUEL_STATION.centre, [w, d] = FUEL_STATION.size;
  return (
    <group name="fuel-station">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]} receiveShadow>
        <planeGeometry args={[w + 4, d + 2]} />
        <meshStandardMaterial color="#9ca3af" roughness={1} />
      </mesh>
      {/* Canopy on four columns. */}
      <mesh position={[cx, 4.4, cz]}><boxGeometry args={[w, 0.5, d]} /><meshStandardMaterial color="#f8fafc" /></mesh>
      <mesh position={[cx, 4.15, cz + d / 2]}><boxGeometry args={[w, 0.3, 0.05]} /><meshStandardMaterial color="#dc2626" /></mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[cx + sx * (w / 2 - 0.6), 2.1, cz + sz * (d / 2 - 0.6)]}><boxGeometry args={[0.35, 4.2, 0.35]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
      )))}
      {FUEL_STATION.pumps.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.15, 0]}><boxGeometry args={[1.4, 0.3, 0.9]} /><meshStandardMaterial color="#d1d5db" /></mesh>
          <mesh position={[0, 1.1, 0]}><boxGeometry args={[0.8, 1.6, 0.5]} /><meshStandardMaterial color="#dc2626" /></mesh>
          <mesh position={[0, 1.45, 0.26]}><boxGeometry args={[0.5, 0.35, 0.02]} /><meshBasicMaterial color="#0f172a" /></mesh>
          <mesh position={[0.45, 1.0, 0]}><boxGeometry args={[0.08, 0.5, 0.08]} /><meshStandardMaterial color="#111827" /></mesh>
        </group>
      ))}
      <RigidBody type="fixed" colliders={false}>
        {FUEL_STATION.pumps.map((p, i) => <CuboidCollider key={i} position={[p[0], 0.9, p[2]]} args={[0.7, 0.9, 0.45]} />)}
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <CuboidCollider key={`${sx}${sz}`} position={[cx + sx * (w / 2 - 0.6), 2.1, cz + sz * (d / 2 - 0.6)]} args={[0.18, 2.1, 0.18]} />))}
      </RigidBody>
      {/* Price board facing the road (campus side). */}
      <group position={[cx + w / 2 + 1.2, 0, cz - d / 2]}>
        <mesh position={[0, 1.6, 0]}><boxGeometry args={[0.2, 3.2, 0.2]} /><meshStandardMaterial color="#334155" /></mesh>
        <group position={[0, 3.6, -0.12]} rotation={[0, Math.PI, 0]}>
          <CampusSign width={2.6} height={1} title="FUEL" subtitle="₦150 / LITRE" />
        </group>
      </group>
    </group>
  );
}

/** West end of the gate road: the road on to the hostel town. Stop here and tap Drive to hostel. */
function RoadToHostel() {
  const [x, , z] = TOWN_LINK.campus.exit;
  return (
    <group name="road-to-hostel" position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3, 0.02, 0]} receiveShadow>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#2f3136" roughness={1} />
      </mesh>
      {[-2.6, 2.6].map((dz) => (
        <group key={dz} position={[-1, 0, dz + Math.sign(dz) * 1.2]}>
          <mesh position={[0, 2.6, 0]}><boxGeometry args={[0.6, 5.2, 0.6]} /><meshStandardMaterial color="#e9d9ae" /></mesh>
        </group>
      ))}
      <mesh position={[-1, 5.5, 0]}><boxGeometry args={[0.5, 1.2, 8]} /><meshStandardMaterial color="#1f6b45" /></mesh>
      {/* Faces campus (east): you read it as you drive west along the gate road. */}
      <group position={[-0.7, 5.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <CampusSign width={6.6} height={1} title="HOSTEL · TOWN" subtitle="ROAD TO THE HOSTEL" />
      </group>
    </group>
  );
}

export function CarWorld() {
  const onCampus = useHostelStore((s) => s.roomId === 'world:funaab:main');
  if (!onCampus) return null;
  return (<><FuelStation /><RoadToHostel /><ParkedCar /><CarRace /></>);
}
