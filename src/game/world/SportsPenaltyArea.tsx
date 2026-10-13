import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { FOOTBALL_PITCH, shotFlightPath, type FootballMatchState, type FootballShot, type Vec3 } from '../../config/football';
import { useFootballStore } from '../../stores/footballStore';
import { CampusSign } from './CampusSign';

// Stable asset keys: Blender models can later replace these procedural meshes one-for-one.
export const SPORTS_ASSET_KEYS = { football: 'sports_football', goalpost: 'sports_goalpost', fieldProps: 'sports_field_props' } as const;

const BALL_R = 0.16;
const SPOT: Vec3 = [FOOTBALL_PITCH.penaltySpot[0], BALL_R, FOOTBALL_PITCH.penaltySpot[2]];
const KEEPER_HOME: Vec3 = [FOOTBALL_PITCH.centre[0], 0, FOOTBALL_PITCH.goalLineZ + 0.35];
const RESET_AFTER = 3.0; // seconds: ball and keeper return to their marks
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

type Flight = { shot: FootballShot; start: number; flightT: number; cross: Vec3; rest: Vec3 };

function scoreLine(s: FootballMatchState) {
  const p1 = s.player1, p2 = s.player2;
  if (s.status === 'WAITING' && p1) return `⚽ @${p1.name} is waiting for a 1v1 challenger`;
  if (!p1 || !p2) return null;
  const line = `${p1.name} ${s.score[p1.userId] ?? 0} – ${s.score[p2.userId] ?? 0} ${p2.name}`;
  if (s.status === 'ACTIVE') return `⚽ ${line} · ${s.turnUserId === p1.userId ? p1.name : p2.name} to shoot`;
  if (s.status === 'RESULT') return `🏁 FT: ${line}`;
  return null;
}

function ScoreBubble() {
  const text = useFootballStore((f) => scoreLine(f.state));
  if (!text) return null;
  return (
    <Html position={[FOOTBALL_PITCH.centre[0], 3.7, FOOTBALL_PITCH.goalLineZ]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
      <div className="px-3 py-1 rounded-xl bg-slate-950/90 border border-amber-400 text-amber-200 text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap">
        {text}
      </div>
    </Html>
  );
}

export function SportsPenaltyArea() {
  const ball = useRef<THREE.Mesh>(null);
  const keeper = useRef<THREE.Group>(null);
  // Don't replay whatever shot was already on the server when we arrived.
  const lastSeq = useRef(useFootballStore.getState().state.lastShot?.seq ?? 0);
  const flight = useRef<Flight | null>(null);

  useFrame((_, delta) => {
    const shot = useFootballStore.getState().state.lastShot;
    if (shot && shot.seq !== lastSeq.current) {
      lastSeq.current = shot.seq;
      const { cross, rest } = shotFlightPath(shot);
      flight.current = shot.reason === 'timeout' ? null : { shot, start: performance.now(), flightT: 0.95 - shot.power * 0.45, cross, rest };
    }
    const b = ball.current, k = keeper.current;
    if (!b || !k) return;
    const f = flight.current;
    const t = f ? (performance.now() - f.start) / 1000 : Infinity;
    if (!f || t > RESET_AFTER) {
      flight.current = null;
      b.position.set(...SPOT);
      k.position.set(...KEEPER_HOME);
      k.rotation.set(0, 0, 0);
      return;
    }
    if (t <= f.flightT) {
      // Strike: straight-line travel with a gentle arc up to where it meets the goal plane.
      const u = t / f.flightT;
      b.position.set(
        THREE.MathUtils.lerp(SPOT[0], f.cross[0], u),
        THREE.MathUtils.lerp(SPOT[1], Math.max(BALL_R, f.cross[1]), u) + Math.sin(Math.PI * u) * 0.35,
        THREE.MathUtils.lerp(SPOT[2], f.cross[2], u),
      );
    } else {
      // Settle: ease to the rest point with two decaying bounces, then stop on the turf.
      const u = Math.min(1, (t - f.flightT) / 0.9);
      const e = easeOut(u);
      const bounce = Math.abs(Math.sin(Math.PI * u * 2)) * Math.max(0.2, f.cross[1]) * (1 - u) * (1 - u);
      b.position.set(
        THREE.MathUtils.lerp(f.cross[0], f.rest[0], e),
        BALL_R + bounce,
        THREE.MathUtils.lerp(f.cross[2], f.rest[2], e),
      );
    }
    b.rotation.x -= delta * (t <= f.flightT + 0.9 ? 14 : 0);
    // Keeper: commits just after the strike, sliding and tipping toward the dive side.
    const d = easeOut(Math.min(1, Math.max(0, (t - 0.1) / Math.max(0.3, f.flightT - 0.1))));
    const dive = f.shot.keeperDive;
    k.position.set(KEEPER_HOME[0] + dive * 1.5 * d, dive ? -0.25 * d : 0, KEEPER_HOME[2]);
    k.rotation.set(0, 0, -dive * 1.15 * d);
  });

  const cx = FOOTBALL_PITCH.centre[0], gz = FOOTBALL_PITCH.goalLineZ;
  return (
    <group name={SPORTS_ASSET_KEYS.fieldProps}>
      {/* Penalty spot + a light penalty-box outline in front of the north goal. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SPOT[0], 0.03, SPOT[2]]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {([[0, 6.5, 12, 0.12], [-6, 3.25, 0.12, 6.5], [6, 3.25, 0.12, 6.5]] as const).map(([x, dz, w, d], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[cx + x, 0.029, gz + dz]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      <mesh ref={ball} name={SPORTS_ASSET_KEYS.football} position={SPOT} castShadow>
        <icosahedronGeometry args={[BALL_R, 1]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} flatShading />
      </mesh>

      {/* NPC keeper: randomised dive decided on the server, never player-controlled. */}
      <group ref={keeper} position={KEEPER_HOME}>
        <mesh position={[0, 0.42, 0]}><boxGeometry args={[0.42, 0.8, 0.26]} /><meshStandardMaterial color="#1e293b" /></mesh>
        <mesh position={[0, 1.1, 0]} castShadow><boxGeometry args={[0.52, 0.6, 0.3]} /><meshStandardMaterial color="#f97316" /></mesh>
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[1.25, 0.14, 0.16]} /><meshStandardMaterial color="#f97316" /></mesh>
        <mesh position={[0, 1.6, 0]}><sphereGeometry args={[0.17, 10, 8]} /><meshStandardMaterial color="#8d5524" /></mesh>
      </group>

      {/* Sign facing the approach from the Sports Centre entrance. */}
      <group name="sports_penalty_sign" position={[cx + 5.2, 0, gz + 7.6]} rotation={[0, Math.PI / 4, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 1.05, 0.9, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 1.8, 6]} />
            <meshStandardMaterial color="#53615c" />
          </mesh>
        ))}
        <CampusSign position={[0, 1.75, 0]} width={2.4} height={0.8} title="SPORTS CENTRE" subtitle="PENALTY CHALLENGE" />
      </group>

      <ScoreBubble />
    </group>
  );
}
