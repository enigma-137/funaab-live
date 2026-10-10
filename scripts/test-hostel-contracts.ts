import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HOSTEL_SHOP, ROOM_ANCHORS } from '../src/config/hostelShop';
import { CAMPUS_JOBS } from '../src/config/campusJobs';
const sql=fs.readFileSync('supabase/migrations/007_hostel_life.sql','utf8');
assert.equal(new Set(HOSTEL_SHOP.map(i=>i.id)).size,HOSTEL_SHOP.length);
for(const i of HOSTEL_SHOP)assert(sql.includes(`('${i.id}','${i.name}','${i.category}',${i.price},'${i.placementType}',${i.credit},${i.consumable})`),i.id+' must match trusted catalogue');
const transitSql=fs.readFileSync('supabase/migrations/009_campus_transit.sql','utf8');
for(const j of CAMPUS_JOBS){assert(sql.includes(`('${j.id}','${j.title}',${j.reward},`));assert(transitSql.includes(`source_x=${j.sourcePos[0]},source_z=${j.sourcePos[2]},dest_x=${j.destinationPos[0]},dest_z=${j.destinationPos[2]} where id='${j.id}'`),j.id+' must match relocated trusted job config');}
for(const a of ROOM_ANCHORS)assert(sql.includes(`'${a.id}'`));
assert(!fs.readFileSync('src/stores/jobStore.ts','utf8').includes('grantJobReward'));
assert(fs.readFileSync('src/ui/GameHUD.tsx','utf8').includes('const playerPos = useGameStore.getState().myPosition'));
assert(!fs.readFileSync('src/stores/hostelStore.ts','utf8').includes('localStorage'));
console.log('HOSTEL CONTRACTS PASSED: catalogue prices, job routes/rewards, anchor IDs, live HUD position and persistent source of truth.');
