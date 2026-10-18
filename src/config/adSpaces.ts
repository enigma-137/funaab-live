// Ad spaces: the Gate Plaza's 8 rentable shops and the big campus billboards.
// Renting isn't open yet (no payment), so every spot shows as closed / "coming soon" until a row
// for it appears in public.ad_listings (supabase/migrations/051_ad_spaces.sql). The spot ids are
// mirrored in that migration's check constraint; scripts/test-ad-spaces.ts fails if they drift.
import type { Point } from './campusLocations';

export type AdSpotKind = 'shop' | 'billboard';
export interface AdSpot {
  id: string;
  kind: AdSpotKind;
  /** Shop 1–8, or the billboard's place name. */
  name: string;
  /** Where to stand (paved ground) to open it with the action button. */
  interactAt: Point;
  radius: number;
}

/**
 * Gate Plaza: just inside the main gate, west of the Ceremonial Road, its back to the gate and its
 * shopfronts facing the campus (the W Landmark and the Library). Two floors of four shops.
 * Built facing +z in local metres, then turned by `facing`.
 */
export const GATE_PLAZA = {
  id: 'gate-plaza',
  name: 'Gate Plaza',
  assetKey: 'gate_plaza',
  position: [-24, 0, 69] as Point,
  facing: Math.PI,
  /** Local X × Z of the building block. */
  footprint: [24, 7] as [number, number],
  shopsPerFloor: 4,
  shopWidth: 5.5,
  floorHeight: 3.6,
  /** Upper-floor walkway depth in front of the shops. */
  balcony: 1.6,
  /** Paved forecourt in front of the shops and the walkway out to the Ceremonial Road (world). */
  forecourt: { minX: -39, maxX: -11, minZ: 56.5, maxZ: 65.5 },
  walkway: { minX: -11.5, maxX: -4, minZ: 59.5, maxZ: 63.5 },
  /** The directory board on the forecourt, by the walkway (world). */
  directory: [-12.8, 0, 61] as Point,
};

/** Local x of shop column 0–3 (left to right as you face the plaza). */
export const plazaColumnX = (column: number) => (column - (GATE_PLAZA.shopsPerFloor - 1) / 2) * GATE_PLAZA.shopWidth;
/** Local (+z facing) point to world, for the plaza. */
export const plazaToWorld = ([x, y, z]: Point): Point => {
  const c = Math.cos(GATE_PLAZA.facing), s = Math.sin(GATE_PLAZA.facing), [px, , pz] = GATE_PLAZA.position;
  const round = (n: number) => Number(n.toFixed(3));
  return [round(px + x * c + z * s), y, round(pz - x * s + z * c)];
};

/** Plaza-local box (half extents, centre, optional x-tilt) for the renderer and the physics test. */
export interface PlazaCollider { id: string; half: Point; pos: Point; rot?: Point }
/**
 * One external flight at the west end (local +x, beside the block), like the hostel's: it climbs
 * toward the building from the forecourt and lands on a slab that joins the upstairs walkway.
 */
export const PLAZA_STAIRS = (() => {
  const hw = GATE_PLAZA.footprint[0] / 2, front = GATE_PLAZA.footprint[1] / 2, topZ = front + GATE_PLAZA.balcony;
  const minX = hw + 0.2, maxX = hw + 2, bottomZ = topZ + 6, steps = 14, rise = GATE_PLAZA.floorHeight, run = bottomZ - topZ;
  return { minX, maxX, topZ, bottomZ, steps, rise, run, angle: Math.atan2(rise, run), hyp: Math.hypot(rise, run),
    stepRise: rise / steps, stepRun: run / steps, width: maxX - minX, cx: (minX + maxX) / 2 };
})();

/** Every solid part of the plaza, in plaza-local metres (front facing +z). */
export function gatePlazaColliders(): PlazaCollider[] {
  const [w, d] = GATE_PLAZA.footprint, hw = w / 2, hd = d / 2, fh = GATE_PLAZA.floorHeight, top = fh * 2 + 0.3;
  const front = hd, bal = GATE_PLAZA.balcony, s = PLAZA_STAIRS, railY = fh + 0.55;
  const slabMinX = -hw, slabMaxX = s.maxX, slabCz = front + bal / 2, midY = s.rise / 2, midZ = (s.bottomZ + s.topZ) / 2;
  const out: PlazaCollider[] = [
    { id: 'block', half: [hw, top / 2, hd], pos: [0, top / 2, 0] },
    // Upstairs walkway + stair landing: its top is the first floor.
    { id: 'upper-slab', half: [(slabMaxX - slabMinX) / 2, 0.1, bal / 2], pos: [(slabMaxX + slabMinX) / 2, fh - 0.1, slabCz] },
    // Railings: along the front (open where the stair arrives), the east end and the landing's outer side.
    { id: 'rail-front', half: [(s.minX - slabMinX) / 2, 0.55, 0.05], pos: [(s.minX + slabMinX) / 2, railY, front + bal - 0.05] },
    { id: 'rail-end', half: [0.05, 0.55, bal / 2], pos: [slabMinX + 0.05, railY, slabCz] },
    { id: 'rail-landing-side', half: [0.05, 0.55, bal / 2], pos: [slabMaxX - 0.05, railY, slabCz] },
    { id: 'stair-ramp', half: [s.width / 2, 0.05, s.hyp / 2], pos: [s.cx, midY - 0.05, midZ], rot: [s.angle, 0, 0] },
    { id: 'stair-rail-outer', half: [0.05, 0.55, s.hyp / 2], pos: [s.maxX, midY + 0.55, midZ], rot: [s.angle, 0, 0] },
    { id: 'stair-rail-inner', half: [0.05, 0.55, s.hyp / 2], pos: [s.minX, midY + 0.55, midZ], rot: [s.angle, 0, 0] },
  ];
  // Posts holding up the walkway, between the shop bays.
  for (let i = 0; i <= GATE_PLAZA.shopsPerFloor; i++) {
    out.push({ id: `post-${i}`, half: [0.13, (fh - 0.2) / 2, 0.13], pos: [(i - GATE_PLAZA.shopsPerFloor / 2) * GATE_PLAZA.shopWidth, (fh - 0.2) / 2, front + bal - 0.15] });
  }
  // Solid fill under the ramp so nobody walks into the space beneath the stairs.
  for (let i = 1; i < s.steps; i++) {
    const h = i * s.stepRise;
    out.push({ id: `stair-fill-${i}`, half: [s.width / 2, h / 2, s.stepRun / 2], pos: [s.cx, h / 2, s.bottomZ - (i + 0.5) * s.stepRun] });
  }
  return out;
}

export interface PlazaShop extends AdSpot { kind: 'shop'; number: number; floor: 0 | 1; column: number }
export const PLAZA_SHOPS: PlazaShop[] = Array.from({ length: GATE_PLAZA.shopsPerFloor * 2 }, (_, i) => {
  const floor = (i < GATE_PLAZA.shopsPerFloor ? 0 : 1) as 0 | 1, column = i % GATE_PLAZA.shopsPerFloor;
  const front = GATE_PLAZA.footprint[1] / 2;
  return {
    id: `plaza-shop-${i + 1}`, kind: 'shop', number: i + 1, floor, column,
    name: `Shop ${i + 1}`,
    // Each shop opens from its own doorstep: on the forecourt, or on the upstairs walkway.
    interactAt: plazaToWorld([plazaColumnX(column), floor * GATE_PLAZA.floorHeight, front + (floor ? 0.8 : 1.6)]),
    radius: 2.3,
  };
});

export interface Billboard extends AdSpot {
  kind: 'billboard';
  /** Centre of the two legs (feet level). */
  position: Point;
  /** Yaw of the front face: 0 faces +z. The board is printed on both faces. */
  facing: number;
}
/** Board face, in metres, and the clearance under it. */
export const BILLBOARD_SIZE = { width: 10, height: 4.4, clearance: 4.2 };
export const BILLBOARDS: Billboard[] = [
  // East of the gate, on the field by the entrance: read from the gate road and from inside.
  { id: 'billboard-main-gate', kind: 'billboard', name: 'Main Gate', position: [24, 0, 86], facing: Math.PI, interactAt: [8, 0, 84], radius: 4 },
  // Between the pitch and the west road, square to the road.
  { id: 'billboard-sports-centre', kind: 'billboard', name: 'Sports Centre', position: [-71, 0, -6], facing: Math.PI / 2, interactAt: [-57, 0, -6], radius: 4 },
  // South of the Love Garden, facing the benches.
  { id: 'billboard-love-garden', kind: 'billboard', name: 'Love Garden', position: [43, 0, -15], facing: 0, interactAt: [43, 0, -5.5], radius: 4 },
  // Car Park & Keke Terminal: everyone waits for a ride here. West of the lot, facing it.
  { id: 'billboard-car-park', kind: 'billboard', name: 'Car Park', position: [-85, 0, 57], facing: Math.PI / 2, interactAt: [-60, 0, 56], radius: 4 },
];

export const AD_SPOTS: AdSpot[] = [...PLAZA_SHOPS, ...BILLBOARDS];
export const adSpotById = (id: string | null | undefined) => AD_SPOTS.find((s) => s.id === id);
/** Opening the directory board shows every plaza shop. */
export const PLAZA_DIRECTORY_ID = GATE_PLAZA.id;

/** A rented spot, as public.ad_listings returns it. */
export interface AdListing {
  spot_id: string;
  business_name: string;
  tagline: string | null;
  description: string | null;
  flyer_url: string | null;
  link_url: string | null;
  contact: string | null;
}
const isHttps = (u: unknown): u is string => {
  if (typeof u !== 'string') return false;
  try { return new URL(u).protocol === 'https:'; } catch { return false; }
};
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
/** Keeps only well-formed rows for known spots; links that aren't https are dropped. */
export function cleanListing(row: any): AdListing | null {
  if (!row || !adSpotById(row.spot_id)) return null;
  const business_name = text(row.business_name, 60);
  if (!business_name) return null;
  return {
    spot_id: row.spot_id, business_name,
    tagline: text(row.tagline, 80), description: text(row.description, 500), contact: text(row.contact, 80),
    flyer_url: isHttps(row.flyer_url) ? row.flyer_url : null,
    link_url: isHttps(row.link_url) ? row.link_url : null,
  };
}
