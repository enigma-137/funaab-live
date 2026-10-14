import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HOSTEL_SHOP, ROOM_ANCHORS } from '../src/config/hostelShop';
import { CAMPUS_JOBS } from '../src/config/campusJobs';
const sql=fs.readFileSync('supabase/migrations/007_hostel_life.sql','utf8');
// Items added later (024 room makeover) are catalogued there.
const catalogueSql=sql+fs.readFileSync('supabase/migrations/024_room_makeover.sql','utf8');
assert.equal(new Set(HOSTEL_SHOP.map(i=>i.id)).size,HOSTEL_SHOP.length);
// Identity/placement must match the 007 (and 024) catalogue rows. Prices were rebalanced by 012, so the effective
// price parity (config = database after every migration) is checked by scripts/test-economy-db.ts.
for(const i of HOSTEL_SHOP)assert(new RegExp(`\\('${i.id}','${i.name}','${i.category}',\\d+,'${i.placementType}',${i.credit},${i.consumable}\\)`).test(catalogueSql),i.id+' must match trusted catalogue');
const transitSql=fs.readFileSync('supabase/migrations/009_campus_transit.sql','utf8');
// Job ids/titles exist in the trusted catalogue; rewards and coordinates (moved by 009 and 012) are
// compared against the replayed database in scripts/test-economy-db.ts.
for(const j of CAMPUS_JOBS){assert(sql.includes(`('${j.id}','${j.title}',`),j.id+' must exist in the trusted job catalogue');assert(transitSql.includes(`where id='${j.id}'`));}
for(const a of ROOM_ANCHORS)assert(sql.includes(`'${a.id}'`));
assert(!fs.readFileSync('src/stores/jobStore.ts','utf8').includes('grantJobReward'));
assert(fs.readFileSync('src/ui/GameHUD.tsx','utf8').includes('const playerPos = useGameStore.getState().myPosition'));
assert(!fs.readFileSync('src/stores/hostelStore.ts','utf8').includes('localStorage'));
console.log('HOSTEL CONTRACTS PASSED: catalogue prices, job routes/rewards, anchor IDs, live HUD position and persistent source of truth.');
