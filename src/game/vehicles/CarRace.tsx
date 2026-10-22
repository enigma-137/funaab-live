import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CarBody } from './CarBody';
import { CampusSign } from '../world/CampusSign';
import { RACE, RACE_CORNERS, RIVALS, RIVAL_FINISH_MS, finishPlace, pointAlong, projectOnto, rivalProgress, stepRace } from '../../config/carRace';
import { locationById } from '../../config/campusLocations';
import { useRaceStore } from '../../stores/raceStore';
import { useCarStore } from '../../stores/carStore';
import { useGameStore } from '../../stores/gameStore';

const checker = (() => {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111111' : '#f8fafc'; g.fillRect(x * 8, y * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
})();
const post = new THREE.MeshStandardMaterial({ color: '#e5e7eb' });

/** An arch over the road with a chequered banner and a sign: the start grid or the finish line. */
function Arch({ at, title, subtitle }: { at: number; title: string; subtitle: string }) {
  const s = pointAlong(RACE.track, at), heading = Math.atan2(s.dx, s.dz);
  return (
    <group position={[s.x, 0, s.z]} rotation={[0, heading, 0]}>
      {[-1, 1].map((x) => <mesh key={x} position={[x * 5.4, 2.6, 0]} material={post}><boxGeometry args={[0.3, 5.2, 0.3]} /></mesh>)}
      <mesh position={[0, 5.0, 0]} material={checker}><boxGeometry args={[11, 0.7, 0.12]} /></mesh>
      {/* Chequered line painted across the road. */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} material={checker}><planeGeometry args={[8.4, 1.1]} /></mesh>
      <group position={[0, 6.0, 0]} rotation={[0, Math.PI, 0]}><CampusSign width={4.4} height={1.1} title={title} subtitle={subtitle} /></group>
      <group position={[0, 6.0, 0]}><CampusSign width={4.4} height={1.1} title={title} subtitle={subtitle} /></group>
    </group>
  );
}

/** Rival positions: on their lane down the straights, drifting to the centre line through corners. */
function rivalPose(i: number, ms: number) {
  const d = rivalProgress(i, ms), p = pointAlong(RACE.track, d);
  const near = Math.min(...RACE_CORNERS.map((c) => Math.abs(c - d)), Infinity);
  const lane = RIVALS[i].lane * RACE.laneOffset * Math.min(1, near / 8);
  return { x: p.x - p.dz * lane, z: p.z + p.dx * lane, heading: Math.atan2(p.dx, p.dz) };
}

/** Race time now: 0 until the lights go green, frozen at your finish. */
function raceMs() {
  const r = useRaceStore.getState();
  if (r.status === 'finished' && r.finishMs !== null) return r.finishMs;
  return Math.max(0, performance.now() - r.goAt);
}

function RivalCar({ i }: { i: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const pose = rivalPose(i, raceMs());
    g.position.set(pose.x, 0, pose.z);
    // Smooth the heading through the corner instead of snapping 90°.
    const diff = Math.atan2(Math.sin(pose.heading - g.rotation.y), Math.cos(pose.heading - g.rotation.y));
    g.rotation.y += diff * 0.2;
  });
  const start = rivalPose(i, 0);
  return (
    <group ref={ref} position={[start.x, 0, start.z]} rotation={[0, start.heading, 0]}>
      <CarBody id={RIVALS[i].car} paint={RIVALS[i].paint} />
      <group position={[0, 2.6, 0]}><CampusSign width={1.6} height={0.42} title={RIVALS[i].name} tone="cream" /></group>
    </group>
  );
}

/** Where you were last frame, so a whole move counts towards the checkpoints. */
const lastPos = { x: 0, z: 0, set: false };

/** Follows you round the lap (checkpoints, place, leaving the route) and ends the race on screen. */
function RaceRunner() {
  useFrame(() => {
    const race = useRaceStore.getState();
    if (race.status !== 'countdown' && race.status !== 'racing') return;
    if (!useCarStore.getState().driving) { race.quit('You got out of your car, so the race is off.'); return; }
    const now = performance.now();
    if (race.status === 'countdown') { lastPos.set = false; if (now >= race.goAt) useRaceStore.setState({ status: 'racing' }); return; }
    const elapsed = now - race.goAt;
    const [x, , z] = useGameStore.getState().myPosition;
    const fromX = lastPos.set ? lastPos.x : x, fromZ = lastPos.set ? lastPos.z : z;
    Object.assign(lastPos, { x, z, set: true });
    const step = stepRace(race.gate, fromX, fromZ, x, z);
    if (step.finished) { race.finish(Math.round(elapsed), finishPlace(elapsed)); return; }
    if (step.off) { race.quit('You left the race route, so the race is off.'); return; }
    const ahead = RIVALS.filter((_, i) => RIVAL_FINISH_MS[i] <= elapsed || rivalProgress(i, elapsed) > step.along).length;
    if (step.gate !== race.gate || ahead + 1 !== race.place) useRaceStore.setState({ gate: step.gate, place: ahead + 1 });
  });
  return null;
}

/** A roadside board where the lap passes a landmark, so you know you're on the route. */
function RouteBoard({ id, n }: { id: string; n: number }) {
  const stop = locationById(id).kekeStop, p = projectOnto(RACE.track, stop[0], stop[2]), s = pointAlong(RACE.track, p.along);
  // On the right-hand verge, facing oncoming racers.
  const side = 5.6, x = s.x - s.dz * side, z = s.z + s.dx * side;
  return (
    <group position={[x, 0, z]} rotation={[0, Math.atan2(s.dx, s.dz) + Math.PI, 0]}>
      <mesh position={[0, 1.2, 0]} material={post}><boxGeometry args={[0.15, 2.4, 0.15]} /></mesh>
      <group position={[0, 2.7, 0]}><CampusSign width={2.6} height={0.8} title={`${n} · ${locationById(id).shortName.toUpperCase()}`} subtitle={RACE.name} /></group>
    </group>
  );
}

/** The race route's start/finish arch and landmark boards, plus the rivals while a race is on. */
export function CarRace() {
  const status = useRaceStore((s) => s.status);
  const arches = useMemo(() => (
    <>
      <Arch at={0} title="START · FINISH" subtitle={RACE.name} />
      {RACE.landmarks.map((id, i) => <RouteBoard key={id} id={id} n={i + 1} />)}
    </>
  ), []);
  return (
    <group name="car-race">
      {arches}
      {status !== 'idle' && RIVALS.map((_, i) => <RivalCar key={i} i={i} />)}
      <RaceRunner />
    </group>
  );
}
