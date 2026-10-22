// Gate Plaza shops and billboards: layout stays clear of roads and buildings, every action spot is
// on legal (paved) ground, the SQL spot list mirrors the config, and listings are sanitised.
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { readFileSync } from 'node:fs';
import { AD_SPOTS, BILLBOARDS, BILLBOARD_SIZE, GATE_PLAZA, PLAZA_SHOPS, PLAZA_STAIRS, adSpotLabel, cleanListing, gatePlazaColliders, normalizeAdLink, plazaColumnX, plazaToWorld } from '../src/config/adSpaces';
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
const requestSql = readFileSync(new URL('../supabase/migrations/052_ad_requests.sql', import.meta.url), 'utf8');
const requestIds = [...requestSql.match(/spot_id in \(([^)]*)\)/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
assert.deepEqual(requestIds, sqlIds, 'ad_requests spot ids mirror ad_listings');

// Links typed into the rent form: "wa.me/…" gets https://, anything not https is refused.
assert.equal(normalizeAdLink('wa.me/message/IR27O7WGD3HAG1'), 'https://wa.me/message/IR27O7WGD3HAG1');
assert.equal(normalizeAdLink('  https://cttaste.com/LeahBellas  '), 'https://cttaste.com/LeahBellas');
assert.equal(normalizeAdLink(''), null);
assert.equal(normalizeAdLink('http://insecure.example'), null);
assert.equal(normalizeAdLink('javascript:alert(1)'), null);
assert.equal(adSpotLabel('billboard-car-park'), 'Car Park billboard');
assert.equal(adSpotLabel('plaza-shop-2'), 'Gate Plaza · Shop 2');

// The plaza block (its stair and walkway posts included) stays off roads, paths and other buildings.
const [w, d] = GATE_PLAZA.footprint;
const corners = [plazaToWorld([-w / 2 - 1.5, 0, -d / 2]), plazaToWorld([PLAZA_STAIRS.maxX + 0.5, 0, PLAZA_STAIRS.bottomZ])];
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
for (const s of [...PLAZA_SHOPS, ...BILLBOARDS]) assert(zones.some((z) => z.targetId === s.id), `No interactable for ${s.id}`);
assert(zones.some((z) => z.targetId === GATE_PLAZA.id), 'Plaza directory interactable');
assert(!classifyTerrain(GATE_PLAZA.directory[0], GATE_PLAZA.directory[2]).restricted);
// Doorsteps don't overlap: not side by side, and not a ground shop with the one above it.
const dist3 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
for (const a of PLAZA_SHOPS) for (const b of PLAZA_SHOPS) if (a !== b) assert(dist3(a.interactAt, b.interactAt) > a.radius, `${a.id} and ${b.id} doorsteps overlap`);
// The stair foot is on the forecourt, and the climb is gentle enough for the character controller.
const foot = plazaToWorld([PLAZA_STAIRS.cx, 0, PLAZA_STAIRS.bottomZ + 0.8]);
assert(!classifyTerrain(foot[0], foot[2]).restricted, 'stair foot on paving');
assert(PLAZA_STAIRS.angle < (40 * Math.PI) / 180, 'stairs are climbable (< 40°)');
assert(PLAZA_STAIRS.stepRise < 0.3, 'each step below autostep height');

// Listings: unknown spots and non-https links are dropped, text is bounded.
assert.equal(cleanListing({ spot_id: 'nowhere', business_name: 'X' }), null);
assert.equal(cleanListing({ spot_id: 'plaza-shop-1', business_name: '   ' }), null);
const l = cleanListing({ spot_id: 'plaza-shop-1', business_name: ' Mama Put ', tagline: 'x'.repeat(200), flyer_url: 'javascript:alert(1)', link_url: 'http://example.com', contact: '0800' })!;
assert.equal(l.business_name, 'Mama Put');
assert.equal(l.tagline!.length, 80);
assert.equal(l.flyer_url, null);
assert.equal(l.link_url, null);
assert.equal(cleanListing({ spot_id: 'billboard-car-park', business_name: 'Ad', link_url: 'https://example.com/shop' })!.link_url, 'https://example.com/shop');

// Real physics: the plaza's own collider list, walked with LocalPlayer's character-controller settings.
async function climb() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.2, 60).setTranslation(0, -0.2, 0));
  for (const c of gatePlazaColliders()) {
    const q = new RAPIER.Quaternion(0, 0, 0, 1);
    if (c.rot) { q.x = Math.sin(c.rot[0] / 2); q.w = Math.cos(c.rot[0] / 2); }
    world.createCollider(RAPIER.ColliderDesc.cuboid(...c.half).setTranslation(...c.pos).setRotation(q));
  }
  const HALF = 0.5, RADIUS = 0.35, CENTER = HALF + RADIUS, SPEED = 6, DT = 1 / 60;
  const start: V3 = [0, 0, 9];
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start[0], CENTER, start[2]));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS), body);
  const controller = world.createCharacterController(0.04);
  controller.enableAutostep(0.3, 0.2, true);
  controller.enableSnapToGround(0.5);
  controller.setSlideEnabled(true);
  controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
  controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
  world.step();
  const feet = (): V3 => { const t = body.translation(); return [t.x, t.y - CENTER, t.z]; };
  const walk = (to: V3, maxSeconds = 12) => {
    for (let t = 0; t < maxSeconds; t += DT) {
      const f = feet(), dx = to[0] - f[0], dz = to[2] - f[2], dist = Math.hypot(dx, dz);
      if (dist < 0.15) break;
      const step = Math.min(dist, SPEED * DT);
      controller.computeColliderMovement(collider, { x: (dx / dist) * step, y: -9.81 * DT * 0.5, z: (dz / dist) * step });
      const m = controller.computedMovement(), cur = body.translation();
      body.setNextKinematicTranslation({ x: cur.x + m.x, y: Math.max(CENTER, cur.y + m.y), z: cur.z + m.z });
      world.step();
    }
    return feet();
  };
  const near = (a: V3, b: V3, tol = 0.35) => Math.hypot(a[0] - b[0], a[2] - b[2]) < tol;
  const fh = GATE_PLAZA.floorHeight, st = PLAZA_STAIRS, walkZ = GATE_PLAZA.footprint[1] / 2 + 0.8;
  // 1. Forecourt → foot of the stairs.
  let p = walk([st.cx, 0, st.bottomZ + 1]);
  assert(near(p, [st.cx, 0, st.bottomZ + 1]) && p[1] < 0.2, `reach stair foot ${p}`);
  // 2. Up the flight onto the landing.
  p = walk([st.cx, 0, walkZ]);
  assert(near(p, [st.cx, 0, walkZ]) && Math.abs(p[1] - fh) < 0.25, `climb to the walkway ${p}`);
  // 3. Along the walkway to every upstairs shop; each doorstep's action opens there.
  for (const shop of [...PLAZA_SHOPS].filter((s) => s.floor === 1).reverse()) {
    p = walk([plazaColumnX(shop.column), 0, walkZ]);
    assert(Math.abs(p[1] - fh) < 0.25, `still upstairs at ${shop.id} ${p}`);
    assert(dist3(plazaToWorld(p), shop.interactAt) < shop.radius, `${shop.id} reachable upstairs ${p}`);
  }
  // 4. The railing holds: walking off the front edge stops at the rail.
  p = walk([plazaColumnX(1), 0, walkZ + 4], 3);
  assert(Math.abs(p[1] - fh) < 0.25 && p[2] < GATE_PLAZA.footprint[1] / 2 + GATE_PLAZA.balcony, `railing stops a fall ${p}`);
  // 5. Back down to the forecourt.
  walk([st.cx, 0, walkZ]);
  p = walk([st.cx, 0, st.bottomZ + 1.5]);
  assert(near(p, [st.cx, 0, st.bottomZ + 1.5]) && p[1] < 0.2, `back down ${p}`);
  // 6. Ground floor: walk the shopfronts under the walkway without hitting the stair.
  p = walk([plazaColumnX(0), 0, GATE_PLAZA.footprint[1] / 2 + 1.6], 15);
  assert(p[1] < 0.2 && dist3(plazaToWorld(p), PLAZA_SHOPS[0].interactAt) < PLAZA_SHOPS[0].radius, `ground shop 1 doorstep ${p}`);
  console.log('ad spaces ok', { shops: PLAZA_SHOPS.length, billboards: BILLBOARDS.length, plazaBox, stairs: `${(st.angle * 180 / Math.PI).toFixed(1)}°` });
}
type V3 = [number, number, number];
climb().catch((e) => { console.error(e); process.exit(1); });
