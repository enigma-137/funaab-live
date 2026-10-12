import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import {locationById,CAR_PARK_BAY} from '../src/config/campusLocations';
import {fareFor} from '../src/config/kekeRoutes';
import {advanceKekeElapsed,createKeke,tickKeke} from '../src/config/kekeSimulation';
class Socket{static OPEN=1;readyState=1;messages:any[]=[];handlers:Record<string,Function>={};accept(){}addEventListener(e:string,f:Function){this.handlers[e]=f;}send(s:string){this.messages.push(JSON.parse(s));}close(){this.readyState=3;this.handlers.close?.();}async packet(p:object){await this.handlers.message({data:JSON.stringify(p)});}}
async function main(){
 const oldWS=globalThis.WebSocket,oldFetch=globalThis.fetch,oldInterval=globalThis.setInterval,oldNow=Date.now;
 (globalThis as any).WebSocket=Socket;(globalThis as any).setInterval=()=>0;
 let now=oldNow();Date.now=()=>now;
 const ledger=new Map<string,any>(),calls:any[]=[],pending=new Map<string,any>();let fail=false;
 const storage={put:async(k:string,v:any)=>pending.set(k,v),delete:async(k:string)=>pending.delete(k),setAlarm:async()=>{},list:async({prefix}:any)=>new Map([...pending].filter(([k])=>k.startsWith(prefix)))};
 globalThis.fetch=async(url:any,init:any)=>{const body=JSON.parse(init.body);calls.push({url:String(url),body});
  if(String(url).endsWith('keke_reserve_trusted')){if(fail)return new Response(JSON.stringify({message:'Insufficient balance'}),{status:400});ledger.set(body.p_ticket,{...body,status:'reserved'});return new Response(JSON.stringify({balance:5000-body.p_fare}));}
  if(String(url).endsWith('keke_settle_trusted')){const t=ledger.get(body.p_ticket);if(t?.status==='reserved')t.status=body.p_action;}
  return new Response('true');};
 try{
  const fastKeke=createKeke(false),steppedKeke=createKeke(false),catchupStart=now;
  advanceKekeElapsed(fastKeke,catchupStart,catchupStart+60300);
  for(let step=1;step<=603;step++)tickKeke(steppedKeke,catchupStart+step*100,.1);
  assert.equal(fastKeke.currentWaypointIndex,steppedKeke.currentWaypointIndex,'Elapsed-time route catch-up reaches the same waypoint');
  assert.equal(fastKeke.phase,steppedKeke.phase,'Elapsed-time route catch-up preserves stop phases');
  assert(Math.hypot(fastKeke.position[0]-steppedKeke.position[0],fastKeke.position[2]-steppedKeke.position[2])<5,'Elapsed-time route catch-up stays within one second of fixed-step simulation');
  const longOfflineKeke=createKeke(false);
  advanceKekeElapsed(longOfflineKeke,catchupStart,catchupStart+30*24*60*60*1000);
  assert(Number.isFinite(longOfflineKeke.position[0])&&longOfflineKeke.currentWaypointIndex>=0,'Long idle catch-up remains bounded to route events');
  const w:any=new WorldRoomDO({storage} as any,{ENABLE_GUEST_MODE:'true',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SUPABASE_URL:'https://transit.invalid'} as any);
  async function join(n:number,near=true){const socket=new Socket();await w.handleSession(socket,null,'world:funaab:main');await socket.packet({type:'join',player:{id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,username:`Student${n}`,position:[7,0,78]}});const session=w.sessions.get(socket);if(near){session.trustedPosition=[...CAR_PARK_BAY];session.trustedAt=now;w.players.get(session.connectionId).position=[...CAR_PARK_BAY];}return socket;}
  const a=await join(1),b=await join(2),c=await join(3),d=await join(4),far=await join(5,false);
  const request=(socket:Socket,destinationId='library',extra={})=>socket.packet({type:'keke_book',requestId:crypto.randomUUID(),kekeId:'keke-carpark',destinationId,...extra});
  await request(far);assert(far.messages.at(-1).error.includes('closer'));assert.equal(ledger.size,0);
  await request(a,'fake');assert(a.messages.at(-1).error.includes('Choose'));assert.equal(ledger.size,0);
  fail=true;await request(a);assert(a.messages.at(-1).error.includes('balance'));assert.equal(w.kekes.get('keke-carpark').phase,'IDLE');fail=false;
  await request(a,'library',{fare:0,position:[20,0,12]});const k=w.kekes.get('keke-carpark');assert.equal(k.phase,'BOARDING');assert.equal(k.passengers.length,1);
  assert.equal([...ledger.values()][0].p_fare,fareFor('library'));
  await request(b,'colvet');await request(c,'coleng');assert.equal(k.destinationId,'library');assert.equal(k.passengers.length,3);
  await request(d);assert(d.messages.at(-1).error.includes('full'));assert.equal(ledger.size,3);
  await request(a);assert.equal(ledger.size,3,'retry cannot charge twice');
  await a.packet({type:'move',position:[100,0,-100],kekeRiding:false,kekeId:'fake'});assert(w.players.get(w.sessions.get(a).connectionId).kekeRiding);
  const phase=k.phase;await a.packet({type:'keke_complete',destinationId:'library'});assert.equal(k.phase,phase);
  const late=await join(6);assert.equal(late.messages.find(m=>m.type==='snapshot').kekes['keke-carpark'].passengers.length,3);
  for(let i=0;i<6000&&k.phase!=='ARRIVED';i++){now+=100;w.tickKekeSimulation();}await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(k.phase,'ARRIVED');assert.deepEqual(k.position,locationById('library').kekeStop);assert.equal(k.passengers.length,0);
  assert(a.messages.some(m=>m.type==='keke_dropoff'));assert(b.messages.some(m=>m.type==='keke_dropoff'));assert([...ledger.values()].every(t=>t.status==='complete'));
  now+=6000;w.tickKekeSimulation();now+=3000;w.tickKekeSimulation();assert.equal(k.phase,'IDLE');
  const s=w.sessions.get(d);s.trustedAt=now;await request(d,'colvet');assert.equal(k.passengers.length,1);d.close();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(k.passengers.length,0);assert([...ledger.values()].some(t=>t.status==='refund'));
  const lateSession=w.sessions.get(late);lateSession.trustedAt=now;await request(late,'colvet');
  assert.equal([...ledger.values()].filter(t=>t.status==='reserved').length,1);
  const recovered:any=new WorldRoomDO({storage} as any,{ENABLE_GUEST_MODE:'true',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SUPABASE_URL:'https://transit.invalid'} as any);
  await recovered.alarm();assert.equal([...ledger.values()].filter(t=>t.status==='reserved').length,1,'Active ride recovery grace period');
  now+=600001;await recovered.alarm();assert.equal([...ledger.values()].filter(t=>t.status==='reserved').length,0,'Worker restart refunds abandoned reservation');
  assert.equal(pending.size,0);assert.equal(recovered.kekes.get('keke-carpark').phase,'IDLE');
  const savedSimulation=new Map<string,any>();
  const simulationStorage={
   get:async(key:string)=>savedSimulation.get(key),
   put:async(key:string,value:any)=>savedSimulation.set(key,value),
   delete:async(key:string)=>savedSimulation.delete(key),
   setAlarm:async()=>{},
   list:async()=>new Map(),
  };
  const source:any=new WorldRoomDO({storage:simulationStorage} as any,{ENABLE_GUEST_MODE:'true'} as any);
  source.tickKekeSimulation();
  await source.persistAutonomousKeke();
  const savedPosition=[...source.kekes.get('keke-1').position];
  now+=10000;
  const restoredSimulation:any=new WorldRoomDO({storage:simulationStorage} as any,{ENABLE_GUEST_MODE:'true'} as any);
  const resumed=new Socket();await restoredSimulation.handleSession(resumed,null,'world:funaab:main');
  await resumed.packet({type:'join',player:{id:'00000000-0000-4000-8000-000000000007',username:'Student7',position:[7,0,78]}});
  const resumedPosition=restoredSimulation.kekes.get('keke-1').position;
  assert(Math.hypot(resumedPosition[0]-savedPosition[0],resumedPosition[2]-savedPosition[2])>1,'The autonomous route advances by elapsed time while the room is empty');
  resumed.close();await new Promise(resolve=>setTimeout(resolve,0));
  const disconnectedPosition=[...restoredSimulation.kekes.get('keke-1').position];
  now+=5000;
  const resumedAgain=new Socket();await restoredSimulation.handleSession(resumedAgain,null,'world:funaab:main');
  await resumedAgain.packet({type:'join',player:{id:'00000000-0000-4000-8000-000000000008',username:'Student8',position:[7,0,78]}});
  const reconnectedPosition=restoredSimulation.kekes.get('keke-1').position;
  assert(Math.hypot(reconnectedPosition[0]-disconnectedPosition[0],reconnectedPosition[2]-disconnectedPosition[2])>1,'An in-memory room advances the saved route after disconnect and reconnect');
  resumedAgain.close();await new Promise(resolve=>setTimeout(resolve,0));
  console.log('KEKE WORKER PASSED: server proximity, spoofed fare/destination, unpaid rejection, payment failure, 3 seats, shared destination, duplicate requests, authoritative movement, late join, arrival/dropoff, reset, disconnect refund and durable restart recovery.');
 }finally{Date.now=oldNow;globalThis.fetch=oldFetch;globalThis.WebSocket=oldWS;globalThis.setInterval=oldInterval;}
}
main().catch(e=>{console.error(e);process.exit(1);});
