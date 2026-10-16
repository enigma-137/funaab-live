import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CarBody } from './CarBody';
import { CampusSign } from '../world/CampusSign';
import { RACE, RACE_CORNERS, RACE_GATES, RACE_LENGTH, RIVALS, pointAlong, projectOnto } from '../../config/carRace';
import { rivalState, useRaceStore } from '../../stores/raceStore';
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

/** Rivals ease off for corners: the fastest they may go this far before the next one. */
function rivalLimit(dist: number, top: number) {
  const next = RACE_CORNERS.find((c) => c > dist - 3);
  if (next === undefined) return top;
  const gap = Math.max(0, next - dist);
  // v² = corner² + 2·brake·gap, with a gentle 6 m/s² brake.
  return Math.min(top, Math.sqrt(RACE.cornerSpeed ** 2 + 12 * gap));
}

/** Rival positions: on their lane down the straights, drifting to the centre line through corners. */
function rivalPose(i: number) {
  const d = rivalState[i].dist, p = pointAlong(RACE.track, d);
  const near = Math.min(...RACE_CORNERS.map((c) => Math.abs(c - d)), Infinity);
  const lane = RIVALS[i].lane * RACE.laneOffset * Math.min(1, near / 8);
  return { x: p.x - p.dz * lane, z: p.z + p.dx * lane, heading: Math.atan2(p.dx, p.dz) };
}

function RivalCar({ i }: { i: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const pose = rivalPose(i);
    g.position.set(pose.x, 0, pose.z);
    // Smooth the heading through the corner instead of snapping 90°.
    const diff = Math.atan2(Math.sin(pose.heading - g.rotation.y), Math.cos(pose.heading - g.rotation.y));
    g.rotation.y += diff * 0.2;
  });
  const start = rivalPose(i);
  return (
    <group ref={ref} position={[start.x, 0, start.z]} rotation={[0, start.heading, 0]}>
      <CarBody id={RIVALS[i].car} paint={RIVALS[i].paint} />
      <group position={[0, 2.6, 0]}><CampusSign width={1.6} height={0.42} title={RIVALS[i].name} tone="cream" /></group>
    </group>
  );
}

const STEP_MS = 1000 / 60;
const rivalClock = { ms: 0 };

/** Steps the rivals, counts your checkpoints, works out places and ends the race. */
function RaceRunner() {
  useFrame(() => {
    const race = useRaceStore.getState();
    if (race.status !== 'countdown' && race.status !== 'racing') return;
    if (!useCarStore.getState().driving) { race.quit('You got out of your car, so the race is off.'); return; }
    const now = performance.now();
    if (race.status === 'countdown') { rivalClock.ms = 0; if (now >= race.goAt) useRaceStore.setState({ status: 'racing' }); return; }
    // Rivals run on the race clock in fixed steps, so a slow phone doesn't slow them down (or speed them up).
    const elapsed = now - race.goAt;
    while (rivalClock.ms + STEP_MS <= elapsed) {
      rivalClock.ms += STEP_MS;
      RIVALS.forEach((r, i) => {
        const s = rivalState[i];
        if (s.finishMs !== null) return;
        s.speed = Math.min(rivalLimit(s.dist, r.topSpeed), s.speed + r.accel * STEP_MS / 1000);
        s.dist += s.speed * STEP_MS / 1000;
        if (s.dist >= RACE_LENGTH) { s.dist = RACE_LENGTH; s.finishMs = rivalClock.ms; }
      });
    }
    const [x, , z] = useGameStore.getState().myPosition;
    const me = projectOnto(RACE.track, x, z);
    if (me.off > RACE.offTrack) { race.quit('You left the race route, so the race is off.'); return; }
    let gate = race.gate;
    while (gate < RACE_GATES.length) {
      const g = pointAlong(RACE.track, RACE_GATES[gate]);
      // The finish counts once you're over the line; other gates when you pass close by.
      const passed = gate === RACE_GATES.length - 1 ? me.along >= RACE_LENGTH - 0.5 && me.off < RACE.gateRadius : Math.hypot(g.x - x, g.z - z) < RACE.gateRadius;
      if (!passed) break;
      gate++;
    }
    const ahead = rivalState.filter((s) => s.finishMs !== null || s.dist > me.along).length;
    if (gate >= RACE_GATES.length) { race.finish(Math.round(elapsed), 1 + rivalState.filter((s) => s.finishMs !== null).length); return; }
    if (gate !== race.gate || ahead + 1 !== race.place) useRaceStore.setState({ gate, place: ahead + 1 });
  });
  return null;
}

/** The race route's start and finish arches, plus the rivals while a race is on. */
export function CarRace() {
  const status = useRaceStore((s) => s.status);
  const arches = useMemo(() => (
    <>
      <Arch at={0} title="START" subtitle={RACE.name} />
      <Arch at={RACE_LENGTH} title="FINISH" subtitle="COLFHEC" />
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
