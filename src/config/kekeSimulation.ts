import { campusLocations, locationById, CAR_PARK_BAY, type Point } from './campusLocations';
import { canAdvance, nodeKey, PARKED_KEKE_ID, publicRoute, roadPath } from './kekeRoutes';
export type RidePhase='IDLE'|'BOARDING'|'MOVING'|'ARRIVED'|'RETURNING'|'BLOCKED';
export interface TransitState {
  id:string;routeId:string;position:Point;rotation:number;speed:number;currentWaypointIndex:number;
  passengers:string[];currentStopName:string;isStopped:boolean;phase:RidePhase;destinationId?:string;
  route:Point[];deadline:number;tripId:string;paid:Record<string,string>;targets:Record<string,string>;
}
export function createKeke(bookable:boolean):TransitState{
  return {id:bookable?PARKED_KEKE_ID:'keke-1',routeId:bookable?'bookable':'route-alpha',position:bookable?[...CAR_PARK_BAY]:[...locationById('sports-centre').kekeStop],rotation:Math.PI,speed:7,currentWaypointIndex:bookable?0:publicRoute.findIndex(p=>nodeKey(p)===nodeKey(locationById('sports-centre').kekeStop)),passengers:[],currentStopName:'Car Park',isStopped:true,phase:bookable?'IDLE':'BOARDING',route:bookable?[]:publicRoute,deadline:0,tripId:'',paid:{},targets:{}};
}
export function bookRide(k:TransitState,destinationId:string,now:number,tripId:string){
  if(k.phase!=='IDLE')throw new Error('This Keke already has a destination');
  k.destinationId=destinationId;k.tripId=tripId;k.phase='BOARDING';k.deadline=now+8000;
  k.route=roadPath(nodeKey(CAR_PARK_BAY),nodeKey(locationById(destinationId).kekeStop));k.currentWaypointIndex=1;k.currentStopName=locationById(destinationId).shortName;
}
export function seatPosition(k:Pick<TransitState,'position'|'rotation'|'passengers'>,connectionId:string):Point{
  const seat=Math.max(0,k.passengers.indexOf(connectionId)),x=(seat-1)*.43,z=-.45;
  // Sitting lowers the avatar pelvis by .39; +.25 aligns its .89 hip with the .75 bench.
  return [k.position[0]+x*Math.cos(k.rotation)+z*Math.sin(k.rotation),k.position[1]+.25,k.position[2]-x*Math.sin(k.rotation)+z*Math.cos(k.rotation)];
}
export const exitPosition=(k:TransitState):Point=>[k.position[0]+3.2,0,k.position[2]];
export function tickKeke(k:TransitState,now:number,dt:number):boolean{
  if(k.phase==='IDLE'||k.phase==='BLOCKED')return false;
  if(k.phase==='ARRIVED'){
    if(now>=k.deadline){k.phase='RETURNING';k.deadline=now+2000;}
    return false;
  }
  if(k.phase==='RETURNING'){
    if(now>=k.deadline)Object.assign(k,createKeke(true));return false;
  }
  if(k.phase==='BOARDING'){
    if(now<k.deadline)return false;
    k.phase='MOVING';k.isStopped=false;
  }
  const target=k.route[k.currentWaypointIndex];if(!target)return false;
  const dx=target[0]-k.position[0],dz=target[2]-k.position[2],distance=Math.hypot(dx,dz),step=Math.min(distance,k.speed*Math.min(dt,.2));
  const next:Point=distance<.001?[...target]:[k.position[0]+dx/distance*step,0,k.position[2]+dz/distance*step];
  if(!canAdvance(k.position,next)){k.phase='BLOCKED';k.isStopped=true;return false;}
  if(distance>.001)k.rotation=Math.atan2(dx,dz);k.position=next;
  if(distance>step+.001)return false;
  k.position=[...target];
  if(k.id===PARKED_KEKE_ID&&k.currentWaypointIndex===k.route.length-1){k.phase='ARRIVED';k.isStopped=true;k.deadline=now+5000;return true;}
  k.currentWaypointIndex=(k.currentWaypointIndex+1)%k.route.length;
  if(k.id!==PARKED_KEKE_ID){
    k.currentStopName=campusLocations.find(l=>nodeKey(l.kekeStop)===nodeKey(target))?.shortName || 'Campus junction';
    k.phase='BOARDING';k.isStopped=true;k.deadline=now+3500;
    return true;
  }return false;
}
