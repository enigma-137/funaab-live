import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InnerShell } from './InnerShell';
import { QUALITY } from '../../config/quality';
import { useGraphicsStore } from '../../stores/graphicsStore';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { ARCADE_TABLES, BAR, DANCE_FLOOR, DJ_BOOTH, PARTY_HALL, POOL_TABLE_SCALE, TICKET_BARRIER, inPartyHall, partyNight, partyOpen } from '../../config/partyHall';
import { POOL, simulateShot, type Ball } from '../../config/pool';
import { npcAppearance } from '../../config/npcAppearance';
import { useGameStore } from '../../stores/gameStore';
import { usePartyStore } from '../../stores/partyStore';
import { engine } from '../audio/gameAudio';
import { AvatarBody } from '../player/AvatarBody';
import { VisualBuilder, type Batch, type V3 } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';

const [CX, , CZ] = PARTY_HALL.centre;
const [W, D] = PARTY_HALL.size;
const H = PARTY_HALL.wallHeight;
const DOOR = PARTY_HALL.doorHalfWidth;
const T = 0.3; // wall thickness
const L = (p: readonly number[]): V3 => [p[0] - CX, 0, p[2] - CZ];
const tables = Object.fromEntries(ARCADE_TABLES.map((t) => [t.id, L(t.at)]));
const BALL_COLOR: Record<Ball['kind'], string> = { cue: '#f8fafc', red: '#dc2626', yellow: '#facc15', black: '#111827' };

/** Walls with the door gap in the west wall (drawn cut away while you're inside). Hall-local. */
export function buildPartyHallWalls(): Batch[] {
  const b = new VisualBuilder();
  b.box([W / 2, H / 2, 0], [T, H, D], 'arenaWall');
  b.box([0, H / 2, -D / 2], [W, H, T], 'arenaWall');
  b.box([0, H / 2, D / 2], [W, H, T], 'arenaWall');
  const side = (D / 2 - DOOR) / 2;
  for (const s of [-1, 1]) b.box([-W / 2, H / 2, s * (DOOR + side)], [T, H, side * 2], 'arenaWall');
  b.box([-W / 2, H - 0.6, 0], [T, 1.2, DOOR * 2], 'arenaWall'); // lintel
  return b.finish();
}

/** Floor, bar, DJ booth, speakers and game tables. Hall-local. */
export function buildPartyHall(): Batch[] {
  const b = new VisualBuilder();
  b.box([0, 0.02, 0], [W, 0.04, D], 'arenaFloor');
  // Bar: counter, top and back shelf with bottles.
  const [bx, , bz] = L(BAR.centre);
  b.box([bx, 0.55, bz], [BAR.length, 1.1, 0.7], 'wood');
  b.box([bx, 1.13, bz], [BAR.length + 0.2, 0.06, 0.85], 'roofDark');
  b.box([bx, 1.6, -D / 2 + 0.35], [BAR.length, 0.08, 0.4], 'wood');
  for (let i = 0; i < 14; i++) b.add(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 6), (['tomato', 'maize', 'leafLight', 'glass'] as const)[i % 4], [bx - BAR.length / 2 + 0.4 + i * 0.47, 1.8, -D / 2 + 0.35]);
  // DJ booth and speaker stacks.
  const [dx, , dz] = L(DJ_BOOTH);
  b.box([dx, 0.55, dz], [1.2, 1.1, 3.2], 'tankBlack');
  b.box([dx - 0.1, 1.14, dz], [0.7, 0.08, 2.4], 'metal');
  for (const s of [-1, 1]) {
    b.box([dx + 0.5, 1.1, dz + s * 2.6], [0.9, 2.2, 0.9], 'tankBlack');
    for (const y of [0.6, 1.5]) b.add(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 16), 'metal', [dx + 0.04, y, dz + s * 2.6], [1, 1, 1], [0, 0, Math.PI / 2]);
  }
  // Tic-tac-toe tables (the board is drawn live on top) with two stools each.
  for (const t of ARCADE_TABLES.filter((t) => t.game === 'ttt')) {
    const [x, , z] = tables[t.id];
    b.box([x, 0.72, z], [1.1, 0.06, 1.1], 'wood');
    b.pole([x, 0.36, z], 0.08, 0.72, 'metal');
    for (const s of [-1, 1]) { b.pole([x + s * 1.05, 0.25, z], 0.18, 0.5, 'tankBlack'); }
  }
  // Pool table: wooden frame, legs and felt, scaled up from the 2 m × 1 m simulation cloth.
  const [px, , pz] = tables.pool;
  const S = POOL_TABLE_SCALE, cw = POOL.HALF_X * 2 * S, cd = POOL.HALF_Z * 2 * S;
  b.box([px, 0.78, pz], [cw + 0.3, 0.14, cd + 0.3], 'wood');
  b.box([px, 0.86, pz], [cw, 0.02, cd], 'felt');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box([px + sx * (cw / 2 - 0.05), 0.36, pz + sz * (cd / 2 - 0.05)], [0.16, 0.72, 0.16], 'wood');
  return b.finish();
}

/** Floor tiles that pulse in colour with the beat while the party is on. */
function DanceFloor({ live }: { live: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = 8, size = (DANCE_FLOOR.half * 2) / n;
  const color = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < n * n; i++) {
      o.position.set((i % n - n / 2 + 0.5) * size, 0.05, (Math.floor(i / n) - n / 2 + 0.5) * size);
      o.scale.set(size * 0.94, 1, size * 0.94);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, color.set('#2a2440'));
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [color, size]);
  useFrame(({ clock }) => {
    const m = ref.current; if (!m || !live) return;
    const beat = Math.floor(clock.elapsedTime * 1.87);
    for (let i = 0; i < n * n; i++) {
      const on = (i * 7 + beat * 3 + Math.floor(i / n)) % 5 < 2;
      m.setColorAt(i, on ? color.setHSL(((i * 13 + beat * 40) % 360) / 360, 0.85, 0.55) : color.set('#1c1730'));
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  const [x, , z] = L(DANCE_FLOOR.centre);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n * n]} position={[x, 0, z]}>
      <boxGeometry args={[1, 0.04, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Sweeping coloured beams, a disco ball and a couple of real lights. */
function PartyLights() {
  const beams = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const [x, , z] = L(DANCE_FLOOR.centre);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (beams.current) beams.current.children.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.6; c.rotation.x = Math.cos(t * 0.7 + i) * 0.5; });
    if (light.current) light.current.color.setHSL((t * 0.12) % 1, 0.9, 0.55);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, H - 0.8, 0]}>
        <icosahedronGeometry args={[0.45, 1]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.15} emissive="#a78bfa" emissiveIntensity={0.4} flatShading />
      </mesh>
      <group ref={beams}>
        {['#f472b6', '#22d3ee', '#a3e635', '#facc15'].map((c, i) => (
          <group key={c} position={[(i % 2 ? 1 : -1) * 3.5, H - 0.3, (i < 2 ? -1 : 1) * 3.5]}>
            <mesh position={[0, -2.2, 0]}>
              <coneGeometry args={[0.9, 4.4, 16, 1, true]} />
              <meshBasicMaterial color={c} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
      {QUALITY[useGraphicsStore.getState().tier].nightLights > 1 && <pointLight ref={light} position={[0, H - 1.5, 0]} intensity={14} distance={16} decay={1.6} />}
    </group>
  );
}

function TicTacToeBoard({ id }: { id: string }) {
  const s = usePartyStore((st) => st.ttt[id]);
  const [x, , z] = tables[id];
  return (
    <group position={[x, 0.76, z]}>
      {[-1, 1].flatMap((k) => [
        <mesh key={`v${k}`} position={[k * 0.15, 0.005, 0]}><boxGeometry args={[0.02, 0.01, 0.9]} /><meshBasicMaterial color="#e2e8f0" /></mesh>,
        <mesh key={`h${k}`} position={[0, 0.005, k * 0.15]}><boxGeometry args={[0.9, 0.01, 0.02]} /><meshBasicMaterial color="#e2e8f0" /></mesh>,
      ])}
      {s?.board.map((c, i) => c && (
        <mesh key={i} position={[((i % 3) - 1) * 0.3, 0.03, (Math.floor(i / 3) - 1) * 0.3]}>
          {c === 'X' ? <boxGeometry args={[0.18, 0.04, 0.18]} /> : <torusGeometry args={[0.08, 0.025, 6, 16]} />}
          <meshStandardMaterial color={c === 'X' ? '#ef4444' : '#38bdf8'} emissive={c === 'X' ? '#ef4444' : '#38bdf8'} emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Balls on the real table: the last shot replays (deterministically) when it arrives. */
function PoolBalls() {
  const pool = usePartyStore((s) => s.pool);
  const shotAt = usePartyStore((s) => s.shotAt);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const replay = useMemo(() => (pool.lastShot ? simulateShot(pool.lastShot.start, pool.lastShot.dx, pool.lastShot.dz, pool.lastShot.power).frames : null), [pool.lastShot]);
  const [px, , pz] = tables.pool;
  const S = POOL_TABLE_SCALE;
  useFrame(() => {
    const k = replay ? Math.floor(((Date.now() - shotAt) / 1000) * 30) : Infinity;
    const playing = !!replay && k < replay.length - 1 && !!pool.lastShot;
    const list = playing ? pool.lastShot!.start : pool.balls;
    list.forEach((b, i) => {
      const m = refs.current[b.id]; if (!m) return;
      let x = b.x, z = b.z, hidden = b.potted;
      if (playing) {
        const f = replay![k], last = replay![replay!.length - 1];
        x = f[i * 2]; z = f[i * 2 + 1];
        hidden = b.potted || (pool.lastShot!.potted.includes(b.id) && x === last[i * 2] && z === last[i * 2 + 1]);
      }
      m.visible = !hidden;
      m.position.set(px + x * S, 0.87 + POOL.R * S, pz + z * S);
    });
  });
  return (
    <group>
      {pool.balls.map((b) => (
        <mesh key={b.id} ref={(el) => { refs.current[b.id] = el; }}>
          <sphereGeometry args={[POOL.R * S, 12, 10]} />
          <meshStandardMaterial color={BALL_COLOR[b.kind]} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

const STAFF = {
  bartender: npcAppearance('arena-bartender', { topStyle: 'polo', topColor: '#111827', bottomStyle: 'trousers', bottomColor: '#111827' }),
  dj: npcAppearance('arena-dj', { bodyType: 'masculine', topStyle: 'hoodie', topColor: '#7c3aed', hairstyle: 'locs' }),
};
const DANCERS = [[-2, -1.5, 0.4], [1.5, 2, -2.2], [2.5, -2.4, 2.8], [-1.2, 2.6, 1.2]].map(([x, z, yaw], i) => ({
  id: `arena-dancer-${i}`, at: [DANCE_FLOOR.centre[0] - CX + x, 0, DANCE_FLOOR.centre[2] - CZ + z] as V3, yaw,
  look: npcAppearance(`arena-dancer-${i}`),
}));

export function PartyHall() {
  const batches = useMemo(buildPartyHall, []);
  const walls = useMemo(buildPartyHallWalls, []);
  const [open, setOpen] = useState(() => partyOpen(Date.now()));
  const [inside, setInside] = useState(false);
  const ticket = usePartyStore((s) => s.ticketNight);
  const hasTicket = ticket === partyNight(Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      setOpen(partyOpen(Date.now()));
      const p = useGameStore.getState().myPosition;
      setInside(inPartyHall(p));
    }, 500);
    return () => clearInterval(t);
  }, []);
  // The groove plays only while you're inside during the party.
  useEffect(() => { engine.setParty(open && inside); return () => engine.setParty(false); }, [open, inside]);
  const barrierClosed = !open || !hasTicket;
  const [bx, , bz] = L(BAR.centre);
  const [dx, , dz] = L(DJ_BOOTH);
  const side = (D / 2 - DOOR) / 2;
  return (
    <group position={[CX, 0, CZ]} name="party_hall">
      <StaticBatches batches={batches} />
      {/* Roof only when you're outside, so the camera can see in. */}
      {/* Inside, the hall's own walls and ceiling close in around you; from outside the camera sees
          through the wall between it and you. Outside, the solid walls and roof show. */}
      {inside && (
        <InnerShell rect={{ minX: -W / 2 + T / 2, maxX: W / 2 - T / 2, minZ: -D / 2 + T / 2, maxZ: D / 2 - T / 2 }} height={H}
          wall="#3b2860" ceiling="#1d1230" dado={{ color: "#5b3394", height: 1.1 }}
          neon={[{ color: "#e879f9", y: H - 0.5 }, { color: "#22d3ee", y: 1.25 }]}
          openings={[{ side: "west", centre: 0, half: DOOR, top: H - 1.2 }]} />
      )}
      {!inside && (
        <>
          <StaticBatches batches={walls} />
          <mesh position={[0, H + 0.1, 0]}><boxGeometry args={[W + 0.6, 0.2, D + 0.6]} /><meshStandardMaterial color="#1e1530" /></mesh>
          <mesh position={[-W / 2 - 0.17, H - 0.15, 0]}><boxGeometry args={[0.06, 0.12, D]} /><meshBasicMaterial color={open ? '#c084fc' : '#4c3a63'} /></mesh>
          <group position={[-W / 2 - 0.2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <CampusSign position={[0, H - 1.6, 0]} width={6} height={1.4} title="THE ARENA" subtitle={open ? 'Party & arcade · ₦500' : 'Opens 7 PM'} />
          </group>
        </>
      )}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[W / 2, H / 2, 0]} args={[T / 2, H / 2, D / 2]} />
        <CuboidCollider position={[0, H / 2, -D / 2]} args={[W / 2, H / 2, T / 2]} />
        <CuboidCollider position={[0, H / 2, D / 2]} args={[W / 2, H / 2, T / 2]} />
        {[-1, 1].map((s) => <CuboidCollider key={s} position={[-W / 2, H / 2, s * (DOOR + side)]} args={[T / 2, H / 2, side]} />)}
        <CuboidCollider position={[bx, 0.55, bz]} args={[BAR.length / 2, 0.55, 0.35]} />
        <CuboidCollider position={[dx, 0.55, dz]} args={[0.6, 0.55, 1.6]} />
        {ARCADE_TABLES.map((t) => {
          const [x, , z] = tables[t.id];
          return t.game === 'pool'
            ? <CuboidCollider key={t.id} position={[x, 0.45, z]} args={[POOL.HALF_X * POOL_TABLE_SCALE + 0.15, 0.45, POOL.HALF_Z * POOL_TABLE_SCALE + 0.15]} />
            : <CuboidCollider key={t.id} position={[x, 0.4, z]} args={[0.55, 0.4, 0.55]} />;
        })}
      </RigidBody>
      {/* Ticket barrier just inside the door: red and closed without tonight's ticket. */}
      <group position={[TICKET_BARRIER.x, 0, 0]}>
        {[-1, 1].map((s) => <mesh key={s} position={[0, 0.5, s * TICKET_BARRIER.halfWidth]}><cylinderGeometry args={[0.06, 0.06, 1, 8]} /><meshStandardMaterial color="#d4d4d8" metalness={0.6} roughness={0.3} /></mesh>)}
        <mesh position={[0, barrierClosed ? 0.9 : 0.3, 0]}><boxGeometry args={[0.06, 0.06, TICKET_BARRIER.halfWidth * 2]} /><meshBasicMaterial color={barrierClosed ? '#ef4444' : '#22c55e'} /></mesh>
      </group>
      {barrierClosed && (
        <RigidBody type="fixed" colliders={false} key="barrier">
          <CuboidCollider position={[TICKET_BARRIER.x, 1, 0]} args={[0.1, 1, TICKET_BARRIER.halfWidth]} />
        </RigidBody>
      )}
      <DanceFloor live={open} />
      {open && <PartyLights />}
      {!open && <pointLight position={[0, H - 1, 0]} intensity={2} distance={14} color="#a78bfa" />}
      {ARCADE_TABLES.filter((t) => t.game === 'ttt').map((t) => <TicTacToeBoard key={t.id} id={t.id} />)}
      <PoolBalls />
      <group position={[bx, 0, bz - 0.9]} rotation={[0, 0, 0]}><AvatarBody identity="arena-bartender" config={STAFF.bartender} animation="idle" /></group>
      {open && (
        <>
          <group position={[dx + 0.9, 0, dz]} rotation={[0, -Math.PI / 2, 0]}><AvatarBody identity="arena-dj" config={STAFF.dj} animation="dance" /></group>
          {DANCERS.map((d) => (
            <group key={d.id} position={d.at} rotation={[0, d.yaw, 0]}><AvatarBody identity={d.id} config={d.look} animation="dance" /></group>
          ))}
        </>
      )}
    </group>
  );
}
