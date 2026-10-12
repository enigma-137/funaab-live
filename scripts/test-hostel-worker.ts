import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
class Socket {
 static OPEN=1;readyState=1;messages:any[]=[];handlers:Record<string,Function>={};reason='';
 accept(){} addEventListener(event:string,fn:Function){this.handlers[event]=fn;}
 send(raw:string){this.messages.push(JSON.parse(raw));}
 close(_code:number,reason:string){this.reason=reason;this.readyState=3;this.handlers.close?.();}
 async packet(data:object){await this.handlers.message({data:JSON.stringify(data)});}
}
async function main(){
 const oldInterval=globalThis.setInterval,oldClearInterval=globalThis.clearInterval,oldFetch=globalThis.fetch,oldWS=globalThis.WebSocket,oldNow=Date.now;
 const simulationIntervals=new Map<number,Function>();let nextInterval=0;
 (globalThis as any).setInterval=(callback:Function)=>{const id=++nextInterval;simulationIntervals.set(id,callback);return id;};
 (globalThis as any).clearInterval=(id:number)=>simulationIntervals.delete(id);
 (globalThis as any).WebSocket=Socket;
 const owner='00000000-0000-4000-8000-000000000001',guest='00000000-0000-4000-8000-000000000002';
 const allowed=new Set([owner,guest,'guest3','guest4','guest5','guest6']);const calls:any[]=[];
 let failReward=false;
 globalThis.fetch=async(_url:any,init:any)=>{
  const body=JSON.parse(init.body);calls.push({url:String(_url),body});
  let result:any=true;
  if(String(_url).endsWith('ps_reward_trusted')&&failReward){failReward=false;return new Response(JSON.stringify({message:'Synthetic outage'}),{status:503});}
  if(String(_url).endsWith('hostel_can_enter'))result=allowed.has(body.p_guest);
  if(String(_url).endsWith('job_action_trusted'))result={id:'saved-run',job_id:'job-food-delivery',status:'accepted'};
  return new Response(JSON.stringify(result),{status:200});
 };
 try{
  const env:any={ENABLE_GUEST_MODE:'true',SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-key',SUPABASE_URL:'https://hostel-test.invalid'};
  const room=`world:funaab:hostel-room:${owner}`,world:any=new WorldRoomDO({} as any,env);
  const join=async(w:any,id:string,target=room,bound=room)=>{
   const socket=new Socket();await w.handleSession(socket,null,bound);
   await socket.packet({type:'join',room:target,player:{id,username:id,connectionId:'attacker-chosen-id',position:[0,0,2]}});return socket;
  };
  const lifecycleWorld:any=new WorldRoomDO({} as any,env);
  assert.equal(simulationIntervals.size,0,'Construction must not start a permanent simulation timer');
  const lifecycleSocket=await join(lifecycleWorld,owner,'world:funaab:main','world:funaab:main');
  assert.equal(simulationIntervals.size,1,'An active campus session starts the Keke simulation timer');
  lifecycleSocket.close(1000,'Leaving');
  assert.equal(simulationIntervals.size,0,'The Keke simulation timer stops after the last campus session leaves');
  const originalNow=Date.now;
  const libraryWorld:any=new WorldRoomDO({storage:{}} as any,env),librarySocket=new Socket();
  Date.now=()=>Date.UTC(2026,6,17,10);
  await libraryWorld.handleSession(librarySocket,null,'world:funaab:library');
  await librarySocket.packet({type:'join',room:'world:funaab:library',player:{id:owner,username:'Library visitor',position:[0,0,2]}});
  Date.now=()=>Date.UTC(2026,6,17,16);
  await librarySocket.packet({type:'ping',t:1});
  Date.now=originalNow;
  assert.equal(librarySocket.readyState,3,'A connected library session is closed on its next packet after closing time');
  const a=await join(world,owner),b=await join(world,guest);
  const duplicateWorld:any=new WorldRoomDO({} as any,env),duplicate=new Socket();
  await duplicateWorld.handleSession(duplicate,null,room);
  await Promise.all([1,2].map(()=>duplicate.packet({type:'join',room,player:{id:owner,username:'Owner',position:[0,0,2]}})));
  assert.equal(duplicateWorld.players.size,1,'Concurrent joins on one socket must not create ghost players');
  assert(a.messages.some(m=>m.type==='snapshot'));assert(b.messages.some(m=>m.type==='snapshot'));
  const snapshots=b.messages.find(m=>m.type==='snapshot');assert.equal(Object.keys(snapshots.players).length,2);
  assert.equal(snapshots.players['attacker-chosen-id'].id,owner,'A second socket cannot overwrite the first player ID');
  assert.notEqual(snapshots.yourConnectionId,'attacker-chosen-id');
  const stranger=await join(world,'stranger');assert.equal(stranger.readyState,3);assert(!stranger.messages.some(m=>m.type==='snapshot'));
  await b.packet({type:'chat',text:'Come my place'});assert(a.messages.some(m=>m.type==='chat_message'&&m.text==='Come my place'));
  await b.packet({type:'room_changed',placements:[{item_id:'cheat'}]});assert(!a.messages.some(m=>m.type==='room_changed'));
  await a.packet({type:'room_changed'});assert(b.messages.some(m=>m.type==='room_changed'));
  await a.packet({type:'move',position:[-2.6,.34,-1.9],rotation:0,animation:'sleep'});
  const lateSleeper=await join(world,'guest3');
  assert(Object.values(lateSleeper.messages.find(m=>m.type==='snapshot').players).some((p:any)=>p.id===owner&&p.animation==='sleep'),'Late visitor sees sleeping owner');
  await a.packet({type:'move',position:[1,0,0],rotation:0,animation:'sit'});world.broadcastBatchPlayers();
  assert([...world.players.values()].some((p:any)=>p.id===owner&&p.animation==='sit'));
await join(world,'guest4');await join(world,'guest5');
  const sixth=await join(world,'guest6');assert.equal(sixth.readyState,3);assert.match(sixth.reason,/full/);
  world.broadcastBatchPlayers();assert(b.messages.some(m=>m.type==='players_batch'));
  b.close(1000,'Leaving');assert(a.messages.some(m=>m.type==='player_left'));assert.equal(a.readyState,1);
  const mismatch=await join(world,'guest6','world:funaab:main');assert.equal(mismatch.readyState,3);
  const c=await join(world,guest);allowed.delete(guest);await a.packet({type:'room_changed'});assert.equal(c.readyState,3);
  const pending=new Map();
  const state:any={storage:{put:async(k:string,v:any)=>pending.set(k,v),delete:async(k:string)=>pending.delete(k),setAlarm:async()=>{},list:async()=>new Map(pending)}};
  const mainWorld:any=new WorldRoomDO(state,env),student=await join(mainWorld,owner,'world:funaab:main','world:funaab:main');
  await student.packet({type:'move',position:[-18,0,-53],rotation:0,animation:'walk'});
  await student.packet({type:'job_action',requestId:'test',action:'accept',jobId:'job-food-delivery',position:[-18,0,-53],reward:999999});
  const rpc=calls.find(c=>c.url.endsWith('job_action_trusted'));assert(rpc);assert.equal(rpc.body.p_user,owner);assert(Math.hypot(rpc.body.p_x-7,rpc.body.p_z-78)<=8,'a teleport only advances at the max legal speed');assert(Math.hypot(rpc.body.p_x+18,rpc.body.p_z+53)>100,'the teleport target is not trusted');assert(!('reward' in rpc.body));
  const opponent=await join(mainWorld,guest,'world:funaab:main','world:funaab:main');
  const studentConnId=mainWorld.sessions.get(student).connectionId;
  await student.packet({type:'move',position:[-17.8,0,-53],rotation:0.1,animation:'run'});
  const opponentBatchCount=opponent.messages.filter((message:any)=>message.type==='players_batch').length;
  mainWorld.broadcastBatchPlayers();
  const sentBatch=opponent.messages.filter((message:any)=>message.type==='players_batch');
  assert.equal(sentBatch.length,opponentBatchCount+1,'A changed player state produces a batch');
  assert(sentBatch.at(-1).updates[studentConnId],'The batch contains the changed player');
  mainWorld.broadcastBatchPlayers();
  assert.equal(opponent.messages.filter((message:any)=>message.type==='players_batch').length,sentBatch.length,'An unchanged state does not produce a redundant batch');
  await student.packet({type:'ps_challenge_create'});
  const match:any=[...mainWorld.psMatches.values()][0];
  await opponent.packet({type:'ps_challenge_join',matchId:match.id});
  failReward=true;
  for(let round=0;round<3;round++){
    await student.packet({type:'ps_action',matchId:match.id,choice:'center'});
    await opponent.packet({type:'ps_action',matchId:match.id,choice:'center'});
  }
  assert.equal(match.status,'in_progress');assert.equal(match.currentRound,4);assert.equal(match.totalRounds,5);assert.equal(match.winnerName,undefined);assert.equal(pending.size,0);
  await student.packet({type:'ps_action',matchId:match.id,choice:'right'});
  await opponent.packet({type:'ps_action',matchId:match.id,choice:'left'});
  await student.packet({type:'ps_action',matchId:match.id,choice:'left'});
  await opponent.packet({type:'ps_action',matchId:match.id,choice:'left'});
  assert.equal(match.status,'finished');assert.equal(match.currentRound,5);assert.equal(match.winnerName,match.guestName);assert.equal(pending.size,1);
  assert(student.messages.some(m=>m.type==='reward_error'));
  await mainWorld.alarm();assert.equal(pending.size,0);
  const rewardCalls=calls.filter(c=>c.url.endsWith('ps_reward_trusted')).length;
  await opponent.packet({type:'ps_action',matchId:match.id,choice:'right'});
  assert.equal(calls.filter(c=>c.url.endsWith('ps_reward_trusted')).length,rewardCalls);
  const currentPosition=[...mainWorld.players.get(studentConnId).position];
  student.close(1000,'Reconnect test');
  const reconnected=new Socket();await mainWorld.handleSession(reconnected,null,'world:funaab:main');
  await reconnected.packet({type:'join',room:'world:funaab:main',player:{id:owner,username:'Reconnected student',connectionId:studentConnId,position:currentPosition,rotation:0.1,animation:'run'}});
  const reconnectSnapshot=reconnected.messages.find((message:any)=>message.type==='snapshot');
  assert.equal(reconnectSnapshot.players[studentConnId].animation,'run','A reconnect snapshot carries the latest local animation state');
  assert.deepEqual(reconnectSnapshot.players[studentConnId].position,currentPosition,'A reconnect snapshot carries the latest local position');
  const otherRoom:any=new WorldRoomDO({} as any,env);await join(otherRoom,owner,'world:funaab:hostel','world:funaab:hostel');
  assert.equal(otherRoom.players.size,1);assert.equal(mainWorld.players.size,2);
  const strict:any=new WorldRoomDO({} as any,{...env,ENABLE_GUEST_MODE:'false'});const denied=await join(strict,owner);assert.equal(strict.players.size,0);assert(denied.messages.some(m=>m.type==='error'));
  console.log('HOSTEL WORKER PASSED: membership, capacity, snapshots, scoped chat/movement/leave, owner invalidation, revocation, routing, spoofed destination/reward rejection and strict auth.');
 }finally{Date.now=oldNow;globalThis.setInterval=oldInterval;globalThis.clearInterval=oldClearInterval;globalThis.fetch=oldFetch;globalThis.WebSocket=oldWS;}
}
main().catch(e=>{console.error(e);process.exit(1);});
