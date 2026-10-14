import React, { useRef, useState } from "react";
import { InnerShell } from "./InnerShell";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { VisualBuilder, type V3 } from "./campusVisualGeometry";
import { StaticBatches } from "./CampusArchitecture";
import { CampusSign } from "./CampusSign";
import { AvatarBody } from "../player/AvatarBody";
import { npcAppearance } from "../../config/npcAppearance";
import { useGameStore } from "../../stores/gameStore";
import {
  type NurseSpec, HEALTH_CENTRE, HC, HC_INTERIOR, BED, BED_XS, WAITING_BENCHES, NURSES,
} from "../../config/healthCentre";

// Two batches: `base` always renders; `upper` (roof, upper walls, porch top) hides while the
// local player is inside, so the third-person camera looks into the ward like a doll's house.
const base = new VisualBuilder();
const upper = new VisualBuilder();
const solids: { p: V3; s: V3 }[] = [];
const solid = (p: V3, s: V3) => solids.push({ p, s });
const CUT = 1.1;
const { halfWidth: W, back: B, front: F, wall: T, height: H } = HC;

// A wall run along x (alongX) or z, split at the cut height; faces get a skirting band outside
// and a mint dado inside.
function wall(a: number, b: number, line: number, alongX: boolean, outward: number, top = H, bottom = 0) {
  const len = b - a, mid = (a + b) / 2;
  const at = (y: number, h: number, off = 0, thick = T): [V3, V3] => alongX
    ? [[mid, y, line + off], [len, h, thick]]
    : [[line + off, y, mid], [thick, h, len]];
  const lowTop = Math.min(top, CUT);
  if (bottom < CUT) base.box(...at((bottom + lowTop) / 2, lowTop - bottom), "clinicWall");
  if (top > CUT) upper.box(...at((Math.max(bottom, CUT) + top) / 2, top - Math.max(bottom, CUT)), "clinicWall");
  if (bottom === 0) {
    base.box(...at(0.17, 0.34, outward * (T / 2 + 0.01), 0.03), "clinicSkirt");
    base.box(...at(0.5, 1.0, -outward * (T / 2 + 0.01), 0.02), "clinicMint");
  }
  const [p, s] = at((bottom + top) / 2, top - bottom);
  solid(p, s);
}
// Front wall either side of the door, plus the lintel above it.
wall(-W - T / 2, -HC.doorHalf, F, true, 1);
wall(HC.doorHalf, W + T / 2, F, true, 1);
wall(-HC.doorHalf, HC.doorHalf, F, true, 1, H, HC.doorHeight);
wall(-W - T / 2, W + T / 2, B, true, -1);
wall(B, F, -W, false, -1);
wall(B, F, W, false, 1);
// Maroon door frame.
for (const x of [-HC.doorHalf, HC.doorHalf]) {
  base.box([x, CUT / 2, F], [0.12, CUT, T + 0.08], "clinicTrim");
  upper.box([x, (CUT + HC.doorHeight) / 2, F], [0.12, HC.doorHeight - CUT, T + 0.08], "clinicTrim");
}
upper.box([0, HC.doorHeight + 0.06, F], [HC.doorHalf * 2 + 0.12, 0.12, T + 0.08], "clinicTrim");

// Maroon-framed burglar-proof windows on both faces of a wall.
function windowPair(x: number, z: number, alongX: boolean, w = 1.5, h = 1.15, y = 1.95) {
  for (const face of [-1, 1]) {
    const o = face * (T / 2 + 0.03);
    const box = (dx: number, dy: number, sw: number, sh: number, depth: number, m: Parameters<VisualBuilder["box"]>[2], push = 0) =>
      alongX ? upper.box([x + dx, y + dy, z + o + face * push], [sw, sh, depth], m)
        : upper.box([x + o + face * push, y + dy, z + dx], [depth, sh, sw], m);
    box(0, 0, w + 0.18, h + 0.18, 0.05, "clinicTrim");
    box(0, 0, w, h, 0.06, "glass", 0.01);
    for (let i = 1; i < 6; i++) box(-w / 2 + (i * w) / 6, 0, 0.03, h, 0.03, "clinicSteel", 0.05);
    box(0, -h / 2 - 0.1, w + 0.3, 0.07, 0.14, "clinicTrim", 0.05);
  }
}
for (const x of [-4.3, 4.3]) windowPair(x, F, true);
for (const x of [-3.2, 0, 3.2]) windowPair(x, B, true, 1.3, 0.9, 2.3);
for (const s of [-1, 1]) windowPair(s * W, -2.6, false);

// Fascia and a low hip roof with eaves, like the real clinic's corrugated sheets.
for (const [p, s] of [
  [[0, H + 0.1, F + 0.42], [2 * W + 1.1, 0.2, 0.06]],
  [[0, H + 0.1, B - 0.42], [2 * W + 1.1, 0.2, 0.06]],
  [[-W - 0.52, H + 0.1, (F + B) / 2], [0.06, 0.2, F - B + 0.9]],
  [[W + 0.52, H + 0.1, (F + B) / 2], [0.06, 0.2, F - B + 0.9]],
] as [V3, V3][]) upper.box(p, s, "clinicTrim");
upper.box([0, H + 0.04, (F + B) / 2], [2 * W + 1.0, 0.08, F - B + 0.8], "clinicRoof");
upper.roof(2 * W + 1.0, F - B + 0.8, H + 0.08, 1.2, "clinicRoof", [0, 0, (F + B) / 2]);
for (let i = -6; i <= 6; i++) upper.box([i, H + 0.1, F + 0.38], [0.04, 0.05, 0.08], "roofDark");

// Entrance porch: maroon pillars, slab, and the yellow gable with its maroon arch.
const P = HC.porchFront;
for (const x of [-1.85, 1.85]) {
  base.box([x, 1.425, P - 0.25], [0.3, 2.85, 0.3], "clinicTrim");
  solid([x, 1.425, P - 0.25], [0.3, 2.85, 0.3]);
}
base.box([0, 0.02, (F + P) / 2 + 0.1], [4.2, 0.04, P - F + 0.2], "concrete");
base.box([0, 0.015, P + 1.6], [2.2, 0.03, 3.0], "paving");
upper.box([0, 2.9, (F + P) / 2], [4.3, 0.12, P - F + 0.1], "clinicWall");
upper.box([0, 2.82, P - 0.02], [4.3, 0.1, 0.1], "clinicTrim");
upper.box([0, 3.6, P - 0.2], [3.4, 1.3, 0.3], "clinicWall");
upper.add(new THREE.CircleGeometry(0.85, 18, 0, Math.PI), "clinicTrim", [0, 2.98, P - 0.04]);
upper.box([0, 4.27, P - 0.2], [3.6, 0.08, 0.36], "clinicTrim");
// Red cross on the front wall and a split AC unit on the east side.
upper.box([2.7, 2.35, F + 0.16], [0.7, 0.2, 0.04], "clinicRed");
upper.box([2.7, 2.35, F + 0.16], [0.2, 0.7, 0.04], "clinicRed");
upper.box([W + 0.27, 1.25, -2.6], [0.28, 0.55, 0.75], "curb");
upper.box([W + 0.42, 1.25, -2.6], [0.02, 0.4, 0.6], "metal");
// Potted plants either side of the steps.
for (const x of [-2.6, 2.6]) {
  base.box([x, 0.22, F + 0.6], [0.45, 0.44, 0.45], "terracotta");
  base.orb([x, 0.75, F + 0.6], [0.42, 0.45, 0.42], "foliage");
  solid([x, 0.4, F + 0.6], [0.5, 0.8, 0.5]);
}

// ── Interior ──────────────────────────────────────────────────────────────
// Checkered terrazzo floor.
const fx = 2 * W - T, fz = F - B - T, nx = 13, nz = 8;
for (let i = 0; i < nx; i++)
  for (let j = 0; j < nz; j++)
    base.box([-fx / 2 + (i + 0.5) * (fx / nx), 0.012, B + T / 2 + (j + 0.5) * (fz / nz)], [fx / nx, 0.02, fz / nz], (i + j) % 2 ? "clinicTile" : "clinicTileB");

// Ward beds: steel frame, white mattress and pillow, mint blanket, bedside cabinet.
BED_XS.forEach((x, i) => {
  const zc = BED.headZ + BED.length / 2, side = x < 0 ? 1 : -1;
  for (const dx of [-0.42, 0.42]) for (const dz of [-0.9, 0.9]) base.pole([x + dx, 0.2, zc + dz], 0.03, 0.4, "clinicSteel");
  base.box([x, 0.4, zc], [BED.width, 0.08, BED.length], "clinicSteel");
  base.box([x, BED.top - 0.09, zc], [BED.width - 0.06, 0.17, BED.length - 0.06], "clinicSheet");
  base.box([x, BED.top + 0.01, zc + 0.35], [BED.width - 0.02, 0.04, 1.2], "clinicMint");
  base.box([x, BED.top + 0.05, BED.headZ + 0.28], [0.7, 0.1, 0.36], "clinicSheet");
  base.box([x, 0.75, BED.headZ - 0.02], [BED.width, 0.7, 0.05], "clinicSteel");
  base.box([x, 0.6, BED.headZ + BED.length + 0.02], [BED.width, 0.4, 0.04], "clinicSteel");
  solid([x, BED.top / 2, zc], [BED.width, BED.top, BED.length]);
  const cx = x - side * 0.82;
  base.box([cx, 0.3, BED.headZ + 0.3], [0.45, 0.6, 0.45], "ivory");
  base.box([cx, 0.62, BED.headZ + 0.3], [0.5, 0.04, 0.5], "wood");
  solid([cx, 0.32, BED.headZ + 0.3], [0.45, 0.64, 0.45]);
  // A drip stand at every other bed.
  if (i % 2) {
    const ix = x - side * 0.75;
    base.pole([ix, 0.9, -3.15], 0.02, 1.8, "clinicSteel");
    base.box([ix, 1.65, -3.15], [0.14, 0.22, 0.05], "clinicCurtain");
    base.box([ix, 0.03, -3.15], [0.4, 0.04, 0.4], "clinicSteel");
  }
});
// Privacy curtains between beds.
for (const x of [-3.2, 0, 3.2]) {
  base.box([x, 1.2, -3.65], [0.04, 1.6, 1.1], "clinicCurtain");
  base.box([x, 2.05, -3.65], [0.05, 0.05, 1.2], "clinicSteel");
  base.pole([x, 1.05, -3.12], 0.025, 2.1, "clinicSteel");
  solid([x, 1.05, -3.65], [0.1, 2.1, 1.15]);
}

// Nurses' station (west) and pharmacy (east): counter facing the room, staff behind.
for (const s of [-1, 1]) {
  const cx = s * 4.0;
  base.box([cx, 0.5, 0.6], [0.6, 1.0, 2.2], s < 0 ? "ivory" : "clinicWall");
  base.box([cx, 1.03, 0.6], [0.75, 0.06, 2.3], "wood");
  base.box([cx - s * 0.05, 0.3, 0.6], [0.62, 0.18, 2.22], "clinicTrim");
  solid([cx, 0.53, 0.6], [0.75, 1.06, 2.3]);
}
// Monitor, folders and a phone on the nurses' desk.
base.box([-4.05, 1.27, 0.3], [0.08, 0.36, 0.55], "shadow");
base.box([-4.1, 1.08, 0.3], [0.2, 0.04, 0.2], "metal");
base.box([-4.0, 1.1, 1.2], [0.3, 0.08, 0.4], "engBlue");
base.box([-4.0, 1.12, 1.25], [0.28, 0.04, 0.38], "clinicMint");
// Filing cabinet behind the nurse.
base.box([-6.1, 0.65, 1.9], [0.45, 1.3, 0.7], "metal");
solid([-6.1, 0.65, 1.9], [0.45, 1.3, 0.7]);
// Pharmacy shelving packed with medicine boxes.
base.box([6.12, 1.0, 0.6], [0.4, 2.0, 2.6], "wood");
solid([6.12, 1.0, 0.6], [0.4, 2.0, 2.6]);
for (let shelf = 0; shelf < 4; shelf++)
  for (let k = 0; k < 9; k++) {
    const h = 0.18 + ((k + shelf) % 3) * 0.05;
    base.box([5.88, 0.25 + shelf * 0.45 + h / 2, -0.5 + k * 0.27], [0.08, h, 0.2],
      (["clinicSheet", "clinicMint", "flower", "gold", "engBlue"] as const)[(k * 3 + shelf) % 5]);
  }
base.box([3.9, 1.12, 0.2], [0.25, 0.12, 0.18], "clinicSheet");
base.box([3.95, 1.1, 1.0], [0.18, 0.08, 0.28], "flower");

// Waiting benches along the front wall, facing the ward.
for (const x of WAITING_BENCHES) {
  base.box([x, 0.46, 2.08], [1.7, 0.07, 0.5], "wood");
  base.box([x, 0.78, 2.4], [1.7, 0.45, 0.06], "wood");
  for (const dx of [-0.75, 0.75]) base.box([x + dx, 0.22, 2.08], [0.06, 0.44, 0.45], "metal");
  solid([x, 0.25, 2.12], [1.7, 0.5, 0.45]);
}
// A water dispenser by the door.
base.box([1.35, 0.5, 2.55], [0.32, 1.0, 0.32], "clinicSheet");
base.box([1.35, 1.15, 2.55], [0.26, 0.3, 0.26], "clinicCurtain");
solid([1.35, 0.6, 2.55], [0.32, 1.2, 0.32]);

const baseBatches = base.finish();
const upperBatches = upper.finish();

function Nurse({ nurse }: { nurse: NurseSpec }) {
  const ref = useRef<THREE.Group>(null);
  const state = useRef({ t: 0, dir: 1, wait: 0 });
  const [ox, , oz] = HEALTH_CENTRE.position;
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g || !("route" in nurse)) return;
    const s = state.current, [a, b] = nurse.route;
    if (s.wait > 0) { s.wait -= dt; return; }
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    s.t += (s.dir * 0.85 * Math.min(dt, 0.1)) / len;
    if (s.t >= 1 || s.t <= 0) { s.t = Math.min(1, Math.max(0, s.t)); s.dir *= -1; s.wait = 3; }
    g.position.set(a[0] + (b[0] - a[0]) * s.t - ox, 0, a[2] + (b[2] - a[2]) * s.t - oz);
    const target = Math.atan2((b[0] - a[0]) * s.dir, (b[2] - a[2]) * s.dir);
    let d = target - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 6);
  });
  const post = "post" in nurse ? nurse.post : nurse.route[0];
  const feminine = nurse.id !== "nurse-ward";
  return (
    <group ref={ref} position={[post[0] - ox, 0, post[2] - oz]} rotation={[0, "rotation" in nurse ? nurse.rotation : Math.PI / 2, 0]}>
      <AvatarBody identity={nurse.id} trackMovement={"route" in nurse}
        config={npcAppearance(nurse.id, {
          bodyType: feminine ? "feminine" : "masculine",
          topStyle: feminine ? "blouse" : "shirt", topColor: feminine ? "#f8fafc" : "#dbeafe",
          bottomStyle: feminine ? "skirt" : "trousers", bottomColor: feminine ? "#f8fafc" : "#1e3a5f",
          shoeColor: "#f1f5f9", hairstyle: feminine ? "bun" : "low-cut",
        })} />
    </group>
  );
}

export function HealthCentre() {
  const [inside, setInside] = useState(false);
  useFrame(() => {
    const [x, , z] = useGameStore.getState().myPosition;
    const now = x > HC_INTERIOR.minX && x < HC_INTERIOR.maxX && z > HC_INTERIOR.minZ && z < HC_INTERIOR.maxZ;
    setInside((was) => (was === now ? was : now));
  });
  return (
    <group position={HEALTH_CENTRE.position}>
      <StaticBatches batches={baseBatches} />
      {/* Inside, the roof and upper walls go and the ward's own walls and ceiling close in around
          you; from outside the camera sees through the wall between it and you. */}
      {!inside && (
        <>
          <StaticBatches batches={upperBatches} />
          <CampusSign position={[0, 4.75, HC.porchFront - 0.15]} width={3.8} height={0.8}
            title="FUNAAB HEALTH CENTRE" subtitle="Clinic • Pharmacy • Emergency" />
        </>
      )}
      {inside && (
        <InnerShell rect={{ minX: -W + T / 2, maxX: W - T / 2, minZ: B + T / 2, maxZ: F - T / 2 }} height={H}
          wall="#eef3ea" ceiling="#f4f7f2" dado={{ color: "#bfe3d3", height: 1.0 }}
          openings={[{ side: "south", centre: 0, half: HC.doorHalf, top: HC.doorHeight }]} />
      )}
      <group position={[-3.555, 0.62, 0.6]} rotation={[0, Math.PI / 2, 0]}>
        <CampusSign width={1.6} height={0.34} title="NURSES' STATION" tone="cream" />
      </group>
      <group position={[3.555, 0.62, 0.6]} rotation={[0, -Math.PI / 2, 0]}>
        <CampusSign width={1.6} height={0.34} title="PHARMACY" tone="cream" />
      </group>
      <RigidBody type="fixed" colliders={false}>
        {solids.map(({ p, s }, i) => (
          <CuboidCollider key={i} position={p} args={[s[0] / 2, s[1] / 2, s[2] / 2]} />
        ))}
      </RigidBody>
      {NURSES.map((n) => <Nurse key={n.id} nurse={n} />)}
    </group>
  );
}
