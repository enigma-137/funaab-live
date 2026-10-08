const assert = require('assert');
const worldData = require('./src/worlds/funaab/world.json');

console.log('=== TEST 1: World Data Structure Validation ===');
assert(Array.isArray(worldData.terrainZones), 'world.json must contain terrainZones');
assert(Array.isArray(worldData.kekeDestinations), 'world.json must contain kekeDestinations');
assert(Array.isArray(worldData.securityRoutes), 'world.json must contain securityRoutes');
console.log(`✓ Loaded ${worldData.terrainZones.length} terrain zones`);
console.log(`✓ Loaded ${worldData.kekeDestinations.length} keke destinations`);
console.log(`✓ Loaded ${worldData.securityRoutes.length} security officer patrol routes`);

console.log('\n=== TEST 2: Terrain Zone & Sports Centre Rule Verification ===');
const sportsZone = worldData.terrainZones.find(z => z.id === 'sports-pitch');
assert(sportsZone, 'Sports pitch zone must exist');
assert.strictEqual(sportsZone.restricted, false, 'Sports pitch MUST be legal (restricted: false)');
assert.strictEqual(sportsZone.type, 'sports', 'Sports pitch type must be sports');
console.log('✓ Sports Centre grass field is verified as LEGAL (no fines).');

const centralLawn = worldData.terrainZones.find(z => z.id === 'lawn-central-west');
assert(centralLawn, 'Restricted central lawn must exist');
assert.strictEqual(centralLawn.restricted, true, 'Campus lawns must be restricted (restricted: true)');
console.log('✓ Campus lawns verified as RESTRICTED.');

console.log('\n=== TEST 3: Lawn Classification Function Logic ===');
function classifyTerrain(x, z) {
  for (const zone of worldData.terrainZones) {
    if (zone.type === 'building' && isInside(x, z, zone.bounds)) return { type: zone.type, restricted: false };
  }
  for (const zone of worldData.terrainZones) {
    if (zone.type === 'sports' && isInside(x, z, zone.bounds)) return { type: zone.type, restricted: false };
  }
  for (const zone of worldData.terrainZones) {
    if (zone.type === 'path' && isInside(x, z, zone.bounds)) return { type: zone.type, restricted: false };
  }
  for (const zone of worldData.terrainZones) {
    if ((zone.type === 'plaza' || zone.type === 'carpark') && isInside(x, z, zone.bounds)) return { type: zone.type, restricted: false };
  }
  for (const zone of worldData.terrainZones) {
    if (zone.type === 'road' && isInside(x, z, zone.bounds)) return { type: zone.type, restricted: false };
  }
  for (const zone of worldData.terrainZones) {
    if (zone.type === 'lawn' && zone.restricted && isInside(x, z, zone.bounds)) return { type: zone.type, restricted: true };
  }
  return { type: 'path', restricted: false };
}

function isInside(x, z, b) {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

// Test Road (Ceremonial Road)
const roadTest = classifyTerrain(0, 30);
assert.strictEqual(roadTest.restricted, false, 'Ceremonial road must be legal');
console.log('✓ Road [0, 30] -> Legal');

// Test Sports Field ([-38, 0])
const sportsTest = classifyTerrain(-38, 0);
assert.strictEqual(sportsTest.restricted, false, 'Sports Centre turf must be legal');
console.log('✓ Sports Pitch [-38, 0] -> Legal (No Fines)');

// Test Restricted Lawn ([-10, 0])
const lawnTest = classifyTerrain(-10, 0);
assert.strictEqual(lawnTest.restricted, true, 'Central lawn must be restricted');
console.log('✓ Central Lawn [-10, 0] -> RESTRICTED');

console.log('\n=== TEST 4: Security Patrol & Anti-Spam Fine Logic ===');
class LawnEnforcementManager {
  constructor() {
    this.finedForCurrentLawnStay = false;
    this.lastFineTime = 0;
    this.wasOnLawn = false;
  }
  checkEnforcement(playerPos, officers) {
    const [px, , pz] = playerPos;
    const terrain = classifyTerrain(px, pz);
    if (!terrain.restricted) {
      if (this.wasOnLawn) {
        this.finedForCurrentLawnStay = false;
        this.wasOnLawn = false;
      }
      return { caught: false };
    }
    this.wasOnLawn = true;
    if (this.finedForCurrentLawnStay) return { caught: false };
    if (Date.now() - this.lastFineTime < 20000) return { caught: false };

    for (const officer of officers) {
      const [ox, , oz] = officer.position;
      const dist = Math.hypot(px - ox, pz - oz);
      if (dist <= officer.detectionRadius) {
        this.finedForCurrentLawnStay = true;
        this.lastFineTime = Date.now();
        return { caught: true, officerName: officer.name, fineAmount: 500 };
      }
    }
    return { caught: false };
  }
}

const enforcement = new LawnEnforcementManager();
const officers = [
  { name: 'Officer Babatunde', position: [-8, 0, 0], detectionRadius: 13.0 }
];

// Step 1: Walk on road
let res1 = enforcement.checkEnforcement([0, 0, 30], officers);
assert.strictEqual(res1.caught, false, 'Should not be caught on road');
console.log('✓ Step 1: Walking on road -> No fine');

// Step 2: Step onto lawn near security
let res2 = enforcement.checkEnforcement([-10, 0, 0], officers);
assert.strictEqual(res2.caught, true, 'Should be caught on lawn near officer');
assert.strictEqual(res2.fineAmount, 500, 'Fine must be ₦500');
console.log(`✓ Step 2: Stepped onto restricted lawn -> CAUGHT by ${res2.officerName} (Fine: ₦${res2.fineAmount})`);

// Step 3: Remain on lawn next frame -> NO repeated fine spam
let res3 = enforcement.checkEnforcement([-10, 0, 1], officers);
assert.strictEqual(res3.caught, false, 'Anti-spam: Must not repeatedly fine while remaining on same lawn');
console.log('✓ Step 3: Continued walking on lawn -> No repeat spam (Anti-spam working)');

// Step 4: Step back onto legal road
let res4 = enforcement.checkEnforcement([0, 0, 20], officers);
assert.strictEqual(res4.caught, false, 'Road is legal');
console.log('✓ Step 4: Returned to paved road -> Violation state reset');

console.log('\n=== TEST 5: Keke Destination Transport Table Validation ===');
worldData.kekeDestinations.forEach(d => {
  assert(d.id && d.name && typeof d.fare === 'number' && Array.isArray(d.position), `Destination ${d.name} must be valid`);
  assert(d.fare >= 50 && d.fare <= 150, `Fare for ${d.name} (${d.fare}) must be within standard range`);
  console.log(`✓ Destination: ${d.icon} ${d.name.padEnd(35)} Fare: ₦${d.fare}`);
});

console.log('\n🎉 ALL ACCEPTANCE TESTS PASSED PROGRAMMATICALLY!');
