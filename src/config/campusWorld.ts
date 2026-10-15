import base from '../worlds/funaab/world.json';
import { ARCADE_TABLES, HALL_BOUNDS, PARTY_HALL } from './partyHall';
import { FPY_FARM, FARM_BOUNDS, FARM_STEPS, FARM_SHIFT } from './fpyFarm';
import { campusLocations, collegeCatalogue, locationById, CAMPUS_BOUNDS, CAMPUS_SPAWN, type Point } from './campusLocations';
import { roadBounds, kekeDestinations, publicRoute, routeStops, ROUTE_FARE } from './kekeRoutes';
import { LECTURE_HALLS } from './lectureHalls';
import { CAMPUS_BET_SHOP } from './campusBet';
import { FOOD_VENDOR_LIST, VENDOR_PLAZA, vendorCounter } from './foodVendors';
import { bedSpots, waitingSpots, HC_INTERIOR } from './healthCentre';
import { FOOTBALL_PITCH } from './football';
import { BASKETBALL_COURT } from './basketball';
import { VOLLEYBALL_COURT } from './volleyball';
import { courtBenchSeats } from './courtBenches';
import { LOVE_GARDEN_PAVING, loveGardenBenches } from './loveGarden';
import { PHOTO_SPOTS, POS_KIOSK } from './hustles';
import { LODGE } from './lodge';
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
// Order right at the serving counter too, not only at the entrance (the terrace seats used to win there).
const floralCounter = {
  id: 'floral-world-order-counter', type: 'food' as const, label: 'Floral World Restaurant Counter',
  actionText: 'Order Floral World Specials (from ₦500)',
  position: [restaurant.position[0], 0, restaurant.position[2] - 0.6] as Point, radius: 1.6,
};
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
/** Restaurant seats with a table in front: food bought here is served on the table. */
export const DINING_SPOTS = [
  // Floral World: round tables, top at 0.89 m, the table centre 0.8 m in front of each chair.
  ...restaurantDiningSeats.map((s) => ({ position: s.position, tableTop: 0.89, reach: 0.45 })),
  // Buka (food court) picnic tables: top at 0.8 m, centre 1.25 m in front of each bench.
  ...foodCourtSeats.map((s) => ({ position: s.position, tableTop: 0.8, reach: 0.85 })),
];
/** The table spot (height and distance in front) for someone sitting at this position, if any. */
export function diningSpotAt(p: [number, number, number] | undefined) {
  if (!p) return null;
  const spot = DINING_SPOTS.find((s) => Math.hypot(s.position[0] - p[0], s.position[2] - p[2]) < 0.4);
  return spot ? { y: spot.tableTop, z: spot.reach } : null;
}
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
// Love Garden: two seats per bench, every seat facing the tree. Reuses the campus bench sit flow.
const loveGardenSeats = loveGardenBenches.flatMap((bench) =>
  bench.seats.map((position, seat) => ({
    id: `love-garden-seat-${bench.index}-${seat}`,
    type: 'bench' as const,
    label: 'Love Garden Bench',
    actionText: 'Sit',
    position,
    radius: 1.1,
    rotation: bench.rotation,
  })),
);
const penaltySpot = {
  id: 'sports-penalty-spot',
  type: 'football' as const,
  label: 'Sports Centre · Penalty Challenge',
  actionText: 'Practice or 1v1 Penalty Challenge',
  position: FOOTBALL_PITCH.shooterSpot,
  radius: FOOTBALL_PITCH.interactionRadius,
  targetId: 'sports-centre',
};
const freeThrowLine = {
  id: 'sports-free-throw-line',
  type: 'basketball' as const,
  label: 'Basketball Court · Free Throws',
  actionText: 'Practice or 1v1 Free-Throw Shootout',
  position: BASKETBALL_COURT.shooterSpot,
  radius: BASKETBALL_COURT.interactionRadius,
  targetId: 'sports-courts',
};
const halfX = (c: { centre: Point }, w: number, d: number) => ({ minX: c.centre[0] - w / 2, maxX: c.centre[0] + w / 2, minZ: c.centre[2] - d / 2, maxZ: c.centre[2] + d / 2 });
/** Hard-court surfaces (with run-off) are walkable, not lawn. */
export const COURT_ZONES = {
  basketball: halfX(BASKETBALL_COURT, BASKETBALL_COURT.length + 3, BASKETBALL_COURT.width + 3),
  volleyball: halfX(VOLLEYBALL_COURT, VOLLEYBALL_COURT.width + 3, VOLLEYBALL_COURT.length + 3),
  /** Paved courtside joining the pitch, both courts and the walkway to the road. */
  apron: { minX: -121, maxX: -82, minZ: 17, maxZ: 41 },
};
const serveLine = {
  id: 'sports-serve-line',
  type: 'volleyball' as const,
  label: 'Volleyball Court · Serves',
  actionText: 'Practice or 1v1 Serve-off',
  position: VOLLEYBALL_COURT.serveSpot,
  radius: VOLLEYBALL_COURT.interactionRadius,
  targetId: 'sports-courts',
};
export const OUTSIDE_GATE = {
  gateWalk:{minX:-9,maxX:9,minZ:80,maxZ:95},
  road:{minX:-48,maxX:48,minZ:93,maxZ:98},
  betFrontage:{minX:CAMPUS_BET_SHOP.position[0]-7,maxX:CAMPUS_BET_SHOP.position[0]+7,minZ:97,maxZ:CAMPUS_BET_SHOP.position[2]+CAMPUS_BET_SHOP.footprint[1]/2},
};
const outsideGateZones=[
  {id:'gate-walk',name:'Main Gate',type:'path',restricted:false,bounds:OUTSIDE_GATE.gateWalk},
  {id:'gate-road',name:'Gate Road',type:'road',restricted:false,bounds:OUTSIDE_GATE.road},
  {id:'campus-bet-frontage',name:'Campus Bet',type:'plaza',restricted:false,bounds:OUTSIDE_GATE.betFrontage},
  {id:'food-vendor-plaza',name:'Food Court',type:'plaza',restricted:false,bounds:VENDOR_PLAZA},
  {id:'lodge-frontage',name:LODGE.name,type:'plaza',restricted:false,bounds:LODGE.frontage},
];
const world={...base,spawn:CAMPUS_SPAWN,bounds:CAMPUS_BOUNDS,colleges:collegeCatalogue,locations:campusLocations,
  interactables:[...base.interactables.filter(i=>i.id!=='floral-world-dining').map(i=>({...i,position:locationById(interactableLocations[i.id]).entrance,label:i.id==='keke-stop-1'?'Car Park Keke':i.label,actionText:i.id==='keke-stop-1'?'Book Ride':i.actionText})),...restaurantDiningSeats,floralCounter,...foodCourtSeats,...libraryFrontSeats,...colfhecForecourtSeats,...bedSpots,...waitingSpots,...loveGardenSeats,...courtBenchSeats,penaltySpot,freeThrowLine,serveLine,
    {id:'lodge-door',type:'lodge',label:LODGE.name,actionText:'Lodge agent · rent or go home',position:LODGE.door,radius:3,targetId:'lodge'},
    {id:'party-door',type:'party',label:'The Arena',actionText:'Night party · ₦5,000',position:PARTY_HALL.entrance,radius:4,targetId:'party-hall'},
    ...ARCADE_TABLES.map(t=>({id:`arcade-${t.id}`,type:'arcade',label:t.label,actionText:t.game==='pool'?'Play pool':'Play tic-tac-toe',position:t.at,radius:2.6,targetId:t.id})),
    {id:'hustle-fpy-farm',type:'hustle',label:'FPY Farm · Hustle',actionText:'Farm shift',position:FPY_FARM.gate,radius:4,targetId:'farm'},
    ...FARM_STEPS.map(s=>({id:`hustle-farm-${s.id}`,type:'hustle',label:`FPY Farm · ${s.label}`,actionText:s.verb,position:s.spot,radius:FARM_SHIFT.stepRadius,targetId:`farm-${s.id}`})),
    {id:'hustle-pos-kiosk',type:'hustle',label:'POS kiosk · Hustle',actionText:'POS kiosk shift',position:POS_KIOSK.serviceSpot,radius:POS_KIOSK.radius,targetId:'pos'},
    ...PHOTO_SPOTS.map(s=>({id:`hustle-${s.id}`,type:'hustle',label:s.title,actionText:'Take photos',position:s.position,radius:s.radius,targetId:s.id})),{id:'library-visit',type:'library',label:'Library',actionText:'Enter Library',position:library.entrance,radius:5,targetId:'library'},
    ...FOOD_VENDOR_LIST.map(v=>({id:`vendor-${v.id}`,type:'food_vendor',label:v.name,actionText:v.actionLabel,position:vendorCounter(v),radius:2.6,targetId:v.id})),
    {id:'campus-bet-counter',type:'campus_bet',label:'Campus Bet',actionText:'Open Campus Bet',position:CAMPUS_BET_SHOP.counter,radius:CAMPUS_BET_SHOP.interactionRadius,targetId:CAMPUS_BET_SHOP.id},
    // Every college hall without a hand-placed world.json entry gets the same lecture-hall interaction.
    ...LECTURE_HALLS.filter(h=>!h.legacyInteractable).map(h=>({id:h.interactableId,type:'lecture_hall',label:h.hallName,actionText:'Enter Lecture Hall',position:h.entrance,radius:4.5,targetId:h.id}))],
  terrainZones:[{id:'health-centre-interior',name:'Health Centre',type:'building',restricted:false,bounds:HC_INTERIOR},{id:'acad-interior',name:'Acad',type:'building',restricted:false,bounds:{minX:-125,maxX:-91,minZ:-36,maxZ:-24}},...roadBounds.map((bounds,i)=>({id:`road-${i}`,name:'Campus road',type:'road',restricted:false,bounds})),...pedestrianPaths,
    ...campusLocations.map(l=>({id:`forecourt-${l.id}`,name:l.shortName,type:l.id==='sports-centre'?'sports':'plaza',restricted:false,bounds:corridor(l.entrance,l.entrance,7)})),
    {id:'sports-turf',name:'Sports Centre',type:'sports',restricted:false,bounds:{minX:-118,maxX:-80,minZ:-18,maxZ:18}},
    {id:'basketball-court',name:'Basketball Court',type:'sports',restricted:false,bounds:COURT_ZONES.basketball},
    {id:'volleyball-court',name:'Volleyball Court',type:'sports',restricted:false,bounds:COURT_ZONES.volleyball},
    {id:'courtside',name:'Courtside',type:'plaza',restricted:false,bounds:COURT_ZONES.apron},
    // Acad's front apron along its whole facade, joining the pitch-side walk.
    {id:'acad-apron',name:'Acad',type:'plaza',restricted:false,bounds:{minX:-125,maxX:-91,minZ:-24.5,maxZ:-17.5}},
    // Outside the main gate: the gate walk, the public road and the Campus Bet frontage are paved.
    ...outsideGateZones,
    {id:'love-garden-plaza',name:'Love Garden',type:'plaza',restricted:false,bounds:LOVE_GARDEN_PAVING.plaza},
    {id:'love-garden-walk',name:'Love Garden walkway',type:'path',restricted:false,bounds:LOVE_GARDEN_PAVING.walkway},
    {id:'love-garden-connector',name:'Love Garden walkway',type:'path',restricted:false,bounds:LOVE_GARDEN_PAVING.connector},
    // The Arena: inside is a building; its forecourt joins the walkway.
    {id:'party-hall-inside',name:'The Arena',type:'building',restricted:false,bounds:HALL_BOUNDS},
    {id:'party-hall-forecourt',name:'The Arena',type:'plaza',restricted:false,bounds:{minX:PARTY_HALL.entrance[0]-3,maxX:HALL_BOUNDS.minX+0.5,minZ:PARTY_HALL.entrance[2]-4,maxZ:PARTY_HALL.entrance[2]+4}},
    // The farm's soil and paths are open to everyone (no lawn fine).
    {id:'fpy-farm',name:'FPY Farm',type:'plaza',restricted:false,bounds:{...FARM_BOUNDS,minX:FARM_BOUNDS.minX-3}},
    {id:'lawns',name:'Campus lawns',type:'lawn',restricted:true,bounds:CAMPUS_BOUNDS}],
  kekeDestinations,kekeRoutes:[{id:'route-alpha',name:'Public campus route',fare:ROUTE_FARE,waypoints:publicRoute,stops:routeStops.map(id=>({id,name:locationById(id).shortName,position:locationById(id).kekeStop,duration:4}))}],
  securityRoutes:base.securityRoutes.map(r=>({...r,points:r.points.map(p=>[p[0]*1.6,p[1],p[2]*1.6])})),
};
export default world;
