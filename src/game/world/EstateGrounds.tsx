import React, { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { ESTATE, ESTATE_HOUSES } from '../../config/estate';
import { VisualBuilder, type Batch, type MaterialKey } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';
import { buildTree } from './CampusLandscape';

const B = ESTATE.bounds, WH = ESTATE.wallHeight, GATE = ESTATE.gateHalfWidth, T = 0.3;
const flat = (b: VisualBuilder, r: { minX: number; maxX: number; minZ: number; maxZ: number }, m: MaterialKey, y = 0.02) =>
  b.box([(r.minX + r.maxX) / 2, y, (r.minZ + r.maxZ) / 2], [r.maxX - r.minX, 0.04, r.maxZ - r.minZ], m);

/** Grounds in world coordinates: roads, lawn, car park, perimeter wall, gate and the estate office. */
function buildGrounds(): Batch[] {
  const b = new VisualBuilder();
  // Private road from the gate road up to the gate, then the driveway and the street inside.
  flat(b, ESTATE.accessRoad, 'road', 0.015);
  for (const s of [-1, 1]) b.box([s * (ESTATE.accessRoad.maxX + 0.15), 0.08, 111], [0.3, 0.16, 26], 'curb');
  flat(b, { minX: B.minX + T, maxX: B.maxX - T, minZ: B.minZ + T, maxZ: B.maxZ - T }, 'lawnBright', 0.012);
  flat(b, ESTATE.driveway, 'paving', 0.03);
  flat(b, ESTATE.street, 'paving', 0.03);
  // Car park: asphalt with white bay lines (two rows facing a middle aisle).
  const cp = ESTATE.carPark;
  flat(b, cp, 'asphalt', 0.03);
  for (let x = cp.minX + 0.5; x <= cp.maxX - 0.4; x += 2.8) for (const z of [cp.minZ + 2.6, cp.maxZ - 2.6]) b.box([x, 0.055, z], [0.1, 0.01, 5], 'courtLine');
  flat(b, { minX: cp.maxX, maxX: ESTATE.driveway.minX, minZ: (cp.minZ + cp.maxZ) / 2 - 3, maxZ: (cp.minZ + cp.maxZ) / 2 + 3 }, 'asphalt', 0.031);
  // Perimeter wall with a capping, the gate gap in the south wall.
  const wall = (x: number, z: number, w: number, d: number) => { b.box([x, WH / 2, z], [w, WH, d], 'cream'); b.box([x, WH + 0.08, z], [w + 0.12, 0.16, d + 0.12], 'estateTrim'); };
  const sideLen = (B.maxX - B.minX) / 2 - GATE;
  for (const s of [-1, 1]) wall(s * (GATE + sideLen / 2), B.minZ, sideLen, T);
  wall(0, B.maxZ, B.maxX - B.minX, T);
  for (const x of [B.minX, B.maxX]) wall(x, (B.minZ + B.maxZ) / 2, T, B.maxZ - B.minZ);
  // Gate pillars with lamps and an open sliding gate parked behind the west pillar.
  for (const s of [-1, 1]) {
    b.box([s * (GATE + 0.5), 1.7, B.minZ], [1, 3.4, 1], 'estateTrim');
    b.orb([s * (GATE + 0.5), 3.65, B.minZ], [0.28, 0.28, 0.28], 'ivory');
  }
  for (let i = 0; i < 9; i++) b.box([-GATE - 1.2 - i * 0.42, 1.2, B.minZ + 0.45], [0.06, 2, 0.06], 'metal');
  b.box([-GATE - 2.9, 2.15, B.minZ + 0.45], [3.6, 0.08, 0.08], 'metal');
  // Estate office just inside the gate.
  const [ox, , oz] = ESTATE.office;
  b.box([ox, 1.6, oz], [4.4, 3.2, 3.6], 'ivory');
  b.roof(5.2, 4.4, 3.2, 1.2, 'estateRoof', [ox, 0, oz]);
  b.box([ox, 1.1, oz - 1.82], [1.1, 2.2, 0.06], 'estateTrim');
  b.box([ox + 1.4, 1.6, oz - 1.82], [1.1, 0.9, 0.05], 'glass');
  // Street lamps along the driveway and the street.
  for (const [x, z] of [[-4.5, 132], [4.5, 140], [-4.5, 146], [-20, 147.5], [20, 147.5], [-34, 147.5], [34, 147.5]]) {
    b.pole([x, 2.2, z], 0.07, 4.4, 'metal');
    b.orb([x, 4.45, z], [0.22, 0.22, 0.22], 'ivory');
  }
  return b.finish();
}

const PAINT: MaterialKey[] = ['estateA', 'estateB', 'estateC', 'estateD', 'estateE'];

/** A two-storey house in local coordinates: front (door) toward +Z; w along X, d along Z. */
function buildHouse(w: number, d: number, paint: MaterialKey): Batch[] {
  const b = new VisualBuilder();
  const H1 = 3.2, H2 = 3.0;
  b.box([0, H1 / 2, 0], [w, H1, d], paint);
  b.box([0, H1 + 0.1, 0], [w + 0.3, 0.2, d + 0.3], 'estateTrim');
  b.box([0, H1 + 0.2 + H2 / 2, -0.4], [w - 0.6, H2, d - 0.8], paint);
  b.roof(w + 0.8, d + 0.2, H1 + 0.2 + H2, 2.2, 'estateRoof', [0, 0, -0.4]);
  // Balcony over the porch: slab, rail and posts.
  const fz = d / 2;
  b.box([0, H1 + 0.15, fz + 0.9], [w * 0.5, 0.18, 1.8], 'concrete');
  b.box([0, H1 + 0.8, fz + 1.75], [w * 0.5, 0.08, 0.08], 'metal');
  for (let x = -w / 4; x <= w / 4 + 0.01; x += w / 8) b.box([x, H1 + 0.5, fz + 1.75], [0.05, 0.7, 0.05], 'metal');
  for (const s of [-1, 1]) b.box([s * (w / 4 - 0.2), H1 / 2, fz + 1.6], [0.35, H1, 0.35], 'ivory');
  // Front door, windows on both floors (front and sides).
  b.box([0, 1.15, fz + 0.03], [1.3, 2.3, 0.06], 'estateTrim');
  b.orb([0.45, 1.15, fz + 0.08], [0.05, 0.05, 0.05], 'gold');
  for (const x of [-w / 2 + 1.6, w / 2 - 1.6]) {
    b.box([x, 1.6, fz + 0.03], [1.5, 1.3, 0.06], 'glass');
    b.box([x, 1.6, fz + 0.05], [1.7, 0.1, 0.06], 'ivory');
  }
  for (const x of [-w / 2 + 1.8, 0, w / 2 - 1.8]) b.box([x, H1 + 1.6, fz - 0.8 + 0.03], [1.3, 1.2, 0.06], 'glass');
  for (const s of [-1, 1]) for (const z of [-d / 4, d / 4]) {
    b.box([s * (w / 2 + 0.03), 1.6, z], [0.06, 1.2, 1.3], 'glass');
    b.box([s * (w / 2 - 0.3 + 0.03), H1 + 1.6, z - 0.4], [0.06, 1.1, 1.2], 'glass');
  }
  // Steps to the porch.
  b.box([0, 0.1, fz + 2.3], [2.4, 0.2, 0.8], 'paving');
  return b.finish();
}

export function EstateGrounds() {
  const grounds = useMemo(buildGrounds, []);
  const houses = useMemo(() => ESTATE_HOUSES.map((h, i) => {
    const sideways = Math.abs(Math.abs(h.facing) - Math.PI / 2) < 0.01;
    const [w, d] = sideways ? [h.size[1], h.size[0]] : h.size;
    return { h, w, d, batches: buildHouse(w, d, PAINT[i % PAINT.length]) };
  }), []);
  const tree = useMemo(() => ({ neem: buildTree('neem'), palm: buildTree('palm') }), []);
  const trees: Array<[number, number, 'neem' | 'palm']> = [
    [-38, 127, 'palm'], [-38, 147, 'neem'], [-6, 127, 'palm'], [6, 146, 'palm'], [38, 127, 'neem'], [38, 147, 'palm'],
    [-19, 166.5, 'neem'], [0, 166.5, 'palm'], [19, 166.5, 'neem'], [16, 127, 'neem'], [-39, 160, 'palm'], [39, 160, 'palm'],
  ];
  const sideLen = (B.maxX - B.minX) / 2 - GATE;
  return (
    <group name="royal-gardens-estate">
      <StaticBatches batches={grounds} />
      {houses.map(({ h, w, d, batches }) => (
        <group key={h.id} position={h.centre} rotation={[0, h.facing === Math.PI ? Math.PI : h.facing, 0]}>
          <StaticBatches batches={batches} />
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider position={[0, 3.2, 0]} args={[w / 2, 3.2, d / 2]} />
            {[-1, 1].map((s) => <CuboidCollider key={s} position={[s * (w / 4 - 0.2), 1.6, d / 2 + 1.6]} args={[0.18, 1.6, 0.18]} />)}
          </RigidBody>
        </group>
      ))}
      {trees.map(([x, z, type], i) => (
        <group key={i} position={[x, 0, z]} scale={0.9 + (i % 3) * 0.08}><StaticBatches batches={tree[type]} /></group>
      ))}
      {/* Estate name over the gate, readable from the campus side. */}
      <group position={[0, 4.4, B.minZ - 0.1]} rotation={[0, Math.PI, 0]}>
        <CampusSign width={7.5} height={1.1} title={ESTATE.name.toUpperCase()} subtitle={`ROOMS ₦${ESTATE.weeklyRent.toLocaleString()} / WEEK`} tone="cream" />
      </group>
      <mesh position={[0, 4.4, B.minZ]}><boxGeometry args={[GATE * 2 + 2, 0.25, 0.3]} /><meshStandardMaterial color="#5b4636" /></mesh>
      <group position={[ESTATE.office[0], 2.6, ESTATE.office[2] - 1.9]} rotation={[0, Math.PI, 0]}>
        <CampusSign width={3.4} height={0.55} title="ESTATE OFFICE" subtitle="RENT · RENEW · YOUR ROOM" />
      </group>
      <RigidBody type="fixed" colliders={false}>
        {[-1, 1].map((s) => <CuboidCollider key={`s${s}`} position={[s * (GATE + sideLen / 2), WH / 2, B.minZ]} args={[sideLen / 2, WH / 2, T / 2]} />)}
        <CuboidCollider position={[0, WH / 2, B.maxZ]} args={[(B.maxX - B.minX) / 2, WH / 2, T / 2]} />
        {[B.minX, B.maxX].map((x) => <CuboidCollider key={`w${x}`} position={[x, WH / 2, (B.minZ + B.maxZ) / 2]} args={[T / 2, WH / 2, (B.maxZ - B.minZ) / 2]} />)}
        {[-1, 1].map((s) => <CuboidCollider key={`p${s}`} position={[s * (GATE + 0.5), 1.7, B.minZ]} args={[0.5, 1.7, 0.5]} />)}
        <CuboidCollider position={ESTATE.office} args={[2.2, 1.6, 1.8]} />
      </RigidBody>
    </group>
  );
}

