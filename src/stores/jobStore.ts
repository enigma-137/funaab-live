import { create } from 'zustand';
import type { CampusJob } from '../types/game';
import { CAMPUS_JOBS } from '../config/campusJobs';
import { networkManager } from '../game/multiplayer/networkManager';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { useWalletStore } from './walletStore';
interface Run {id:string;job_id:string;status:string;reward_claimed:boolean}
interface JobState {
 activeJob:CampusJob|null; run:Run|null; availableJobs:CampusJob[]; busy:boolean; error:string|null;
 lastCompletedJobAt:number|null;
 load:()=>Promise<void>; acceptJob:(id:string)=>Promise<boolean>; cancelJob:()=>Promise<void>;
 pickupDeliveryPackage:()=>Promise<boolean>; completeActiveJob:(id:string)=>Promise<{success:boolean;reward:number}>;
 checkJobProximity:(pos:[number,number,number])=>{canPickup:boolean;canDeliver:boolean;targetName:string;distance:number};
}
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
     set({run,activeJob:active(run)});return run;
   } catch(e) {set({error:(e as Error).message});return null;}
   finally {set({busy:false});}
 };
 return {
 activeJob:null,run:null,availableJobs:CAMPUS_JOBS,busy:false,error:null,lastCompletedJobAt:null,
 load:async()=>{
   const id=useAuthStore.getState().user?.id; if(!id) return;
   const {data,error}=await supabase.from('job_runs').select('*').eq('user_id',id).in('status',['accepted','picked_up']).maybeSingle();
   if(useAuthStore.getState().user?.id!==id)return;
   if(error) {set({error:'Jobs unavailable. Please retry after setup.'});return;}
   set({run:data,activeJob:active(data),error:null});
 },
 acceptJob:async id=>!!(await action('accept',id)),
 cancelJob:async()=>{await action('cancel');},
 pickupDeliveryPackage:async()=>!!(await action('pickup')),
 completeActiveJob:async userId=>{
   const reward=get().activeJob?.reward || 0;
   const run=await action('deliver');
   if(!run?.reward_claimed)return {success:false,reward:0};
   await useWalletStore.getState().loadWallet(userId);
   set({lastCompletedJobAt:Date.now()});
   return {success:true,reward};
 },
 checkJobProximity:pos=>{
   const job=get().activeJob;
   if(!job || networkManager.room!=='world:funaab:main')return {canPickup:false,canDeliver:false,targetName:'Return to campus',distance:999};
   const pickup=job.status==='accepted',target=pickup?job.sourcePos:job.destinationPos;
   const distance=Math.hypot(pos[0]-target[0],pos[2]-target[2]);
   return {canPickup:pickup&&distance<=4.5,canDeliver:!pickup&&distance<=4.5,targetName:pickup?job.source:job.destination,distance:Math.round(distance)};
 }
 };
});
