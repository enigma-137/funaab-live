// Gate Plaza shops and billboards: layout stays clear of roads and buildings, every action spot is
// on legal (paved) ground, the SQL spot list mirrors the config, and listings are sanitised.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AD_SPOTS, BILLBOARDS, BILLBOARD_SIZE, GATE_PLAZA, PLAZA_SHOPS, cleanListing, plazaToWorld } from '../src/config/adSpaces';
import { roadBounds, campusObstacles, publicRoute } from '../src/config/kekeRoutes';
import { pedestrianPaths } from '../src/config/campusWorld';
import worldData from '../src/config/campusWorld';
import { classifyTerrain } from '../src/game/rules/lawnSecuritySystem';

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
const overlaps = (a: Box, b: Box) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const blockers = [...roadBounds, ...pedestrianPaths.map((p) => p.bounds), ...campusObstacles];

assert.equal(PLAZA_SHOPS.length, 8, 'Eight plaza shops');
for (const floor of [0, 1]) assert.equal(PLAZA_SHOPS.filter((s) => s.floor === floor).length, 4, 'Four shops a floor');
assert.equal(BILLBOARDS.length, 4, 'Four billboards to start');
assert.equal(new Set(AD_SPOTS.map((s) => s.id)).size, AD_SPOTS.length, 'Unique spot ids');

// SQL check constraint lists exactly the config's spot ids.
const sql = readFileSync(new URL('../supabase/migrations/051_ad_spaces.sql', import.meta.url), 'utf8');
const sqlIds = [...sql.match(/spot_id in \(([^)]*)\)/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
assert.deepEqual(sqlIds, AD_SPOTS.map((s) => s.id).sort(), 'ad_listings spot ids mirror src/config/adSpaces.ts');

// The plaza block (its stair and walkway posts included) stays off roads, paths and other buildings.
const [w, d] = GATE_PLAZA.footprint;
const corners = [plazaToWorld([-w / 2 - 1.5, 0, -d / 2]), plazaToWorld([w / 2 + 1.5, 0, d / 2 + GATE_PLAZA.balcony])];
const plazaBox = { minX: Math.min(corners[0][0], corners[1][0]), maxX: Math.max(corners[0][0], corners[1][0]), minZ: Math.min(corners[0][2], corners[1][2]), maxZ: Math.max(corners[0][2], corners[1][2]) };
for (const b of blockers) assert(!overlaps(plazaBox, b), `Gate Plaza overlaps ${JSON.stringify(b)}`);
assert(plazaBox.maxZ < 80, 'Plaza sits inside the gate');
// Its front faces the campus (south, toward the W Landmark and the Library), back to the gate.
assert(plazaToWorld([0, 0, 1])[2] < GATE_PLAZA.position[2]);
// Forecourt joins the Ceremonial Road via the walkway.
assert(GATE_PLAZA.walkway.minX <= GATE_PLAZA.forecourt.maxX && roadBounds.some((r) => overlaps(GATE_PLAZA.walkway, r)), 'Walkway reaches the road');

// Billboards: legs and board footprint clear of roads, paths and buildings; no vehicle route under them.
for (const b of BILLBOARDS) {
  const along = [Math.cos(b.facing), -Math.sin(b.facing)], half = BILLBOARD_SIZE.width / 2 + 0.6;
  const ends = [-1, 1].map((s) => [b.position[0] + along[0] * half * s, b.position[2] + along[1] * half * s]);
  const box = { minX: Math.min(ends[0][0], ends[1][0]) - 0.8, maxX: Math.max(ends[0][0], ends[1][0]) + 0.8, minZ: Math.min(ends[0][1], ends[1][1]) - 0.8, maxZ: Math.max(ends[0][1], ends[1][1]) + 0.8 };
  for (const o of [...blockers, plazaBox]) assert(!overlaps(box, o), `${b.id} overlaps ${JSON.stringify(o)}`);
  assert(!publicRoute.some((p) => p[0] >= box.minX && p[0] <= box.maxX && p[2] >= box.minZ && p[2] <= box.maxZ), `${b.id} sits on the route`);
}

// Every action spot is on paved ground and has an interactable.
for (const s of AD_SPOTS) assert(!classifyTerrain(s.interactAt[0], s.interactAt[2]).restricted, `${s.id} action spot is on the lawn`);
const zones = worldData.interactables.filter((i) => i.type === 'ad_space');
for (const s of [...PLAZA_SHOPS.filter((x) => x.floor === 0), ...BILLBOARDS]) assert(zones.some((z) => z.targetId === s.id), `No interactable for ${s.id}`);
assert(zones.some((z) => z.targetId === GATE_PLAZA.id), 'Plaza directory interactable');
assert(!classifyTerrain(GATE_PLAZA.directory[0], GATE_PLAZA.directory[2]).restricted);
// Ground-floor doorsteps are on the forecourt and don't overlap each other.
const doors = PLAZA_SHOPS.filter((s) => s.floor === 0);
for (let i = 1; i < doors.length; i++) assert(Math.hypot(doors[i].interactAt[0] - doors[i - 1].interactAt[0], doors[i].interactAt[2] - doors[i - 1].interactAt[2]) > doors[i].radius * 2);

// Listings: unknown spots and non-https links are dropped, text is bounded.
assert.equal(cleanListing({ spot_id: 'nowhere', business_name: 'X' }), null);
assert.equal(cleanListing({ spot_id: 'plaza-shop-1', business_name: '   ' }), null);
const l = cleanListing({ spot_id: 'plaza-shop-1', business_name: ' Mama Put ', tagline: 'x'.repeat(200), flyer_url: 'javascript:alert(1)', link_url: 'http://example.com', contact: '0800' })!;
assert.equal(l.business_name, 'Mama Put');
assert.equal(l.tagline!.length, 80);
assert.equal(l.flyer_url, null);
assert.equal(l.link_url, null);
assert.equal(cleanListing({ spot_id: 'billboard-car-park', business_name: 'Ad', link_url: 'https://example.com/shop' })!.link_url, 'https://example.com/shop');
console.log('ad spaces ok', { shops: PLAZA_SHOPS.length, billboards: BILLBOARDS.length, plazaBox });
