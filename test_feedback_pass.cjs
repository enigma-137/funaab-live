// Verification test script for Public Beta Feedback Pass (P0 & P1 fixes)
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🧪 VERIFYING PUBLIC BETA HARDENING & FEEDBACK FIXES');
console.log('====================================================');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
  }
}

// 1. Verify Migration 003 exists and contains ensure_player_wallet & self-healing transfer_money_p2p
const mig3Path = path.join(__dirname, 'supabase', 'migrations', '003_public_beta_feedback_pass.sql');
assert(fs.existsSync(mig3Path), 'Migration 003 SQL file exists');

const mig3Content = fs.readFileSync(mig3Path, 'utf8').toLowerCase();
assert(mig3Content.includes('function public.ensure_player_wallet'), 'Migration 003 defines ensure_player_wallet');
assert(mig3Content.includes('function public.transfer_money_p2p'), 'Migration 003 defines self-healing transfer_money_p2p');
assert(mig3Content.includes('auth.uid()'), 'transfer_money_p2p enforces auth.uid() sender authority');
assert(mig3Content.includes('starter_balance_granted_at'), 'Migration 003 tracks persistent starter balance grant');

// 2. Verify WalletStore bootstrap integration
const walletStorePath = path.join(__dirname, 'src', 'stores', 'walletStore.ts');
const walletStoreContent = fs.readFileSync(walletStorePath, 'utf8');
assert(walletStoreContent.includes('ensure_player_wallet'), 'walletStore calls ensure_player_wallet RPC');

// 3. Verify SocialStore session persistence for DMs
const socialStorePath = path.join(__dirname, 'src', 'stores', 'socialStore.ts');
const socialStoreContent = fs.readFileSync(socialStorePath, 'utf8');
assert(socialStoreContent.includes('sessionStorage'), 'socialStore persists DMs in sessionStorage');
assert(socialStoreContent.includes('funaab_session_dms'), 'socialStore uses funaab_session_dms cache key');

// 4. Verify Nametag overlap fix in AvatarModel
const avatarPath = path.join(__dirname, 'src', 'game', 'player', 'AvatarModel.tsx');
const avatarContent = fs.readFileSync(avatarPath, 'utf8');
assert(avatarContent.includes('isModalOpen'), 'AvatarModel checks isModalOpen');
assert(avatarContent.includes('activeModal !== null'), 'AvatarModel hides nametag when any modal is open');

// 5. Verify World scale and expanded footprint
const worldPath = path.join(__dirname, 'src', 'worlds', 'funaab', 'world.json');
const worldData = JSON.parse(fs.readFileSync(worldPath, 'utf8'));
assert(worldData.bounds.minX === -95 && worldData.bounds.maxX === 95, 'World bounds expanded to ±95m');
assert(worldData.kekeRoutes[0].waypoints.length >= 15, 'Keke waypoints complete circuit around expanded campus');

// 6. Verify FUTURE_FEATURES.md contains postponed hostel customization
const futurePath = path.join(__dirname, 'FUTURE_FEATURES.md');
assert(fs.existsSync(futurePath), 'FUTURE_FEATURES.md exists');
const futureContent = fs.readFileSync(futurePath, 'utf8');
assert(futureContent.includes('Hostel Room Personalization & Furniture Decoration'), 'Hostel decoration explicitly recorded as postponed future feature');

console.log('====================================================');
console.log(`📊 TEST RESULTS: ${passed}/${total} assertions passed`);
console.log('====================================================');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
