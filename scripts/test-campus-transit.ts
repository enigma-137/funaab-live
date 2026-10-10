import assert from 'node:assert/strict';
import { campusLocations,locationById,CAMPUS_SPAWN,CAR_PARK_BAY } from '../src/config/campusLocations';
import { roadEdges,roadNodes,roadPath,nodeKey,canAdvance,publicRoute,fareFor,campusObstacles } from '../src/config/kekeRoutes';
import { createKeke,bookRide,tickKeke } from '../src/config/kekeSimulation';
import {classifyTerrain} from '../src/game/rules/lawnSecuritySystem';
for(const id of ['colvet','colanim','colplant','colerm','colcoms','library'])assert(locationById(id));
assert(!publicRoute.some(p=>nodeKey(p)===nodeKey(CAR_PARK_BAY)),'Public route must not enter booked bay');
assert.equal(new Set(campusLocations.map(l=>l.id)).size,campusLocations.length);
assert(!classifyTerrain(CAMPUS_SPAWN[0],CAMPUS_SPAWN[2]).restricted);
for(const [a,b] of roadEdges)assert(canAdvance(roadNodes[a],roadNodes[b]),`Blocked road ${a} → ${b}`);
for(let i=0;i<publicRoute.length;i++)assert(canAdvance(publicRoute[i],publicRoute[(i+1)%publicRoute.length]),`Unsafe route ${publicRoute[i]} → ${publicRoute[(i+1)%publicRoute.length]}`);
for(const l of campusLocations){
 if(l.mapVisible)assert(publicRoute.some(p=>nodeKey(p)===nodeKey(l.kekeStop)),`Public route must serve ${l.id}`);
 const path=roadPath(nodeKey(CAR_PARK_BAY),nodeKey(l.kekeStop));assert(path.length>0);
 assert(fareFor(l.id)>=30&&fareFor(l.id)<=120);
 assert(!classifyTerrain(l.entrance[0],l.entrance[2]).restricted,`Inaccessible ${l.id}`);
 if(l.id==='car-park')continue;
 const k=createKeke(true);bookRide(k,l.id,0,'trip');let now=0,arrived=false;
 for(let i=0;i<20000;i++){now+=100;if(tickKeke(k,now,.1)){arrived=true;break;}assert.notEqual(k.phase,'BLOCKED',l.id);}
 assert(arrived,`Never arrived ${l.id}`);assert.deepEqual(k.position,l.kekeStop);
 tickKeke(k,now+5001,.1);tickKeke(k,now+8000,.1);assert.equal(k.phase,'IDLE');
}
const a=roadNodes[roadEdges[0][0]],b=roadNodes[roadEdges[0][1]],midX=(a[0]+b[0])/2,midZ=(a[2]+b[2])/2;
assert(!canAdvance(a,b,[{id:'unexpected-obstacle',minX:midX-1,maxX:midX+1,minZ:midZ-1,maxZ:midZ+1}]));
for(let i=0;i<campusObstacles.length;i++)for(let j=i+1;j<campusObstacles.length;j++){
 const a=campusObstacles[i],b=campusObstacles[j];
 assert(!(a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ),`Overlapping footprints: ${a.id}, ${b.id}`);
}
console.log(`CAMPUS TRANSIT PASSED: ${campusLocations.length} locations, ${roadEdges.length} legal road edges, all direct routes, full public loop, fare bounds, obstacle stop and reset.`);
