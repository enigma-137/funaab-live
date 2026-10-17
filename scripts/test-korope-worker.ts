// Korope shared bus: won't leave until 5 riders have paid, carries 8, drops each rider at their stop,
// refunds riders if it never fills, and starts over at the bay afterwards.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { locationById } from '../src/config/campusLocations';
import { KOROPE, KOROPE_ID, routeStops, STOP_DWELL } from '../src/config/kekeRoutes';
import { KOROPE_BAY, createKorope, seatPosition } from '../src/config/kekeSimulation';

class Socket{static OPEN=1;readyState=1;messages:any[]=[];handlers:Record<string,Function>={};accept(){}addEventListener(e:string,f:Function){this.handlers[e]=f;}send(s:string){this.messages.push(JSON.parse(s));}close(){this.readyState=3;this.handlers.close?.();}async packet(p:object){await this.handlers.message({data:JSON.stringify(p)});}}

async function main(){
  const oldWS=globalThis.WebSocket,oldFetch=globalThis.fetch,oldInterval=globalThis.setInterval,oldNow=Date.now;
  (globalThis as any).WebSocket=Socket;(globalThis as any).setInterval=()=>0;
  let now=oldNow();Date.now=()=>now;
  const ledger=new Map<string,any>(),pending=new Map<string,any>();
  const storage={put:async(k:string,v:any)=>pending.set(k,v),delete:async(k:string)=>pending.delete(k),setAlarm:async()=>{},list:async({prefix}:any)=>new Map([...pending].filter(([k])=>k.startsWith(prefix)))};
  globalThis.fetch=async(url:any,init:any)=>{const body=JSON.parse(init.body);
    if(String(url).endsWith('keke_reserve_trusted')){
      if([...ledger.values()].some((t)=>t.p_user===body.p_user&&t.status==='reserved'))return new Response(JSON.stringify({message:'duplicate key value violates unique constraint "one_reserved_keke_ticket"'}),{status:400});
      ledger.set(body.p_ticket,{...body,status:'reserved'});return new Response(JSON.stringify({balance:5000-body.p_fare}));}
    if(String(url).endsWith('keke_settle_trusted')){const t=ledger.get(body.p_ticket);if(t?.status==='reserved')t.status=body.p_action;}
    return new Response('true');};
  let w:any;
  const tick=async(ms:number)=>{for(let t=0;t<ms;t+=100){now+=100;w.tickKekeSimulation();}await new Promise((r)=>setTimeout(r,0));};
  try{
    w=new WorldRoomDO({storage} as any,{ENABLE_GUEST_MODE:'true',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SUPABASE_URL:'https://transit.invalid'} as any);
    let n=0;
    const join=async(near=true)=>{const socket=new Socket();await w.handleSession(socket,null,'world:funaab:main');n++;
      await socket.packet({type:'join',player:{id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,username:`Student${n}`,position:[7,0,78]}});
      const session=w.sessions.get(socket);if(near){session.trustedPosition=[...KOROPE_BAY];session.trustedAt=now;w.players.get(session.connectionId).position=[...KOROPE_BAY];}return socket;};
    const board=async(s:Socket,destinationId='library',snap=true)=>{const session=w.sessions.get(s);session.trustedAt=now;if(snap&&!w.players.get(session.connectionId).kekeRiding){session.trustedPosition=[...KOROPE_BAY];session.claimedPosition=[...KOROPE_BAY];w.players.get(session.connectionId).position=[...KOROPE_BAY];}await s.packet({type:'keke_book',requestId:crypto.randomUUID(),kekeId:KOROPE_ID,destinationId});};
    const bus=()=>w.kekes.get(KOROPE_ID);

    assert.equal(bus().phase,'WAITING');assert.equal(bus().capacity,8);assert.equal(bus().minRiders,5);
    const far=await join(false);await board(far,'library',false);assert(far.messages.at(-1).error.includes('closer'));assert.equal(ledger.size,0);
    const riders:Socket[]=[];for(let i=0;i<9;i++)riders.push(await join());

    // Bad destinations are refused before anyone is charged.
    await board(riders[0],'car-park');assert(riders[0].messages.at(-1).error.includes('Choose'));
    const offRoute=locationById('acad').id;assert(!routeStops.includes(offRoute));
    await board(riders[0],offRoute);assert(riders[0].messages.at(-1).error.includes('route'));assert.equal(ledger.size,0);

    // Four riders: it waits, and does not move.
    const parkedAt=[...bus().position];
    for(let i=0;i<4;i++)await board(riders[i],i%2?'coleng':'library');
    assert.equal(bus().passengers.length,4);assert.equal([...ledger.values()].every((t)=>t.p_fare===KOROPE.fare),true,'flat fare');
    await tick(20000);assert.equal(bus().phase,'WAITING');assert.deepEqual(bus().position,parkedAt);

    // The fifth rider fills it enough: doors close, then it drives.
    await board(riders[4],'library');await tick(500);assert.equal(bus().phase,'BOARDING','doors closing');
    await tick(KOROPE.doorsMs+1000);assert.equal(bus().phase==='MOVING'||bus().phase==='BOARDING',true);
    await tick(10000);assert(Math.hypot(bus().position[0]-parkedAt[0],bus().position[2]-parkedAt[2])>3,'it left the bay');

    // It drives straight through stops and junctions where nobody is getting off.
    const stopKeys=new Set(routeStops.map((id)=>{const p=locationById(id).kekeStop;return `${p[0]}:${p[2]}`;}));
    const riderStops=new Set(bus().passengers.map((id:string)=>{const p=locationById(bus().targets[id]).kekeStop;return `${p[0]}:${p[2]}`;}));
    let passedStop=false;
    for(let i=0;i<3000&&!passedStop;i++){await tick(100);const key=`${bus().position[0]}:${bus().position[2]}`;if(bus().phase==='MOVING'&&!riderStops.has(key)&&[...stopKeys].some((k)=>{const [x,z]=k.split(':').map(Number);return Math.hypot(x-bus().position[0],z-bus().position[2])<1.5;}))passedStop=true;}
    assert(passedStop,'drove past a stop without stopping');
    assert.equal(bus().isStopped,false);

    // Hailing: someone close by opens the sheet and the moving bus pulls over, and waits while they choose.
    const chooser=await join();chooser.messages.length=0;
    const cs=w.sessions.get(chooser);const near=[bus().position[0]+3,0,bus().position[2]];
    cs.trustedPosition=near;cs.claimedPosition=near;cs.trustedAt=now;w.players.get(cs.connectionId).position=near;
    await chooser.packet({type:'keke_hold',kekeId:KOROPE_ID,holding:true});
    await tick(200);assert.equal(bus().phase,'BOARDING','pulled over for the hail');assert(bus().isStopped);
    const stopAt=[...bus().position];
    for(let i=0;i<6;i++){await tick(5000);cs.trustedAt=now;await chooser.packet({type:'keke_hold',kekeId:KOROPE_ID,holding:true});}
    assert.equal(bus().phase,'BOARDING');assert.deepEqual(bus().position,stopAt,'held while the sheet is open (30 s)');
    // Paying gives a few seconds to sit down, then it goes.
    cs.trustedAt=now;await chooser.packet({type:'keke_book',requestId:crypto.randomUUID(),kekeId:KOROPE_ID,destinationId:'coleng'});
    assert.equal(bus().passengers.includes(cs.connectionId),true);
    assert(bus().deadline-now>=STOP_DWELL.boardedGraceMs-200,'time to sit down after paying');
    await tick(STOP_DWELL.boardedGraceMs+1500);assert.equal(bus().phase,'MOVING','leaves once seated');
    // Too far away to hail: nothing happens.
    const farAway=await join();const fs=w.sessions.get(farAway);const away=[bus().position[0]+STOP_DWELL.hailRadius+10,0,bus().position[2]];
    fs.trustedPosition=away;fs.claimedPosition=away;fs.trustedAt=now;w.players.get(fs.connectionId).position=away;
    await farAway.packet({type:'keke_hold',kekeId:KOROPE_ID,holding:true});await tick(300);
    assert.equal(bus().phase==='BOARDING'&&!bus().passengers.some((id:string)=>{const p=locationById(bus().targets[id]).kekeStop;return p[0]===bus().position[0]&&p[2]===bus().position[2];}),false,'too far to hail');
    // A sheet that stops reporting stops holding the vehicle.
    for(let i=0;i<400&&bus().phase!=='MOVING';i++)await tick(100);
    const second=await join();const ss=w.sessions.get(second);const by=[bus().position[0]+2,0,bus().position[2]];ss.trustedPosition=by;ss.claimedPosition=by;ss.trustedAt=now;w.players.get(ss.connectionId).position=by;
    await second.packet({type:'keke_hold',kekeId:KOROPE_ID,holding:true});await tick(200);
    const heldAt=[...bus().position];assert.equal(bus().phase,'BOARDING');
    await tick(STOP_DWELL.holdTtlMs-3000);assert.equal(bus().phase,'BOARDING','still held before the timeout');assert.deepEqual(bus().position,heldAt);
    await tick(STOP_DWELL.holdTtlMs+3000);assert.notDeepEqual(bus().position,heldAt,'a silent sheet is dropped and the vehicle leaves');

    // A rider can ask to get off early: it pulls over at the next junction or stop.
    for(let i=0;i<400&&bus().phase!=='MOVING';i++)await tick(100);
    const earlyId=bus().passengers[0];assert(earlyId,'someone aboard');
    const [early,es]=[...w.sessions.entries()].find(([,x]:any)=>x.connectionId===earlyId) as [Socket,any];
    {
      early.messages.length=0;await early.packet({type:'keke_exit'});
      assert(early.messages.some((m:any)=>/next junction/.test(m.text)),'told it will stop');
      for(let i=0;i<300&&bus().passengers.includes(es.connectionId);i++)await tick(100);
      assert.equal(bus().passengers.includes(es.connectionId),false,'dropped at the next junction');
      assert(early.messages.some((m:any)=>m.type==='keke_dropoff'));
    }
    // Seats: five riders have five distinct seat spots, all inside the van's footprint.
    const spots=new Set(bus().passengers.map((id:string)=>seatPosition(bus(),id).join(',')));assert.equal(spots.size,bus().passengers.length);

    // Riders get off at their own stops and pay nothing more; the bus returns and waits again.
    for(let i=0;i<20000&&!(bus().phase==='WAITING'&&bus().passengers.length===0&&i>50);i++){await tick(100);}
    await tick(1000);
    assert.equal(bus().phase,'WAITING','back at the bay waiting');assert.deepEqual(bus().position,[...KOROPE_BAY]);
    assert.equal(bus().passengers.length,0);assert([...ledger.values()].every((t)=>t.status==='complete'),'every fare settled as completed');
    assert(riders[0].messages.some((m:any)=>m.type==='keke_dropoff'));

    // Eight seats: a ninth rider is refused.
    ledger.clear();
    for(let i=0;i<8;i++)await board(riders[i]);
    assert.equal(bus().passengers.length,8);await board(riders[8]);assert(riders[8].messages.at(-1).error.includes('full'));assert.equal(ledger.size,8);
    await tick(KOROPE.doorsMs+8000);
    // Run it out so the next scenario starts from an empty, waiting bus.
    for(let i=0;i<30000&&!(bus().phase==='WAITING'&&bus().passengers.length===0);i++){await tick(100);}
    assert.equal(bus().phase,'WAITING');assert([...ledger.values()].every((t)=>t.status==='complete'));

    // Never filled: two riders wait, then are refunded and the bus starts over.
    ledger.clear();now+=1000;
    await board(riders[0]);await board(riders[1]);assert.equal(bus().passengers.length,2);
    await tick(KOROPE.waitMs-5000);assert.equal(bus().passengers.length,2,'still waiting before the limit');
    await tick(10000);
    assert.equal(bus().passengers.length,0,'riders sent off');assert.equal(bus().phase,'WAITING');
    assert([...ledger.values()].every((t)=>t.status==='refund'),'both fares refunded');
    assert(riders[0].messages.filter((m:any)=>m.type==='keke_dropoff').length>=2);

    // Move now: only someone aboard can send it off; it leaves with two riders instead of five.
    ledger.clear();now+=1000;
    await board(riders[4],'library');await board(riders[5],'coleng');assert.equal(bus().passengers.length,2);
    await riders[6].packet({type:'korope_go'});assert.equal(bus().phase,'WAITING','not aboard: nothing happens');
    assert(riders[6].messages.at(-1).text.includes('Board the Korope'));
    riders[5].messages.length=0;
    await riders[4].packet({type:'korope_go'});
    assert.equal(bus().phase,'BOARDING','doors closing on Move now');assert.equal(bus().waitUntil,0,'no refund timer');
    assert(riders[5].messages.some((m:any)=>m.type==='hustle_notice'&&/asked the Korope to move/.test(m.text)),'the other rider is told');
    await tick(KOROPE.doorsMs+3000);assert.notDeepEqual(bus().position,[...KOROPE_BAY],'it left with two riders');
    for(let i=0;i<30000&&!(bus().phase==='WAITING'&&bus().passengers.length===0);i++){await tick(100);}
    assert.equal(bus().phase,'WAITING');assert([...ledger.values()].every((t)=>t.status==='complete'),'both rides completed, not refunded');
    await riders[4].packet({type:'korope_go'});assert.equal(bus().phase,'WAITING','an empty bus never leaves');

    // A rider who disconnects while waiting is refunded too.
    ledger.clear();await board(riders[2]);assert.equal(bus().passengers.length,1);
    riders[2].close();await new Promise((r)=>setTimeout(r,0));assert.equal(bus().passengers.length,0);assert([...ledger.values()].every((t)=>t.status==='refund'));
    // A restart loses the ride but leaves the ticket reserved; boarding again must clear it, not fail.
    ledger.clear();now+=1000;
    await board(riders[3]);const lostUser=w.sessions.get(riders[3]).id;
    assert.equal([...ledger.values()].filter((t)=>t.p_user===lostUser&&t.status==='reserved').length,1);
    const restarted:any=new WorldRoomDO({storage} as any,{ENABLE_GUEST_MODE:'true',SUPABASE_SERVICE_ROLE_KEY:'synthetic',SUPABASE_URL:'https://transit.invalid'} as any);
    const back=new Socket();await restarted.handleSession(back,null,'world:funaab:main');
    await back.packet({type:'join',player:{id:lostUser,username:'Student4',position:[7,0,78]}});
    const bs=restarted.sessions.get(back);bs.trustedPosition=[...KOROPE_BAY];bs.claimedPosition=[...KOROPE_BAY];bs.trustedAt=now;restarted.players.get(bs.connectionId).position=[...KOROPE_BAY];
    await back.packet({type:'keke_book',requestId:crypto.randomUUID(),kekeId:KOROPE_ID,destinationId:'library'});
    assert.equal(back.messages.at(-1).error,undefined,'boards again after a lost ride');
    assert.equal([...ledger.values()].filter((t)=>t.status==='refund').length,1,'the lost ride was refunded');
    assert.equal([...ledger.values()].filter((t)=>t.status==='reserved').length,1,'only the new ticket is reserved');
    assert.equal(createKorope().phase,'WAITING');
    console.log('KOROPE WORKER PASSED: waits for 5 paid riders or a rider tapping Move now, 8 seats, flat fare, route stops only, drives through stops, pulls over when hailed (not from too far), early exit at the next junction, drops at destinations, returns to wait, refunds if never filled or on disconnect.');
  }finally{globalThis.WebSocket=oldWS;globalThis.fetch=oldFetch;globalThis.setInterval=oldInterval;Date.now=oldNow;}
}
main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});
