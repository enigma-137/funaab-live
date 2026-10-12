import base from '../worlds/funaab/world.json';
import { campusLocations, collegeCatalogue, locationById, CAMPUS_BOUNDS, CAMPUS_SPAWN, type Point } from './campusLocations';
import { roadBounds, kekeDestinations, publicRoute, routeStops, ROUTE_FARE } from './kekeRoutes';
import { LECTURE_HALLS } from './lectureHalls';
import { CAMPUS_BET_SHOP } from './campusBet';
const corridor=(a:Point,b:Point,width=3)=>({minX:Math.min(a[0],b[0])-width/2,maxX:Math.max(a[0],b[0])+width/2,minZ:Math.min(a[2],b[2])-width/2,maxZ:Math.max(a[2],b[2])+width/2});
export const pedestrianPaths=campusLocations.flatMap(l=>{
  const a=l.kekeStop,b=l.entrance,w=l.footprint[0]/2,d=l.footprint[1]/2;
  const wrap=w>0&&a[2]<l.position[2]-d&&b[2]>l.position[2]+d;
  const side=l.position[0]+w+4;
  const points:Point[]=wrap?[a,[side,0,a[2]],[side,0,b[2]],b]:[a,[a[0],0,b[2]],b];
  return points.slice(1).map((p,i)=>({id:`walk-${l.id}-${i}`,name:`${l.shortName} walkway`,type:'path',restricted:false,bounds:corridor(points[i],p)}));
});
const interactableLocations:Record<string,string>={'atm-terminal-1':'bank-atm','food-stall-1':'food-court','floral-world-counter':'floral-world','lecture-hall-colfhec':'colfhec-lecture-hall','lecture-hall-central':'central-lecture-hall','lecture-hall-colbios':'colbios-lecture-hall','ps5-station-1':'ps-room','keke-stop-1':'car-park','job-board-carpark':'car-park','job-board-food':'food-court','job-board-sports':'sports-centre'};
const restaurant = locationById('floral-world');
const restaurantDiningSeats = [-2.2, 2.2].flatMap((x, table) =>
  [-0.8, 0.8].map((z, chair) => ({
    id: `floral-world-seat-${table}-${chair}`,
    type: 'restaurant_dining' as const,
    label: 'Floral World Dining Seat',
    actionText: 'Sit & Dine',
    position: [restaurant.position[0] + x, 0, restaurant.position[2] + 1.8 + z] as Point,
    radius: 1.8,
    rotation: chair === 0 ? 0 : Math.PI,
  })),
);
const foodCourt = locationById('food-court');
const foodCourtSeats = [-4.5, 4.5].flatMap((x, table) =>
  [-1, 1].map((side) => ({
    id: `food-court-seat-${table}-${side === -1 ? 'near' : 'far'}`,
    type: 'bench' as const,
    label: 'Tantalizers Picnic Table',
    actionText: 'Sit at Picnic Table',
    position: [foodCourt.position[0] + x, 0, foodCourt.position[2] + 3 + side * 1.25] as Point,
    radius: 1.8,
    rotation: side === -1 ? 0 : Math.PI,
  })),
);
const library = locationById('library');
const libraryFrontSeats = [-1, 1].map((side) => ({
  id: `library-front-bench-${side === -1 ? 'left' : 'right'}`,
  type: 'bench' as const,
  label: 'Library Front Bench',
  actionText: 'Sit on Bench',
  position: [
    library.position[0] + side * (library.footprint[0] / 2 - 3.7),
    0,
    library.position[2] + library.footprint[1] / 2 + 0.98,
  ] as Point,
  radius: 2,
  rotation: 0,
}));
const colfhec = locationById('colfhec');
const colfhecForecourtSeats = [-1, 1].map((side) => ({
  id: `colfhec-forecourt-bench-${side === -1 ? 'left' : 'right'}`,
  type: 'bench' as const,
  label: 'COLFHEC Forecourt Bench',
  actionText: 'Sit on Bench',
  position: [
    colfhec.position[0] + side * (colfhec.footprint[0] / 2 - 3.7),
    0,
    colfhec.position[2] + colfhec.footprint[1] / 2 + 0.98,
  ] as Point,
  radius: 2,
  rotation: 0,
}));
export const OUTSIDE_GATE = {
  gateWalk:{minX:-9,maxX:9,minZ:80,maxZ:95},
  road:{minX:-48,maxX:48,minZ:93,maxZ:98},
  betFrontage:{minX:CAMPUS_BET_SHOP.position[0]-7,maxX:CAMPUS_BET_SHOP.position[0]+7,minZ:97,maxZ:CAMPUS_BET_SHOP.position[2]+CAMPUS_BET_SHOP.footprint[1]/2},
};
const outsideGateZones=[
  {id:'gate-walk',name:'Main Gate',type:'path',restricted:false,bounds:OUTSIDE_GATE.gateWalk},
  {id:'gate-road',name:'Gate Road',type:'road',restricted:false,bounds:OUTSIDE_GATE.road},
  {id:'campus-bet-frontage',name:'Campus Bet',type:'plaza',restricted:false,bounds:OUTSIDE_GATE.betFrontage},
];
const world={...base,spawn:CAMPUS_SPAWN,bounds:CAMPUS_BOUNDS,colleges:collegeCatalogue,locations:campusLocations,
  interactables:[...base.interactables.filter(i=>i.id!=='floral-world-dining').map(i=>({...i,position:locationById(interactableLocations[i.id]).entrance,label:i.id==='keke-stop-1'?'Car Park Keke':i.label,actionText:i.id==='keke-stop-1'?'Book Ride':i.actionText})),...restaurantDiningSeats,...foodCourtSeats,...libraryFrontSeats,...colfhecForecourtSeats,{id:'library-visit',type:'library',label:'Library',actionText:'Enter Library',position:library.entrance,radius:5,targetId:'library'},
    {id:'campus-bet-counter',type:'campus_bet',label:'Campus Bet',actionText:'Open Campus Bet',position:CAMPUS_BET_SHOP.counter,radius:CAMPUS_BET_SHOP.interactionRadius,targetId:CAMPUS_BET_SHOP.id},
    // Every college hall without a hand-placed world.json entry gets the same lecture-hall interaction.
    ...LECTURE_HALLS.filter(h=>!h.legacyInteractable).map(h=>({id:h.interactableId,type:'lecture_hall',label:h.hallName,actionText:'Enter Lecture Hall',position:h.entrance,radius:4.5,targetId:h.id}))],
  terrainZones:[...roadBounds.map((bounds,i)=>({id:`road-${i}`,name:'Campus road',type:'road',restricted:false,bounds})),...pedestrianPaths,
    ...campusLocations.map(l=>({id:`forecourt-${l.id}`,name:l.shortName,type:l.id==='sports-centre'?'sports':'plaza',restricted:false,bounds:corridor(l.entrance,l.entrance,7)})),
    {id:'sports-turf',name:'Sports Centre',type:'sports',restricted:false,bounds:{minX:-118,maxX:-80,minZ:-18,maxZ:18}},
    // Outside the main gate: the gate walk, the public road and the Campus Bet frontage are paved.
    ...outsideGateZones,
    {id:'lawns',name:'Campus lawns',type:'lawn',restricted:true,bounds:CAMPUS_BOUNDS}],
  kekeDestinations,kekeRoutes:[{id:'route-alpha',name:'Public campus route',fare:ROUTE_FARE,waypoints:publicRoute,stops:routeStops.map(id=>({id,name:locationById(id).shortName,position:locationById(id).kekeStop,duration:4}))}],
  securityRoutes:base.securityRoutes.map(r=>({...r,points:r.points.map(p=>[p[0]*1.6,p[1],p[2]*1.6])})),
};
export default world;
