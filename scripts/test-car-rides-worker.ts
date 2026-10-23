// Lifts (Worker): hop into a stopped car nearby, two passengers at most, never your own or while
// driving; everyone gets out when the driver parks or leaves; others see who's riding (batch).
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';

class Socket{static OPEN=1;readyState=1;messages:any[]=[];handlers:Record<string,Function>={};accept(){}addEventListener(e:string,f:Function){this.handlers[e]=f;}send(s:string){this.messages.push(JSON.parse(s));}close(){this.readyState=3;this.handlers.close?.();}async packet(p:object){await this.handlers.message({data:JSON.stringify(p)});}}

async function main(){
  const oldWS=globalThis.WebSocket,oldInterval=globalThis.setInterval;
  (globalThis as any).WebSocket=Socket;(globalThis as any).setInterval=()=>0;
  try{
    const storage={put:async()=>{},get:async()=>undefined,delete:async()=>{},setAlarm:async()=>{},list:async()=>new Map()};
    const w:any=new WorldRoomDO({storage} as any,{ENABLE_GUEST_MODE:'true'} as any);
    const join=async(n:number,at:[number,number,number])=>{const s=new Socket();await w.handleSession(s,null,'world:funaab:main');await s.packet({type:'join',player:{id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,username:`S${n}`,position:at}});return s;};
    const conn=(s:Socket)=>w.sessions.get(s).connectionId;
    const last=(s:Socket,type:string)=>[...s.messages].reverse().find((m)=>m.type===type);
    const driver=await join(1,[0,0,40]),a=await join(2,[2,0,40]),b=await join(3,[2,0,41]),c=await join(4,[1,0,42]),far=await join(5,[30,0,40]);
    const D=conn(driver);

    await a.packet({type:'car_ride',driver:D});
    assert.equal(last(a,'car_ride_result').ok,false,'not driving yet');
    await driver.packet({type:'move',position:[0,0,40],rotation:0,animation:'sit',car:'car_camry'});
    assert.equal(w.players.get(D).car,'car_camry');
    await far.packet({type:'car_ride',driver:D});
    assert.match(last(far,'car_ride_result').error,/Walk up/,'must be next to the car');
    await driver.packet({type:'car_ride',driver:D});
    assert.equal(last(driver,'car_ride_result').ok,false,'not your own car');

    await a.packet({type:'car_ride',driver:D});
    await b.packet({type:'car_ride',driver:D});
    assert.deepEqual([last(a,'car_ride_result').seat,last(b,'car_ride_result').seat],[0,1],'two seats');
    await c.packet({type:'car_ride',driver:D});
    assert.match(last(c,'car_ride_result').error,/full/,'a third is refused');
    assert(driver.messages.some((m)=>m.type==='car_rider_joined'),'driver is told');
    w.broadcastBatchPlayers();
    const batch=[...c.messages].reverse().find((m)=>m.type==='players_batch'&&m.updates?.[conn(a)]);
    assert.equal(batch.updates[conn(a)].rideWith,D,'others see who is riding');

    // Getting out frees the seat for someone else.
    await b.packet({type:'car_ride_leave'});
    await c.packet({type:'car_ride',driver:D});
    assert.equal(last(c,'car_ride_result').ok,true);

    // Parking ends every lift.
    await driver.packet({type:'move',position:[0,0,40],rotation:0,animation:'idle',car:null});
    assert(last(a,'car_ride_end')&&last(c,'car_ride_end'),'riders are told');
    assert.equal(w.players.get(conn(a)).rideWith,null);
    assert.equal(w.players.get(conn(c)).rideWith,null);

    // Driver disconnects mid-ride.
    await driver.packet({type:'move',position:[0,0,40],rotation:0,animation:'sit',car:'car_camry'});
    await a.packet({type:'car_ride',driver:D});
    a.messages.length=0;
    driver.close();
    await new Promise((r)=>setTimeout(r,0));
    assert(last(a,'car_ride_end'),'driver left: rider is let out');
    // Group chat pings go only to the listed members (by account id), never back to the sender, and carry no text.
    const g1=await join(11,[50,0,40]),g2=await join(12,[51,0,40]),g3=await join(13,[52,0,40]);
    await g1.packet({type:'group_ping',groupId:'g-1',to:['00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012'],text:'ignored'});
    assert.deepEqual(last(g2,'group_ping'),{type:'group_ping',groupId:'g-1',from:'S11'},'member pinged, no message text');
    assert(!last(g1,'group_ping')&&!last(g3,'group_ping'),'not the sender, not outsiders');
    // The hostel town (its own world): driving at the far west end is accepted, and lifts work there too.
    const town:any=new WorldRoomDO({storage} as any,{ENABLE_GUEST_MODE:'true'} as any);
    const joinTown=async(n:number,at:[number,number,number])=>{const s=new Socket();await town.handleSession(s,null,'world:funaab:hostel');await s.packet({type:'join',room:'world:funaab:hostel',player:{id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,username:`T${n}`,position:at}});return s;};
    const td=await joinTown(21,[0,0,8]),tr=await joinTown(22,[-150,0,27]);
    const TD=town.sessions.get(td).connectionId;
    for(const x of [-20,-60,-100,-140,-150]) await td.packet({type:'move',position:[x,0,22.8],rotation:-Math.PI/2,animation:'sit',car:'car_corolla'});
    assert.deepEqual(town.players.get(TD).position,[-150,0,22.8],'town positions are accepted');
    assert.equal(town.players.get(TD).car,'car_corolla','driving in town');
    await tr.packet({type:'car_ride',driver:TD});
    assert.equal(last(tr,'car_ride_result').ok,true,'a lift in town');
    console.log('CAR RIDES WORKER PASSED (+ group pings, hostel town): only a driving car, next to it, not your own; two seats then full; seat freed on leaving; batch shows riders; park or disconnect lets everyone out; driving and lifts in the hostel town.');
  }finally{globalThis.WebSocket=oldWS;globalThis.setInterval=oldInterval;}
}
main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});
