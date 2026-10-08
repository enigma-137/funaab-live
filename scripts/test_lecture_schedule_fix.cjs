// Comprehensive test suite for Schedule Activation & Lagos Time logic

// We will load the TypeScript logic or run a standalone verification of the math & logic
console.log('=== VERIFYING SCHEDULE ACTIVATION & LAGOS TIME LOGIC ===');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  }
}

// 1. Timezone & Lagos WAT calculation
function getLagosTime(inputMs = Date.now()) {
  const d = new Date(inputMs);
  const utcMs = inputMs + d.getTimezoneOffset() * 60000;
  const lagosMs = utcMs + 3600000; // UTC+1
  const lagosDate = new Date(lagosMs);
  const hour = lagosDate.getUTCHours();
  const minute = lagosDate.getUTCMinutes();
  const second = lagosDate.getUTCSeconds();
  const dayOfWeek = lagosDate.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isAcademicHours = !isWeekend && hour >= 9 && hour < 17;
  return { hour, minute, second, dayOfWeek, isWeekend, isAcademicHours, lagosMs };
}

console.log('\n--- 1. Lagos Time Evaluation ---');
const currentLagos = getLagosTime();
console.log(`Current Lagos Time: ${currentLagos.hour}:${currentLagos.minute < 10 ? '0' : ''}${currentLagos.minute}, Day: ${currentLagos.dayOfWeek}, Academic Hours: ${currentLagos.isAcademicHours}`);
assert(typeof currentLagos.hour === 'number' && currentLagos.hour >= 0 && currentLagos.hour <= 23, 'Lagos hour parsed correctly');

// 2. Beta Staggered Cycle Math
console.log('\n--- 2. Staggered Lecture Cycle Math ---');
const halls = ['colfhec-lecture-hall', 'central-lecture-hall', 'colbios-lecture-hall'];
const offsets = {
  'colfhec-lecture-hall': 0,
  'central-lecture-hall': 5,
  'colbios-lecture-hall': 10,
};

function computeHallState(hallId, currentTimeMs, forceParam = null) {
  const lagos = getLagosTime(currentTimeMs);
  const offsetMinutes = offsets[hallId] || 0;
  const cycleDurationMs = 15 * 60 * 1000;
  const lectureDurationMs = 12 * 60 * 1000;
  const offsetMs = offsetMinutes * 60 * 1000;

  if (forceParam) {
    return { status: 'active', timeRemainingSeconds: 9999, isForced: true };
  }

  if (lagos.isWeekend) {
    return { status: 'weekend', timeRemainingSeconds: 0, isForced: false };
  }

  if (lagos.hour < 9 || lagos.hour >= 17) {
    return { status: 'off_hours', timeRemainingSeconds: 0, isForced: false };
  }

  const shiftedTimeMs = currentTimeMs - offsetMs;
  const currentCycleStart = Math.floor(shiftedTimeMs / cycleDurationMs) * cycleDurationMs + offsetMs;
  const elapsedInCycleMs = currentTimeMs - currentCycleStart;

  if (elapsedInCycleMs < lectureDurationMs) {
    const remainingSec = Math.max(1, Math.floor((lectureDurationMs - elapsedInCycleMs) / 1000));
    return { status: 'active', timeRemainingSeconds: remainingSec, isForced: false };
  } else {
    const breakRemainingSec = Math.max(1, Math.floor((cycleDurationMs - elapsedInCycleMs) / 1000));
    return { status: 'break', timeRemainingSeconds: breakRemainingSec, isForced: false };
  }
}

// Test over a full 60 minute weekday period (e.g. 10:00 AM to 11:00 AM)
const baseWeekday10am = new Date('2026-10-08T09:00:00Z').getTime(); // 10:00 AM Lagos (UTC+1)

let activeCoverageCount = 0;
for (let minute = 0; minute < 60; minute++) {
  const testTime = baseWeekday10am + minute * 60 * 1000;
  const states = halls.map((h) => computeHallState(h, testTime));
  const activeCount = states.filter((s) => s.status === 'active').length;
  if (activeCount >= 1) {
    activeCoverageCount++;
  }
}

console.log(`Active lecture coverage: ${activeCoverageCount}/60 minutes have active classes.`);
assert(activeCoverageCount === 60, '100% campus active class coverage: at least 1-2 lecture halls are always active every minute during class hours');

// 3. Check individual hall staggered behavior
const stateColfhec_0 = computeHallState('colfhec-lecture-hall', baseWeekday10am + 2 * 60000); // 10:02
const stateColfhec_13 = computeHallState('colfhec-lecture-hall', baseWeekday10am + 13 * 60000); // 10:13 (in 3-min break)
const stateCLT_13 = computeHallState('central-lecture-hall', baseWeekday10am + 13 * 60000); // 10:13 (CLT is active!)

assert(stateColfhec_0.status === 'active', 'COLFHEC is active at minute 02 of cycle');
assert(stateColfhec_13.status === 'break', 'COLFHEC is in break at minute 13 of cycle');
assert(stateColfhec_13.timeRemainingSeconds <= 120, 'COLFHEC break countdown is ~2 minutes');
assert(stateCLT_13.status === 'active', 'While COLFHEC is in break, Central Lecture Theatre is active (staggered overlap)');

// 4. Developer Force Lecture Override
console.log('\n--- 3. Force Lecture Override ---');
const forcedState = computeHallState('colfhec-lecture-hall', baseWeekday10am, 'true');
assert(forcedState.status === 'active', 'forceLecture=true immediately activates lecture');
assert(forcedState.isForced === true, 'isForced flag set correctly');
assert(forcedState.timeRemainingSeconds > 9000, 'Forced lecture provides continuous active status');

// 5. Normalization tests
console.log('\n--- 4. Location ID Normalization ---');
function normalizeHall(s) {
  if (!s) return 'colfhec-lecture-hall';
  const l = s.toLowerCase();
  if (l.includes('central') || l.includes('clt') || l.includes('eng') || l.includes('203')) return 'central-lecture-hall';
  if (l.includes('colbios') || l.includes('bio') || l.includes('205')) return 'colbios-lecture-hall';
  return 'colfhec-lecture-hall';
}

assert(normalizeHall('lecture-hall-colfhec') === 'colfhec-lecture-hall', 'lecture-hall-colfhec -> colfhec-lecture-hall');
assert(normalizeHall('lecture-hall-central') === 'central-lecture-hall', 'lecture-hall-central -> central-lecture-hall');
assert(normalizeHall('lecture-hall-colbios') === 'colbios-lecture-hall', 'lecture-hall-colbios -> colbios-lecture-hall');
assert(normalizeHall('funaab-fst-201') === 'colfhec-lecture-hall', 'funaab-fst-201 -> colfhec-lecture-hall');
assert(normalizeHall('funaab-eng-203') === 'central-lecture-hall', 'funaab-eng-203 -> central-lecture-hall');
assert(normalizeHall('funaab-bio-205') === 'colbios-lecture-hall', 'funaab-bio-205 -> colbios-lecture-hall');

console.log('\n==================================================');
console.log(`SCHEDULE LOGIC TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
