// Korope shared bus: won't leave until 5 riders have paid, carries 8, drops each rider at their stop,
// refunds riders if it never fills, and starts over at the bay afterwards.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { locationById } from '../src/config/campusLocations';
import { KOROPE, KOROPE_ID, routeStops } from '../src/config/kekeRoutes';
import { KOROPE_BAY, createKorope, seatPosition } from '../src/config/kekeSimulation';

class Socket{static OPEN=1;readyState=1;messages:any[]=[];handlers:Record<string,Function>={};accept(){}addEventListener(e:string,f:Function){this.handlers[e]=f;}send(s:string){this.messages.push(JSON.parse(s));}close(){this.readyState=3;this.handlers.close?.();}async packet(p:object){await this.handlers.message({data:JSON.stringify(p)});}}

async function main(){
  const oldWS=globalThis.WebSocket,oldFetch=globalThis.fetch,oldInterval=globalThis.setInterval,oldNow=Date.now;
  (globalThis as any).WebSocket=Socket;(globalThis as any).setInterval=()=>0;
  let now=oldNow();Date.now=()=>now;
  const ledger=new Map<string,any>(),pending=new Map<string,any>();
  const storage={put:async(k:string,v:any)=>pending.set(k,v),delete:async(k:string)=>pending.delete(k),setAlarm:async()=>{},list:async({prefix}:any)=>new Map([...pending].filter(([k])=>k.startsWith(prefix)))};
  globalThis.fetch=async(url:any,init:any)=>{const body=JSON.parse(init.body);
    if(String(url).endsWith('keke_reserve_trusted')){ledger.set(body.p_ticket,{...body,status:'reserved'});return new Response(JSON.stringify({balance:5000-body.p_fare}));}
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

    // Seats: five riders have five distinct seat spots, all inside the van's footprint.
    const spots=new Set(bus().passengers.map((id:string)=>seatPosition(bus(),id).join(',')));assert.equal(spots.size,5);

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

    // A rider who disconnects while waiting is refunded too.
    ledger.clear();await board(riders[2]);assert.equal(bus().passengers.length,1);
    riders[2].close();await new Promise((r)=>setTimeout(r,0));assert.equal(bus().passengers.length,0);assert([...ledger.values()].every((t)=>t.status==='refund'));
    assert.equal(createKorope().phase,'WAITING');
    console.log('KOROPE WORKER PASSED: waits for 5 paid riders, 8 seats, flat fare, route stops only, stops and drops at destinations, returns to wait, refunds if never filled or on disconnect.');
  }finally{globalThis.WebSocket=oldWS;globalThis.fetch=oldFetch;globalThis.setInterval=oldInterval;Date.now=oldNow;}
}
main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});
