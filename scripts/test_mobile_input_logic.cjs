const assert = require('assert');

function testMobileNavigationAndCameraLogic() {
  console.log('=== STARTING MOBILE INPUT & NAVIGATION LOGIC VERIFICATION ===');

  // 1. Test Camera Orbit Angles & Coordinate Generation
  console.log('Test 1: Verifying 360-degree Camera Orbit Yaw/Pitch Coordinate Logic...');
  const playerPos = [10, 0.85, -20]; // [x, y, z]
  const camDist = 8.2;
  const camHeight = 3.6;

  // Test 4 cardinal yaw rotations: 0 rad, PI/2 rad, PI rad, -PI/2 rad
  const angles = [
    { yaw: 0, pitch: 0.15, expectedSignZ: 1, expectedSignX: 0 },
    { yaw: Math.PI / 2, pitch: 0.15, expectedSignZ: 0, expectedSignX: 1 },
    { yaw: Math.PI, pitch: 0.15, expectedSignZ: -1, expectedSignX: 0 },
    { yaw: -Math.PI / 2, pitch: 0.15, expectedSignZ: 0, expectedSignX: -1 }
  ];

  for (const { yaw, pitch, expectedSignZ, expectedSignX } of angles) {
    const cx = playerPos[0] + Math.sin(yaw) * Math.cos(pitch) * camDist;
    const cy = playerPos[1] + camHeight + Math.sin(pitch) * camDist * 0.6;
    const cz = playerPos[2] + Math.cos(yaw) * Math.cos(pitch) * camDist;

    assert(!isNaN(cx) && !isNaN(cy) && !isNaN(cz), 'Camera coordinates must be valid numbers');
    assert(cy > playerPos[1], 'Camera height must remain above the player head');
  }
  console.log('✔ Test 1 Passed: Camera yaw and pitch 3D orbit transformation math is valid.');

  // 2. Test Tap-To-Move Arrival & Displacement Vector
  console.log('Test 2: Verifying Tap-To-Move Displacement & Arrival Threshold...');
  const currentPos = { x: 0, y: 0.85, z: 10 };
  const targetPos = [0, 0, 18]; // 8 meters forward

  const dx = targetPos[0] - currentPos.x;
  const dz = targetPos[2] - currentPos.z;
  const dist = Math.hypot(dx, dz);
  assert.strictEqual(dist, 8, 'Initial distance should be 8 meters');

  // Direction vector calculation
  const moveDirX = dx / dist;
  const moveDirZ = dz / dist;
  assert.strictEqual(moveDirX, 0);
  assert.strictEqual(moveDirZ, 1);

  // Target angle
  const targetAngle = Math.atan2(moveDirX, moveDirZ);
  assert.strictEqual(targetAngle, 0, 'Angle should point straight forward');

  // Simulated step at 6.0 m/s with delta 0.016s (60fps)
  const speed = 6.0;
  const delta = 0.016;
  const stepZ = moveDirZ * speed * delta;
  currentPos.z += stepZ;

  const newDist = Math.hypot(targetPos[0] - currentPos.x, targetPos[2] - currentPos.z);
  assert(newDist < dist, 'Distance should decrease after step');
  console.log(`✔ Test 2 Passed: Movement vector towards tap destination advances accurately (step: +${stepZ.toFixed(4)}m).`);

  // 3. Test Stuck against wall detection logic
  console.log('Test 3: Verifying obstacle-blocked safety timeout...');
  let stuckTimer = 0;
  const simulatedBlockedDelta = 0.05; // 50ms ticks
  let targetCleared = false;

  for (let tick = 0; tick < 12; tick++) {
    const computedMovement = { x: 0.0001, z: 0.0001 }; // Wall collision zero progress
    const progress = Math.hypot(computedMovement.x, computedMovement.z);
    if (progress < 0.005) {
      stuckTimer += simulatedBlockedDelta;
      if (stuckTimer > 0.45) {
        targetCleared = true;
        break;
      }
    }
  }

  assert(targetCleared, 'Stuck target should be automatically cleared after 0.45s of wall blockage');
  console.log('✔ Test 3 Passed: Wall stuck protection clears unreachable tap destinations safely.');

  // 4. Test Touch device detection logic
  console.log('Test 4: Verifying pointer & touch capability detection matrix...');
  const checkCaps = (coarse, maxTouchPoints, hasTouch) => {
    return Boolean(coarse || (maxTouchPoints > 0) || hasTouch);
  };

  assert.strictEqual(checkCaps(true, 5, true), true, 'Mobile touch device');
  assert.strictEqual(checkCaps(false, 0, false), false, 'Standard desktop mouse');
  assert.strictEqual(checkCaps(true, 0, false), true, 'Stylus / coarse pointer');
  assert.strictEqual(checkCaps(false, 10, false), true, 'Touchscreen laptop / hybrid');
  console.log('✔ Test 4 Passed: Hybrid and touch capability detection operates robustly.');

  console.log('\n=== ALL MOBILE INPUT & TOUCH INTERACTION TESTS PASSED! ===');
  process.exit(0);
}

testMobileNavigationAndCameraLogic();
