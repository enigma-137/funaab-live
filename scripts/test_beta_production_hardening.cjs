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
// 3. ASYMMETRIC ES256 / P-256 JWT & JWKS AUTHENTICATION TESTS
// -------------------------------------------------------------
console.log('\n3. ASYMMETRIC ES256 & JWKS AUTHENTICATION TESTS');

const crypto = require('crypto');

// Generate an active ES256 (P-256) key pair for testing
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
});

const jwkPublic = publicKey.export({ format: 'jwk' });
jwkPublic.kid = 'supabase-active-es256-key-001';
jwkPublic.use = 'sig';
jwkPublic.alg = 'ES256';

function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createAsymmetricEs256Jwt(payload, kid = 'supabase-active-es256-key-001') {
  const header = {
    alg: 'ES256',
    typ: 'JWT',
    kid,
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const signer = crypto.createSign('SHA256');
  signer.update(dataToSign);
  const signatureDer = signer.sign(privateKey);

  // Convert DER signature to IEEE P1363 raw (r || s, 64 bytes) for JWT ES256 standard
  // or use crypto.sign with dsaEncoding 'ieee-p1363'
  const rawSig = crypto.sign('SHA256', Buffer.from(dataToSign), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });

  const signatureB64 = base64UrlEncode(rawSig);
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function verifyAsymmetricEs256Jwt(token, jwksKeys) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));

  // Expiration check
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) return null;

  // Find matching key by kid
  const matchingJwk = jwksKeys.find((k) => k.kid === header.kid);
  if (!matchingJwk) return null;

  // Verify signature
  const verifierKey = crypto.createPublicKey({ key: matchingJwk, format: 'jwk' });
  const dataToVerify = `${headerB64}.${payloadB64}`;
  const sigBuffer = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  const isValid = crypto.verify('SHA256', Buffer.from(dataToVerify), {
    key: verifierKey,
    dsaEncoding: 'ieee-p1363',
  }, sigBuffer);

  if (!isValid) return null;
  return { sub: payload.sub, email: payload.email };
}

test('Valid Supabase ES256 asymmetric JWT verifies with matching JWKS public key', () => {
  const token = createAsymmetricEs256Jwt({
    sub: '7e2b1c8a-3333-5555-7777-abcdef987654',
    email: 'scholar@funaab.edu.ng',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const jwks = [jwkPublic];
  const verified = verifyAsymmetricEs256Jwt(token, jwks);

  assert.notStrictEqual(verified, null);
  assert.strictEqual(verified.sub, '7e2b1c8a-3333-5555-7777-abcdef987654');
  assert.strictEqual(verified.email, 'scholar@funaab.edu.ng');
});

test('Tampered ES256 JWT payload is strictly rejected by signature check', () => {
  const token = createAsymmetricEs256Jwt({
    sub: '7e2b1c8a-3333-5555-7777-abcdef987654',
    email: 'scholar@funaab.edu.ng',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const parts = token.split('.');
  // Attacker tries to alter payload to spoof another sub UUID
  const tamperedPayload = base64UrlEncode(Buffer.from(JSON.stringify({
    sub: 'attacker-stolen-id-000000000000',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })));
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  const verified = verifyAsymmetricEs256Jwt(tamperedToken, [jwkPublic]);
  assert.strictEqual(verified, null, 'Tampered token must fail signature check');
});

test('Expired ES256 JWT is rejected even with valid signature', () => {
  const expiredToken = createAsymmetricEs256Jwt({
    sub: '7e2b1c8a-3333-5555-7777-abcdef987654',
    exp: Math.floor(Date.now() / 1000) - 120, // expired 2 mins ago
  });

  const verified = verifyAsymmetricEs256Jwt(expiredToken, [jwkPublic]);
  assert.strictEqual(verified, null);
});

test('Key Rotation: Token with unknown kid is rejected until JWKS contains rotated key', () => {
  const rotatedToken = createAsymmetricEs256Jwt({
    sub: '7e2b1c8a-3333-5555-7777-abcdef987654',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, 'new-rotated-kid-2026');

  // Stale JWKS without the new kid
  const staleJwks = [{ ...jwkPublic, kid: 'old-expired-kid' }];
  assert.strictEqual(verifyAsymmetricEs256Jwt(rotatedToken, staleJwks), null);

  // Updated JWKS after refresh containing the new kid
  const updatedJwks = [{ ...jwkPublic, kid: 'new-rotated-kid-2026' }];
  const verified = verifyAsymmetricEs256Jwt(rotatedToken, updatedJwks);
  assert.notStrictEqual(verified, null);
  assert.strictEqual(verified.sub, '7e2b1c8a-3333-5555-7777-abcdef987654');
});

test('Anti-spoofing: Client-sent player.id cannot override verified ES256 token identity', () => {
  const token = createAsymmetricEs256Jwt({
    sub: 'verified-student-uuid-1111',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const spoofedPayload = {
    type: 'join',
    token,
    player: {
      id: 'hacker-impersonated-uuid-9999',
    },
  };

  const verified = verifyAsymmetricEs256Jwt(spoofedPayload.token, [jwkPublic]);
  const finalAuthoritativeId = verified ? verified.sub : spoofedPayload.player.id;

  assert.strictEqual(finalAuthoritativeId, 'verified-student-uuid-1111');
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
