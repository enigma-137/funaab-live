import { campusLocations, locationById, CAR_PARK_BAY, type Point } from './campusLocations';
import { canAdvance, KOROPE, KOROPE_ID, nodeKey, PARKED_KEKE_ID, publicRoute, roadPath, routeStops, STOP_DWELL } from './kekeRoutes';
export type RidePhase='IDLE'|'BOARDING'|'MOVING'|'ARRIVED'|'RETURNING'|'BLOCKED'|'WAITING';
export interface TransitState {
  id:string;routeId:string;position:Point;rotation:number;speed:number;currentWaypointIndex:number;
  passengers:string[];currentStopName:string;isStopped:boolean;phase:RidePhase;destinationId?:string;
  route:Point[];deadline:number;tripId:string;paid:Record<string,string>;targets:Record<string,string>;
  /** Korope only: seats, riders needed before it leaves, and when waiting riders are refunded. */
  capacity?:number;minRiders?:number;waitUntil?:number;
}
/** Where the Korope waits: beside the Car Park stop, off the line keke-1 drives. */
export const KOROPE_BAY:Point=[-57.5,0,60];
export function createKorope():TransitState{
  const route:Point[]=[[...KOROPE_BAY],...publicRoute];
  return {id:KOROPE_ID,routeId:'korope',position:[...KOROPE_BAY],rotation:Math.PI,speed:6.5,currentWaypointIndex:1,passengers:[],currentStopName:'Car Park',isStopped:true,phase:'WAITING',route,deadline:0,tripId:'',paid:{},targets:{},capacity:KOROPE.capacity,minRiders:KOROPE.minRiders,waitUntil:0};
}
const stopKeys=new Set(routeStops.map(id=>nodeKey(locationById(id).kekeStop)));
/** How long a route vehicle stays at a node: real stops with free seats wait longest. */
export const dwellAt=(k:Pick<TransitState,'passengers'|'capacity'>,target:Point):number=>
  !stopKeys.has(nodeKey(target))?STOP_DWELL.junctionMs:k.passengers.length<(k.capacity??3)?STOP_DWELL.freeSeatsMs:STOP_DWELL.fullMs;
/** Seats a vehicle carries. */
export const seatsOf=(k:Pick<TransitState,'capacity'>)=>k.capacity??3;
export function createKeke(bookable:boolean):TransitState{
  return {id:bookable?PARKED_KEKE_ID:'keke-1',routeId:bookable?'bookable':'route-alpha',position:bookable?[...CAR_PARK_BAY]:[...locationById('sports-centre').kekeStop],rotation:Math.PI,speed:7,currentWaypointIndex:bookable?0:publicRoute.findIndex(p=>nodeKey(p)===nodeKey(locationById('sports-centre').kekeStop)),passengers:[],currentStopName:'Car Park',isStopped:true,phase:bookable?'IDLE':'BOARDING',route:bookable?[]:publicRoute,deadline:0,tripId:'',paid:{},targets:{}};
}
export function bookRide(k:TransitState,destinationId:string,now:number,tripId:string){
  if(k.phase!=='IDLE')throw new Error('This Keke already has a destination');
  k.destinationId=destinationId;k.tripId=tripId;k.phase='BOARDING';k.deadline=now+8000;
  k.route=roadPath(nodeKey(CAR_PARK_BAY),nodeKey(locationById(destinationId).kekeStop));k.currentWaypointIndex=1;k.currentStopName=locationById(destinationId).shortName;
}
// Korope seats [x,z] in the van's own frame: front passenger, two benches of two, a rear bench of three.
export const KOROPE_SEATS:Array<[number,number]>=[[-.4,.85],[-.4,-.05],[.4,-.05],[-.4,-.95],[.4,-.95],[-.5,-1.85],[0,-1.85],[.5,-1.85]];
export function seatPosition(k:Pick<TransitState,'position'|'rotation'|'passengers'>&Partial<Pick<TransitState,'capacity'>>,connectionId:string):Point{
  const seat=Math.max(0,k.passengers.indexOf(connectionId));
  const [x,z]=(k.capacity??3)>3?KOROPE_SEATS[Math.min(seat,KOROPE_SEATS.length-1)]:[(seat-1)*.43,-.45];
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
  if(k.phase==='WAITING'){
    // The Korope leaves only once enough riders have paid; the doors close a few seconds later.
    if(k.passengers.length<(k.minRiders??1))return false;
    k.phase='BOARDING';k.isStopped=true;k.deadline=now+KOROPE.doorsMs;return true;
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
  if(k.id===KOROPE_ID&&k.currentWaypointIndex===0){
    // Back at the bay: face the road again and wait for the next full load.
    const next=k.route[1];k.rotation=Math.atan2(next[0]-k.position[0],next[2]-k.position[2]);
    k.currentWaypointIndex=1;k.phase='WAITING';k.isStopped=true;k.currentStopName='Car Park';k.waitUntil=0;
    return true;
  }
  if(k.id===PARKED_KEKE_ID&&k.currentWaypointIndex===k.route.length-1){k.phase='ARRIVED';k.isStopped=true;k.deadline=now+5000;return true;}
  k.currentWaypointIndex=(k.currentWaypointIndex+1)%k.route.length;
  if(k.id!==PARKED_KEKE_ID){
    k.currentStopName=campusLocations.find(l=>nodeKey(l.kekeStop)===nodeKey(target))?.shortName || 'Campus junction';
    k.phase='BOARDING';k.isStopped=true;k.deadline=now+dwellAt(k,target);
    return true;
  }return false;
}

export function advanceKekeElapsed(k:TransitState,from:number,to:number){
  let simulationTime=from;
  let remaining=Math.max(0,to-from);
  if(k.phase==='IDLE'||k.phase==='BLOCKED'||remaining===0)return;
  const advanceInTicks=()=>{
    while(remaining>0&&k.phase!=='BLOCKED'){
      const dt=Math.min(.2,remaining/1000);
      simulationTime+=dt*1000;
      tickKeke(k,simulationTime,dt);
      remaining-=dt*1000;
    }
  };
  if(k.id!=='keke-1'||k.passengers.length||!k.route.length||k.speed<=0){
    advanceInTicks();return;
  }

  if(!k.route.every((point,index)=>canAdvance(point,k.route[(index+1)%k.route.length]))){
    advanceInTicks();return;
  }
  const routeDistance=k.route.reduce((total,point,index)=>{const next=k.route[(index+1)%k.route.length];return total+Math.hypot(next[0]-point[0],next[2]-point[2]);},0);
  const cycleDuration=routeDistance/k.speed*1000+k.route.reduce((total,point)=>total+dwellAt(k,point),0);
  if(cycleDuration<=0){advanceInTicks();return;}
  while(remaining>0){
    if(k.phase==='BOARDING'){
      const wait=Math.max(0,k.deadline-simulationTime);
      if(wait>=remaining){simulationTime+=remaining;remaining=0;break;}
      simulationTime+=wait;remaining-=wait;
      if(remaining===0)break;
      const previousIndex=(k.currentWaypointIndex-1+k.route.length)%k.route.length;
      const previousPoint=k.route[previousIndex];
      const isAtRoutePoint=previousPoint
        && Math.hypot(k.position[0]-previousPoint[0],k.position[2]-previousPoint[2])<.001;
      const cycles=isAtRoutePoint?Math.floor(remaining/cycleDuration):0;
      if(cycles>0){
        const skipped=cycles*cycleDuration;
        simulationTime+=skipped;remaining-=skipped;k.deadline=simulationTime;
        const beforePrevious=k.route[(previousIndex-1+k.route.length)%k.route.length];
        k.rotation=Math.atan2(previousPoint[0]-beforePrevious[0],previousPoint[2]-beforePrevious[2]);
        k.currentStopName=campusLocations.find(l=>nodeKey(l.kekeStop)===nodeKey(previousPoint))?.shortName||'Campus junction';
      }
      if(remaining===0)break;
      k.phase='MOVING';k.isStopped=false;
    }
    if(k.phase!=='MOVING'){advanceInTicks();return;}
    const target=k.route[k.currentWaypointIndex];
    if(!target){advanceInTicks();return;}
    const dx=target[0]-k.position[0],dz=target[2]-k.position[2],distance=Math.hypot(dx,dz);
    const travelTime=distance/k.speed*1000;
    const travel=Math.min(remaining,travelTime);
    const progress=travelTime>0?travel/travelTime:1;
    const next:Point=[k.position[0]+dx*progress,0,k.position[2]+dz*progress];
    if(!canAdvance(k.position,next)){advanceInTicks();return;}
    if(distance>.001)k.rotation=Math.atan2(dx,dz);
    k.position=next;simulationTime+=travel;remaining-=travel;
    if(travel+0.001<travelTime)break;
    k.position=[...target];
    k.currentWaypointIndex=(k.currentWaypointIndex+1)%k.route.length;
    k.currentStopName=campusLocations.find(l=>nodeKey(l.kekeStop)===nodeKey(target))?.shortName||'Campus junction';
    k.phase='BOARDING';k.isStopped=true;k.deadline=simulationTime+dwellAt(k,target);
  }
}
