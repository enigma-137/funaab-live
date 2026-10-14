import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { VOLLEYBALL_COURT, receiverSpot, serveFlightPath, type VolleyballShot } from '../../config/volleyball';
import type { ShootoutState } from '../../config/shootout';
import { BASKETBALL_COURT, hoopFlightPath, isBasket, type BasketballShot, type Vec3 } from '../../config/basketball';
import { COURT_ZONES } from '../../config/campusWorld';
import { useBasketballStore, useVolleyballStore } from '../../stores/courtGameStore';
import { AvatarBody } from '../player/AvatarBody';
import { npcAppearance } from '../../config/npcAppearance';
import { VisualBuilder, campusMaterials } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';

// Courts beside the Sports Centre: a full basketball court (west hoop runs the free-throw
// challenge) and a volleyball court. Geometry is world-space and baked into material batches.
const BALL_R = 0.12;
const [CX, , CZ] = BASKETBALL_COURT.centre;
const HALF_L = BASKETBALL_COURT.length / 2;
const HALF_W = BASKETBALL_COURT.width / 2;
const LINE = 0.08;
const Y_COURT = 0.03;
const Y_LINE = 0.045;
const REST: Vec3 = [BASKETBALL_COURT.shooterSpot[0] - 0.5, BALL_R, BASKETBALL_COURT.shooterSpot[2] - 0.7];
const RESET_AFTER = 3.2;

/** Mirror an x across the half-court line: the east hoop copies the west (challenge) hoop. */
const atSide = (x: number, side: -1 | 1) => (side === -1 ? x : 2 * CX - x);
const EAST_RIM: Vec3 = [atSide(BASKETBALL_COURT.rim[0], 1), BASKETBALL_COURT.rim[1], CZ];

function outline(b: VisualBuilder, cx: number, cz: number, w: number, d: number, y: number) {
  b.box([cx, y, cz - d / 2], [w, 0.01, LINE], 'courtLine');
  b.box([cx, y, cz + d / 2], [w, 0.01, LINE], 'courtLine');
  b.box([cx - w / 2, y, cz], [LINE, 0.01, d], 'courtLine');
  b.box([cx + w / 2, y, cz], [LINE, 0.01, d], 'courtLine');
}

function buildCourts() {
  const b = new VisualBuilder();
  const a = COURT_ZONES.apron;
  // Paved courtside, then the playing surfaces on top.
  b.box([(a.minX + a.maxX) / 2, 0.01, (a.minZ + a.maxZ) / 2], [a.maxX - a.minX, 0.02, a.maxZ - a.minZ], 'paving');
  b.box([CX, Y_COURT, CZ], [BASKETBALL_COURT.length, 0.02, BASKETBALL_COURT.width], 'courtBlue');
  outline(b, CX, CZ, BASKETBALL_COURT.length, BASKETBALL_COURT.width, Y_LINE);
  b.box([CX, Y_LINE, CZ], [LINE, 0.01, BASKETBALL_COURT.width], 'courtLine'); // half-court line
  for (const side of [-1, 1] as const) {
    // Painted key: baseline to the free-throw line, 4.9 m wide.
    const keyLen = BASKETBALL_COURT.freeThrowX - BASKETBALL_COURT.baselineX;
    const kx = CX + side * (HALF_L - keyLen / 2);
    b.box([kx, Y_COURT + 0.006, CZ], [keyLen, 0.02, 4.9], 'courtKey');
    outline(b, kx, CZ, keyLen, 4.9, Y_LINE);
    // Hoop stanchion behind the baseline, arm out to the backboard.
    const postX = CX + side * (HALF_L + 0.7);
    const boardX = atSide(BASKETBALL_COURT.backboardX, side);
    b.pole([postX, 1.75, CZ], 0.11, 3.5, 'metal');
    b.box([(postX + boardX) / 2, 3.4, CZ], [Math.abs(postX - boardX), 0.12, 0.12], 'metal');
    b.box([boardX, 3.35, CZ], [0.06, 1.05, 1.8], 'courtLine');
    b.box([boardX - side * 0.035, 3.25, CZ], [0.01, 0.45, 0.59], 'hoopOrange');
    b.box([boardX - side * 0.04, 3.25, CZ], [0.012, 0.37, 0.51], 'courtLine');
    b.box([postX, 0.15, CZ], [1.2, 0.3, 1.2], 'concrete');
  }
  // Volleyball court: long axis along Z, net across the middle.
  const [vx, , vz] = VOLLEYBALL_COURT.centre;
  b.box([vx, Y_COURT, vz], [VOLLEYBALL_COURT.width, 0.02, VOLLEYBALL_COURT.length], 'courtGreen');
  outline(b, vx, vz, VOLLEYBALL_COURT.width, VOLLEYBALL_COURT.length, Y_LINE);
  b.box([vx, Y_LINE, vz], [VOLLEYBALL_COURT.width, 0.01, LINE], 'courtLine');
  for (const dz of [-3, 3]) b.box([vx, Y_LINE, vz + dz], [VOLLEYBALL_COURT.width, 0.01, LINE], 'courtLine'); // attack lines
  for (const side of [-1, 1]) b.pole([vx + side * (VOLLEYBALL_COURT.width / 2 + 0.5), 1.25, vz], 0.06, 2.5, 'metal');
  b.box([vx, 2.4, vz], [VOLLEYBALL_COURT.width + 1, 0.06, 0.03], 'courtLine'); // net tape
  // Courtside benches.
  for (const dx of [-6, 6]) {
    b.box([CX + dx, 0.45, CZ + HALF_W + 1.3], [2.6, 0.08, 0.45], 'wood');
    for (const lx of [-1.1, 1.1]) b.box([CX + dx + lx, 0.22, CZ + HALF_W + 1.3], [0.08, 0.44, 0.4], 'metal');
  }
  return b.finish();
}

function scoreLine(s: ShootoutState<string, { outcome: string }>, icon: string, match: string, verb: string) {
  const p1 = s.player1, p2 = s.player2;
  if (s.status === 'WAITING' && p1) return `${icon} @${p1.name} is waiting for a 1v1 ${match}`;
  if (!p1 || !p2) return null;
  const line = `${p1.name} ${s.score[p1.userId] ?? 0} – ${s.score[p2.userId] ?? 0} ${p2.name}`;
  if (s.status === 'ACTIVE') return `${icon} ${line} · ${s.turnUserId === p1.userId ? p1.name : p2.name} to ${verb}`;
  if (s.status === 'RESULT') return `🏁 Final: ${line}`;
  return null;
}

function Bubble({ text, at, tone }: { text: string | null; at: Vec3; tone: string }) {
  if (!text) return null;
  return (
    <Html position={at} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
      <div className={`px-3 py-1 rounded-xl bg-slate-950/90 border text-xs font-bold font-['Outfit'] shadow-xl whitespace-nowrap ${tone}`}>{text}</div>
    </Html>
  );
}

function ScoreBubble() {
  const text = useBasketballStore((b) => scoreLine(b.state, '🏀', 'shootout', 'shoot'));
  const [x, y, z] = BASKETBALL_COURT.rim;
  return <Bubble text={text} at={[x, y + 1.6, z]} tone="border-orange-400 text-orange-200" />;
}

function ServeBubble() {
  const text = useVolleyballStore((v) => scoreLine(v.state, '🏐', 'serve-off', 'serve'));
  const { centre, netZ } = VOLLEYBALL_COURT;
  return <Bubble text={text} at={[centre[0], 4, netZ]} tone="border-sky-400 text-sky-200" />;
}

const bezier = (a: Vec3, c: Vec3, e: Vec3, u: number): Vec3 => {
  const v = 1 - u;
  return [0, 1, 2].map((i) => v * v * a[i] + 2 * v * u * c[i] + u * u * e[i]) as Vec3;
};

type Flight = { shot: BasketballShot; start: number; path: ReturnType<typeof hoopFlightPath> };
const FLIGHT_T = 1.0;

/** The challenge ball: thrown along the server's verdict, then rolls back to the free-throw line. */
function ChallengeBall() {
  const ball = useRef<THREE.Mesh>(null);
  const net = useRef<THREE.Mesh>(null);
  const lastSeq = useRef(useBasketballStore.getState().state.lastShot?.seq ?? 0);
  const flight = useRef<Flight | null>(null);
  useFrame((_, delta) => {
    const shot = useBasketballStore.getState().state.lastShot;
    if (shot && shot.seq !== lastSeq.current) {
      lastSeq.current = shot.seq;
      flight.current = shot.reason === 'timeout' ? null : { shot, start: performance.now(), path: hoopFlightPath(shot) };
    }
    const b = ball.current;
    if (!b) return;
    const f = flight.current;
    const t = f ? (performance.now() - f.start) / 1000 : Infinity;
    if (net.current) net.current.scale.y = 1;
    if (!f || t > RESET_AFTER) {
      flight.current = null;
      b.position.set(...REST);
      return;
    }
    const { release, apex, cross, rest } = f.path;
    if (t <= FLIGHT_T) {
      // Arc: control point lifted so the apex height is actually reached.
      const ctrl: Vec3 = [apex[0], apex[1] * 2 - (release[1] + cross[1]) / 2, apex[2]];
      b.position.set(...bezier(release, ctrl, cross, t / FLIGHT_T));
    } else {
      const u = Math.min(1, (t - FLIGHT_T) / 1.2);
      const made = isBasket(f.shot.outcome);
      // A make drops through the net first; everything else kicks off the rim or board.
      const drop = made ? Math.min(1, u * 3) : 0;
      if (made && net.current && u < 0.35) net.current.scale.y = 1.25;
      const e = 1 - (1 - u) * (1 - u);
      const bounce = Math.abs(Math.sin(Math.PI * u * 3)) * 1.4 * (1 - u) * (1 - u);
      b.position.set(
        THREE.MathUtils.lerp(cross[0], rest[0], made ? Math.max(0, u - 0.25) / 0.75 : e),
        made && u < 0.33 ? cross[1] - drop * (cross[1] - BALL_R) : BALL_R + bounce,
        THREE.MathUtils.lerp(cross[2], rest[2], made ? Math.max(0, u - 0.25) / 0.75 : e),
      );
    }
    b.rotation.z += delta * 9;
  });
  const [rx, ry, rz] = BASKETBALL_COURT.rim;
  return (
    <>
      <mesh ref={ball} name="sports_basketball" position={REST} castShadow>
        <icosahedronGeometry args={[BALL_R, 1]} />
        <meshStandardMaterial color="#d9622b" roughness={0.75} flatShading />
      </mesh>
      <mesh ref={net} position={[rx, ry - 0.22, rz]}>
        <cylinderGeometry args={[0.23, 0.15, 0.42, 10, 2, true]} />
        <meshStandardMaterial color="#f8fafc" wireframe transparent opacity={0.7} />
      </mesh>
    </>
  );
}

// The receiver wears a club bib; they guess a side (decided on the server) and dive for the dig.
const RECEIVER_LOOK = npcAppearance('sports-receiver', {
  bodyType: 'feminine', hairstyle: 'braids', topStyle: 't-shirt', topColor: '#0ea5e9',
  bottomStyle: 'joggers', bottomColor: '#1e293b', shoeStyle: 'sneakers', shoeColor: '#f8fafc',
});
const VB_R = 0.11;
const VB_REST: Vec3 = [VOLLEYBALL_COURT.serveSpot[0] + 0.6, VB_R, VOLLEYBALL_COURT.serveSpot[2] - 0.5];
const SERVE_T = 1.05;

/** Serve ball + NPC receiver, animated from the server's verdict. */
function ServeBall() {
  const ball = useRef<THREE.Mesh>(null);
  const receiver = useRef<THREE.Group>(null);
  const lastSeq = useRef(useVolleyballStore.getState().state.lastShot?.seq ?? 0);
  const flight = useRef<{ shot: VolleyballShot; start: number; path: ReturnType<typeof serveFlightPath> } | null>(null);
  useFrame((_, delta) => {
    const shot = useVolleyballStore.getState().state.lastShot;
    if (shot && shot.seq !== lastSeq.current) {
      lastSeq.current = shot.seq;
      flight.current = shot.reason === 'timeout' ? null : { shot, start: performance.now(), path: serveFlightPath(shot) };
    }
    const b = ball.current, r = receiver.current;
    if (!b || !r) return;
    const f = flight.current;
    const t = f ? (performance.now() - f.start) / 1000 : Infinity;
    const home = VOLLEYBALL_COURT.receiverHome;
    if (!f || t > RESET_AFTER) {
      flight.current = null;
      b.position.set(...VB_REST);
      r.position.set(...home);
      r.rotation.set(0, 0, 0);
      return;
    }
    const { contact, apex, land, rest } = f.path;
    if (t <= SERVE_T) {
      const ctrl: Vec3 = [apex[0], apex[1] * 2 - (contact[1] + land[1]) / 2, apex[2]];
      b.position.set(...bezier(contact, ctrl, land, t / SERVE_T));
    } else {
      const u = Math.min(1, (t - SERVE_T) / 1.1);
      const e = 1 - (1 - u) * (1 - u);
      // A dig pops the ball high; anything else bounces along the floor.
      const lift = f.shot.outcome === 'DUG' ? Math.sin(Math.PI * u) * 3 : Math.abs(Math.sin(Math.PI * u * 2)) * 0.9 * (1 - u);
      b.position.set(THREE.MathUtils.lerp(land[0], rest[0], e), VB_R + lift, THREE.MathUtils.lerp(land[2], rest[2], e));
    }
    b.rotation.x -= delta * 10;
    // Receiver commits just after the serve and dives to their guessed side.
    const to = receiverSpot(f.shot.receiverDive);
    const d = Math.min(1, Math.max(0, (t - 0.25) / 0.7));
    const k = 1 - (1 - d) * (1 - d);
    r.position.set(THREE.MathUtils.lerp(home[0], to[0], k), 0, home[2]);
    // Faces the server (+Z); a sideways dive tips the body toward the dive side.
    r.rotation.set(0, 0, -f.shot.receiverDive * 0.6 * k);
  });
  return (
    <>
      <mesh ref={ball} name="sports_volleyball" position={VB_REST} castShadow>
        <icosahedronGeometry args={[VB_R, 1]} />
        <meshStandardMaterial color="#f8f3d6" roughness={0.6} flatShading />
      </mesh>
      <group ref={receiver} position={VOLLEYBALL_COURT.receiverHome}>
        <AvatarBody identity="sports-receiver" config={RECEIVER_LOOK} animation="idle" />
      </group>
    </>
  );
}

export function SportsCourts() {
  const batches = useMemo(buildCourts, []);
  useEffect(() => () => batches.forEach((b) => b.geometry.dispose()), [batches]);
  const east = EAST_RIM;
  const [vx, , vz] = VOLLEYBALL_COURT.centre;
  return (
    <group name="campus_sports_courts">
      <StaticBatches batches={batches} />
      {/* Rims (torus) and the east net; the west net animates with the challenge ball. */}
      {[BASKETBALL_COURT.rim, east].map((r, i) => (
        <mesh key={i} position={r} rotation={[Math.PI / 2, 0, 0]} material={campusMaterials.hoopOrange}>
          <torusGeometry args={[0.23, 0.018, 6, 20]} />
        </mesh>
      ))}
      <mesh position={[east[0], east[1] - 0.22, east[2]]}>
        <cylinderGeometry args={[0.23, 0.15, 0.42, 10, 2, true]} />
        <meshStandardMaterial color="#f8fafc" wireframe transparent opacity={0.7} />
      </mesh>
      {/* Volleyball net mesh. */}
      <mesh position={[vx, 1.95, vz]}>
        <planeGeometry args={[VOLLEYBALL_COURT.width + 1, 0.9, 24, 3]} />
        <meshStandardMaterial color="#e2e8f0" wireframe transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        {([-1, 1] as const).map((side) => (
          <CylinderCollider key={side} args={[1.75, 0.2]} position={[CX + side * (HALF_L + 0.7), 1.75, CZ]} />
        ))}
        {[-1, 1].map((side) => (
          <CylinderCollider key={`v${side}`} args={[1.25, 0.1]} position={[vx + side * (VOLLEYBALL_COURT.width / 2 + 0.5), 1.25, vz]} />
        ))}
        {/* Benches */}
        {[-6, 6].map((dx) => (
          <CuboidCollider key={`b${dx}`} args={[1.3, 0.25, 0.22]} position={[CX + dx, 0.25, CZ + HALF_W + 1.3]} />
        ))}
      </RigidBody>
      <ChallengeBall />
      <ScoreBubble />
      <ServeBall />
      <ServeBubble />
      <group position={[BASKETBALL_COURT.freeThrowX + 3.2, 0, CZ + HALF_W + 1.4]} rotation={[0, -0.35, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 1.05, 0.9, 0]} material={campusMaterials.metal}>
            <cylinderGeometry args={[0.05, 0.06, 1.8, 6]} />
          </mesh>
        ))}
        <CampusSign position={[0, 1.75, 0]} width={2.4} height={0.8} title="BASKETBALL COURT" subtitle="FREE-THROW CHALLENGE" />
      </group>
      <group position={[VOLLEYBALL_COURT.centre[0] + 5.2, 0, VOLLEYBALL_COURT.centre[2] + 5.5]} rotation={[0, -0.7, 0]}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 1.05, 0.9, 0]} material={campusMaterials.metal}>
            <cylinderGeometry args={[0.05, 0.06, 1.8, 6]} />
          </mesh>
        ))}
        <CampusSign position={[0, 1.75, 0]} width={2.4} height={0.8} title="VOLLEYBALL COURT" subtitle="SERVE CHALLENGE" />
      </group>
    </group>
  );
}
