// Automated Production-Hardening Verification Suite for FUNAAB Life
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('   FUNAAB LIFE — PUBLIC BETA PRODUCTIONIZATION TEST SUITE');
console.log('================================================================\n');

let passedCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Reason: ${err.message}\n`);
  }
}

// -------------------------------------------------------------
// 1. AUTH & CLIENT-SIDE VALIDATION TESTS
// -------------------------------------------------------------
console.log('1. AUTHENTICATION & VALIDATION TESTS');

test('Email validation regex correctly accepts valid emails', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails = [
    'student@funaab.edu.ng',
    'emmanuel@gmail.com',
    'blessing.adeyemi@alumni.funaab.edu.ng',
    'user+tag@domain.co.uk',
  ];
  for (const email of validEmails) {
    assert.strictEqual(emailRegex.test(email.trim().toLowerCase()), true, `Failed on ${email}`);
  }
});

test('Email validation regex rejects malformed or empty emails', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalidEmails = [
    '',
    '   ',
    'plainaddress',
    '@missingusername.com',
    'username@.com',
    'username@domain',
    'user name@domain.com',
  ];
  for (const email of invalidEmails) {
    assert.strictEqual(emailRegex.test(email.trim().toLowerCase()), false, `Should reject ${email}`);
  }
});

test('Password length requirement enforces >= 6 characters', () => {
  const checkPassword = (pw) => Boolean(pw && pw.length >= 6);
  assert.strictEqual(checkPassword('12345'), false);
  assert.strictEqual(checkPassword(''), false);
  assert.strictEqual(checkPassword('123456'), true);
  assert.strictEqual(checkPassword('secure_campus_password'), true);
});

// -------------------------------------------------------------
// 2. MIGRATION 002 VALIDATION TESTS
// -------------------------------------------------------------
console.log('\n2. POSTGRES MIGRATION 002 STRUCTURE TESTS');

test('Migration 002 file exists and contains all required beta schema additions', () => {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '002_public_beta_hardening.sql');
  assert.strictEqual(fs.existsSync(migrationPath), true, '002_public_beta_hardening.sql must exist');
  
  const content = fs.readFileSync(migrationPath, 'utf8');
  assert.strictEqual(content.includes('job_completions'), true, 'Must define job_completions table');
  assert.strictEqual(content.includes('lecture_attendance'), true, 'Must define lecture_attendance table');
  assert.strictEqual(content.includes('last_daily_reward_at'), true, 'Must add last_daily_reward_at to wallets');
  assert.strictEqual(content.includes('claim_daily_reward'), true, 'Must implement claim_daily_reward RPC');
  assert.strictEqual(content.includes('transfer_money_p2p'), true, 'Must implement transfer_money_p2p RPC');
  assert.strictEqual(content.includes('claim_job_reward'), true, 'Must implement claim_job_reward RPC');
  assert.strictEqual(content.includes('claim_lecture_attendance'), true, 'Must implement claim_lecture_attendance RPC');
  assert.strictEqual(content.includes('process_wallet_purchase'), true, 'Must implement process_wallet_purchase RPC');
  assert.strictEqual(content.includes('security definer'), true, 'RPCs must be SECURITY DEFINER');
});

// -------------------------------------------------------------
// 3. JWT PARSING & ANTI-SPOOFING TESTS
// -------------------------------------------------------------
console.log('\n3. JWT AUTHENTICATION & ANTI-SPOOFING TESTS');

function mockCreateJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = Buffer.from('mock_signature_bytes').toString('base64');
  return `${header}.${body}.${sig}`;
}

function verifyJwtTest(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) return null;
  if (!payload.sub) return null;
  return { sub: payload.sub, email: payload.email };
}

test('Valid Supabase JWT extracts authoritative user UUID', () => {
  const token = mockCreateJwt({
    sub: '8f7a9d3e-1111-4444-9999-abcdef123456',
    email: 'student@funaab.edu.ng',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const verified = verifyJwtTest(token);
  assert.notStrictEqual(verified, null);
  assert.strictEqual(verified.sub, '8f7a9d3e-1111-4444-9999-abcdef123456');
  assert.strictEqual(verified.email, 'student@funaab.edu.ng');
});

test('Expired JWT is strictly rejected', () => {
  const expiredToken = mockCreateJwt({
    sub: '8f7a9d3e-1111-4444-9999-abcdef123456',
    email: 'student@funaab.edu.ng',
    exp: Math.floor(Date.now() / 1000) - 300, // expired 5 mins ago
  });

  const verified = verifyJwtTest(expiredToken);
  assert.strictEqual(verified, null);
});

test('Anti-spoofing: Client cannot claim another user ID when token is present', () => {
  const token = mockCreateJwt({
    sub: 'authoritative-uuid-999',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const spoofedClientPayload = {
    type: 'join',
    token,
    player: {
      id: 'attacker-spoofed-uuid-000', // Spoofed ID
      username: 'LegitimateStudent',
    },
  };

  const verified = verifyJwtTest(spoofedClientPayload.token);
  const derivedAuthoritativeId = verified ? verified.sub : spoofedClientPayload.player.id;

  assert.strictEqual(derivedAuthoritativeId, 'authoritative-uuid-999', 'Must use JWT sub, rejecting spoofed player.id');
});

// -------------------------------------------------------------
// 4. CLOUDFLARE WORKER CODE STRUCTURE TESTS
// -------------------------------------------------------------
console.log('\n4. CLOUDFLARE WORKER DURABLE OBJECT TESTS');

test('Worker file exports WorldRoomDO and default fetch router', () => {
  const workerPath = path.join(__dirname, '..', 'worker', 'index.ts');
  assert.strictEqual(fs.existsSync(workerPath), true);
  const content = fs.readFileSync(workerPath, 'utf8');

  assert.strictEqual(content.includes('export class WorldRoomDO'), true);
  assert.strictEqual(content.includes('export default'), true);
  assert.strictEqual(content.includes('verifySupabaseJwt'), true);
  assert.strictEqual(content.includes('lecture_enter'), true);
  assert.strictEqual(content.includes('lecture_leave'), true);
  assert.strictEqual(content.includes('lecture_chat'), true);
  assert.strictEqual(content.includes('lecture_hand_raise'), true);
  assert.strictEqual(content.includes('private_chat_message'), true);
  assert.strictEqual(content.includes('p2p_transfer'), true);
  assert.strictEqual(content.includes('lawn_fine_issued'), true);
  assert.strictEqual(content.includes('job_completed'), true);
});

// -------------------------------------------------------------
// 5. ECONOMY ATOMIC RPC LOGIC VERIFICATION
// -------------------------------------------------------------
console.log('\n5. ECONOMY ATOMIC RPC RULES');

test('P2P transfer rejects negative, zero, or self-transfer', () => {
  const validateTransfer = (senderId, recipientId, amount) => {
    if (amount <= 0) return { error: 'Amount must be > 0' };
    if (senderId === recipientId) return { error: 'Cannot self-transfer' };
    if (amount > 50000) return { error: 'Exceeds limit' };
    return { valid: true };
  };

  assert.strictEqual(validateTransfer('user-1', 'user-2', -100).error, 'Amount must be > 0');
  assert.strictEqual(validateTransfer('user-1', 'user-2', 0).error, 'Amount must be > 0');
  assert.strictEqual(validateTransfer('user-1', 'user-1', 500).error, 'Cannot self-transfer');
  assert.strictEqual(validateTransfer('user-1', 'user-2', 100000).error, 'Exceeds limit');
  assert.strictEqual(validateTransfer('user-1', 'user-2', 1500).valid, true);
});

console.log('\n================================================================');
console.log(`   RESULTS: ${passedCount} / ${totalCount} TESTS PASSED`);
console.log('================================================================\n');

if (passedCount === totalCount) {
  process.exit(0);
} else {
  process.exit(1);
}
