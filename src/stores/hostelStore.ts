import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { useGameStore } from './gameStore';
import { useInputStore } from './inputStore';
import { useWalletStore } from './walletStore';
import { useLectureStore } from './lectureStore';
import { networkManager } from '../game/multiplayer/networkManager';
export interface Placement {item_id:string;anchor:string;rotation:number}
export interface RoomSnapshot {room:{owner_id:string;privacy:string;tv_on:boolean;rested_at:string|null;security_at:string|null};placements:Placement[];owner_name:string}
interface Debt {id:string;item_id:string;amount:number;due_at:string;paid_at:string|null}
interface Invite {owner_id:string;guest_id:string;status:string;expires_at:string}
interface HostelState {
 roomId:string; owner:string|null; snapshot:RoomSnapshot|null; debts:Debt[]; invites:Invite[];
 busy:boolean;error:string|null;notice:string|null;panel:'home'|'shop'|'decorate'|'debts'|'invites';
 preview:{item:string;anchor:string;rotation:number}|null;transition:string|null;
 load:()=>Promise<void>;loadRoom:(owner:string)=>Promise<boolean>;
 command:(action:string,data?:object)=>Promise<boolean>;travel:(target:'campus'|'hostel'|'room',owner?:string)=>Promise<void>;
}
const requests=new Map<string,string>();
export const useHostelStore=create<HostelState>((set,get)=>({
 roomId:'world:funaab:main',owner:null,snapshot:null,debts:[],invites:[],busy:false,error:null,notice:null,panel:'home',preview:null,transition:null,
 load:async()=>{
   const user=useAuthStore.getState().user;if(!user)return;
   const results=await Promise.all([supabase.from('game_debts').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),supabase.from('hostel_invites').select('*').gt('expires_at',new Date().toISOString())]);
   if(useAuthStore.getState().user?.id!==user.id)return;
   if(results.some(r=>r.error)){set({error:'Hostel service is unavailable. Retry shortly.'});return;}
   set({debts:results[0].data||[],invites:results[1].data||[]});
 },
 loadRoom:async owner=>{
   const {data,error}=await supabase.rpc('hostel_snapshot',{p_owner:owner});
   if(error){set({error:error.message});return false;}
   set({snapshot:data});return true;
 },
 command:async(action,data={})=>{
   if(get().busy)return false;
   const user=useAuthStore.getState().user;if(!user)return false;
   const key=user.id+action+JSON.stringify(data),request=requests.get(key)||crypto.randomUUID();requests.set(key,request);
   set({busy:true,error:null});
   try {
     const {error}=await supabase.rpc('hostel_command',{p_action:action,p_data:data,p_request:request});
     if(error)throw error;
     if(useAuthStore.getState().user?.id!==user.id)return false;
     requests.delete(key);
     await get().load();
     await useWalletStore.getState().loadWallet(user.id);
     if(get().owner)await get().loadRoom(get().owner!);
     networkManager.roomChanged();
     set({notice:action==='purchase'?'Added to your inventory.':action==='pay'?'Iya Ibeji: Thank you, my student!':action==='consume'?'Small chop. Student life continues.':'Saved.'});
     return true;
   }catch(e){set({error:(e as Error).message||'Could not save. Retry safely.'});return false;}
   finally{set({busy:false});}
 },
 travel:async(target,owner)=>{
   const user=useAuthStore.getState().user;if(!user||get().transition)return;
   if(useLectureStore.getState().isInClassroom){set({error:'Leave your lecture before travelling.'});return;}
   if(target!=='campus' && !(await get().command('ensure')))return;
   const roomOwner=owner||user.id;
   if(target==='room' && !(await get().loadRoom(roomOwner)))return;
   set({transition:target==='campus'?'Returning to campus…':'Heading home…'});
   await new Promise(resolve=>setTimeout(resolve,350));
   const roomId=target==='campus'?'world:funaab:main':target==='hostel'?'world:funaab:hostel':`world:funaab:hostel-room:${roomOwner}`;
   useInputStore.getState().clearTargetDestination();
   useGameStore.setState({myPosition:target==='campus'?[0,0,48]:target==='room'?[0,0,2]:[0,0,8],activeModal:null,nearbyInteractable:null,isRidingKeke:false,selectedPlayer:null});
   set({roomId,owner:target==='room'?roomOwner:null,preview:null,transition:null});
   await networkManager.switchRoom(roomId,user);
 },
}));
