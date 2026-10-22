import { create } from 'zustand';
import type { CampusJob } from '../types/game';
import { CAMPUS_JOBS, JOB_HANDOVERS } from '../config/campusJobs';
import { TABLE_ITEM_MS } from '../config/heldItems';
import { carryItem } from '../game/player/holdItem';
import { networkManager } from '../game/multiplayer/networkManager';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { useWalletStore } from './walletStore';
import { useGameStore } from './gameStore';
// paid/bonus are only present on the delivery that completed the run (server amounts).
interface Run {id:string;job_id:string;status:string;reward_claimed:boolean;paid?:number;bonus?:number}
interface JobState {
 activeJob:CampusJob|null; run:Run|null; availableJobs:CampusJob[]; busy:boolean; error:string|null;
 lastCompletedJobAt:number|null;
 /** The last package handed over (pickup or drop-off), so the characters there can react. */
 handover:{jobId:string;stage:'pickup'|'deliver';at:number}|null;
 load:()=>Promise<void>; acceptJob:(id:string)=>Promise<boolean>; cancelJob:()=>Promise<void>;
 pickupDeliveryPackage:()=>Promise<boolean>; completeActiveJob:(id:string)=>Promise<{success:boolean;reward:number;bonus:number}>;
 checkJobProximity:(pos:[number,number,number])=>{canPickup:boolean;canDeliver:boolean;targetName:string;distance:number};
}
// The route arrow always points at the current stop, so students never have to hunt for it.
const guide = (job:CampusJob|null) => {
 const game=useGameStore.getState(),cur=game.navigationDestination;
 if(!job){if(cur?.id.startsWith('job-'))game.setNavigationDestination(null);return;}
 const pickup=job.status==='accepted',name=pickup?job.source:job.destination;
 game.setNavigationDestination({id:`job-${job.id}-${pickup?'pickup':'drop'}`,name,shortName:name,position:pickup?job.sourcePos:job.destinationPos,icon:job.icon});
};
// While a package is picked up the student carries it (refreshed, since held items expire); it's put
// away on delivery or cancel. Buying food meanwhile shows the food, then the package comes back.
const CARRY_REFRESH_MS = 30_000;
let carryTimer:ReturnType<typeof setInterval>|null = null;
const carry = (job:CampusJob|null) => {
 const kind = job?.status==='picked_up' ? JOB_HANDOVERS[job.id]?.kind : undefined;
 if (carryTimer) { clearInterval(carryTimer); carryTimer = null; }
 const held = useGameStore.getState().myHeldItem;
 if (!kind) {
   if (held && Object.values(JOB_HANDOVERS).some((h)=>h.kind===held.kind)) carryItem(held.kind, 0);
   return;
 }
 const refresh = () => {
   const h = useGameStore.getState().myHeldItem;
   if (!h || h.until < Date.now() + 60_000) carryItem(kind, TABLE_ITEM_MS);
 };
 carryItem(kind, TABLE_ITEM_MS);
 carryTimer = setInterval(refresh, CARRY_REFRESH_MS);
};
const active = (run:Run|null):CampusJob|null => {
 const job=CAMPUS_JOBS.find(j=>j.id===run?.job_id);
 return job && run && ['accepted','picked_up'].includes(run.status)? {...job,status:run.status as CampusJob['status']}:null;
};
export const useJobStore=create<JobState>((set,get)=>{
 const action=async (name:string,job?:string)=>{
   if(get().busy) return null;
   const owner=useAuthStore.getState().user?.id;
   set({busy:true,error:null});
   try {
     const run:Run=await networkManager.action(name,job,get().run?.id);
     if(useAuthStore.getState().user?.id!==owner)return null;
     set({run,activeJob:active(run)});guide(active(run));carry(active(run));return run;
   } catch(e) {set({error:(e as Error).message});return null;}
   finally {set({busy:false});}
 };
 return {
 activeJob:null,run:null,availableJobs:CAMPUS_JOBS,busy:false,error:null,lastCompletedJobAt:null,handover:null,
 load:async()=>{
   const id=useAuthStore.getState().user?.id; if(!id) return;
   const {data,error}=await supabase.from('job_runs').select('*').eq('user_id',id).in('status',['accepted','picked_up']).maybeSingle();
   if(useAuthStore.getState().user?.id!==id)return;
   if(error) {set({error:'Jobs unavailable. Please retry after setup.'});return;}
   set({run:data,activeJob:active(data),error:null});guide(active(data));carry(active(data));
 },
 acceptJob:async id=>!!(await action('accept',id)),
 cancelJob:async()=>{await action('cancel');},
 pickupDeliveryPackage:async()=>{
   const job=get().activeJob?.id, run=await action('pickup');
   if(run && job) set({handover:{jobId:job,stage:'pickup',at:Date.now()}});
   return !!run;
 },
 completeActiveJob:async userId=>{
   const listed=get().activeJob?.reward || 0, job=get().activeJob?.id;
   const run=await action('deliver');
   if(!run?.reward_claimed)return {success:false,reward:0,bonus:0};
   if(job) set({handover:{jobId:job,stage:'deliver',at:Date.now()}});
   await useWalletStore.getState().loadWallet(userId);
   set({lastCompletedJobAt:Date.now()});
   return {success:true,reward:run.paid ?? listed,bonus:run.bonus ?? 0};
 },
 checkJobProximity:pos=>{
   const job=get().activeJob;
   if(!job || networkManager.room!=='world:funaab:main')return {canPickup:false,canDeliver:false,targetName:'Return to campus',distance:999};
   const pickup=job.status==='accepted',target=pickup?job.sourcePos:job.destinationPos;
   const distance=Math.hypot(pos[0]-target[0],pos[2]-target[2]);
   // Half a metre inside the server's radius so a slightly delayed position still counts.
   const reach=pickup?4.5:(job.destRadius??5)-0.5;
   return {canPickup:pickup&&distance<=reach,canDeliver:!pickup&&distance<=reach,targetName:pickup?job.source:job.destination,distance:Math.round(distance)};
 }
 };
});
