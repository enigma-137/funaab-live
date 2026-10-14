import { campusLocations, locationById, CAR_PARK_BAY, type Point } from './campusLocations';
export const PARKED_KEKE_ID='keke-carpark';
export const ROUTE_KEKE_ID='keke-1';
export const ROUTE_FARE=50;
export const nodeKey=(p:Point)=>`${p[0]}:${p[2]}`;
export const roadNodes:Record<string,Point>={};
export const roadEdges:Array<[string,string]>=[];
const add=(p:Point)=>{roadNodes[nodeKey(p)]=p;return nodeKey(p);};
// Each edge is a straight, paved corridor. Stops split edges, never create shortcuts.
const lines:Array<[Point,Point]>=[
  [[-55,0,76],[-55,0,-85]], [[55,0,76],[55,0,-85]],
  [[-55,0,45],[55,0,45]], [[-55,0,-40],[55,0,-40]],
  [[-55,0,-85],[55,0,-85]], [[0,0,78],[0,0,-40]],
  [CAR_PARK_BAY,[-55,0,64]],
];
for(const [a,b] of lines){
  const vertical=a[0]===b[0];
  const points=[a,b,...campusLocations.map(l=>l.kekeStop),...lines.flat()].filter(p=>
    vertical?p[0]===a[0]&&p[2]>=Math.min(a[2],b[2])&&p[2]<=Math.max(a[2],b[2]):p[2]===a[2]&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0]));
  // Explicit crossing nodes at the central boulevard and academic avenue.
  if(!vertical && (a[2]===45||a[2]===-40))points.push([0,0,a[2]]);
  if(vertical && a[0]===0)points.push([0,0,45]);
  const sorted=[...new Map(points.map(p=>[nodeKey(p),p])).values()].sort((p,q)=>vertical?p[2]-q[2]:p[0]-q[0]);
  for(let i=1;i<sorted.length;i++)roadEdges.push([add(sorted[i-1]),add(sorted[i])]);
}
export function roadPath(from:string,to:string):Point[]{
  if(!roadNodes[from]||!roadNodes[to])throw new Error('Unknown road stop');
  const distances=new Map<string,number>([[from,0]]),previous=new Map<string,string>(),remaining=new Set(Object.keys(roadNodes));
  while(remaining.size){
    const u=[...remaining].sort((a,b)=>(distances.get(a)??Infinity)-(distances.get(b)??Infinity))[0];
    if(!Number.isFinite(distances.get(u)))break;
    remaining.delete(u); if(u===to)break;
    for(const [a,b] of roadEdges){const v=a===u?b:b===u?a:null;if(!v||!remaining.has(v))continue;
      const cost=distances.get(u)!+Math.hypot(roadNodes[u][0]-roadNodes[v][0],roadNodes[u][2]-roadNodes[v][2]);
      if(cost<(distances.get(v)??Infinity)){distances.set(v,cost);previous.set(v,u);}
    }
  }
  if(!distances.has(to))throw new Error('No legal road route');
  const path=[to];while(path[0]!==from)path.unshift(previous.get(path[0])!);
  return path.map(id=>roadNodes[id]);
}
export const pathLength=(path:Point[])=>path.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-path[i][0],p[2]-path[i][2]),0);
export const fareFor=(id:string)=>Math.min(120,30+Math.ceil(pathLength(roadPath(nodeKey(CAR_PARK_BAY),nodeKey(locationById(id).kekeStop)))/45)*10);
export const kekeDestinations=campusLocations.filter(l=>l.mapVisible).map((l,i)=>({id:l.id,name:l.shortName,position:l.kekeStop,stopIndex:i,fare:fareFor(l.id),icon:l.id==='library'?'📚':l.type==='college'?'🏛️':'📍',description:l.description}));
export const routeStops=['car-park','food-court','sports-centre','health-centre','colvet','senate-library','colbios','colcoms','collend','coleng','hostel-social','agromet','fpy-farm','party-hall','colplant','bank-atm','w-landmark','main-gate','library','colbios-lecture-hall','colfhec','floral-world','colanim'];
export const publicRoute:Point[]=routeStops.flatMap((id,i)=>roadPath(nodeKey(locationById(id).kekeStop),nodeKey(locationById(routeStops[(i+1)%routeStops.length]).kekeStop)).slice(0,-1));
export const roadBounds=roadEdges.map(([a,b])=>({minX:Math.min(roadNodes[a][0],roadNodes[b][0])-5,maxX:Math.max(roadNodes[a][0],roadNodes[b][0])+5,minZ:Math.min(roadNodes[a][2],roadNodes[b][2])-5,maxZ:Math.max(roadNodes[a][2],roadNodes[b][2])+5}));
// Shared conservative collider envelopes; route safety uses swept vehicle clearance.
export const campusObstacles=campusLocations.filter(l=>l.footprint[0]>0).map(l=>({id:l.id,minX:l.position[0]-l.footprint[0]/2,maxX:l.position[0]+l.footprint[0]/2,minZ:l.position[2]-l.footprint[1]/2,maxZ:l.position[2]+l.footprint[1]/2}));
export function canAdvance(a:Point,b:Point,obstacles=campusObstacles):boolean{
  const length=Math.hypot(a[0]-b[0],a[2]-b[2]);
  for(let i=0;i<=Math.ceil(length/.4);i++){
    const t=i/Math.max(1,Math.ceil(length/.4)),x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
    if(!roadBounds.some(r=>x>=r.minX+1.6&&x<=r.maxX-1.6&&z>=r.minZ+1.6&&z<=r.maxZ-1.6))return false;
    if(obstacles.some(o=>x>o.minX-1.7&&x<o.maxX+1.7&&z>o.minZ-1.7&&z<o.maxZ+1.7))return false;
  }return true;
}
