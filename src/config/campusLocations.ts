import base from '../worlds/funaab/world.json';

export type Point = [number, number, number];
export interface CampusLocation {
  id: string; name: string; shortName: string; type: string; position: Point;
  entrance: Point; kekeStop: Point; interactionRadius: number; mapVisible: boolean;
  assetKey: string; footprint: [number, number]; description: string;
  facing: number; // yaw of the front facade: 0 faces +Z, PI/2 faces +X
}
// Coordinates describe locations, never a scale applied to meshes or avatars.
const layout: Record<string, [number, number, number, number, number, number, number, number]> = {
  'main-gate': [0,90, 14,8, 7,78, 0,78],
  'ceremonial-road': [0,65, 0,0, 6,65, 0,65],
  'w-landmark': [20,28, 16,8, 20,37, 20,45],
  'car-park': [-68,60, 0,0, -60,60, -55,60],
  'sports-centre': [-100,0, 0,0, -80,5, -55,5],
  'food-court': [-75,25, 12,8, -75,32, -55,25],
  'health-centre': [-78,-30, 14,10, -78,-22, -55,-22],
  'bank-atm': [30,68, 14,10, 30,75, 30,45],
  'senate-library': [0,-105, 20,12, 0,-96, 0,-85],
  'colfhec': [-30,-65, 22,16, -30,-54, -30,-40],
  'coleng': [80,-65, 32,18, 80,-51, 55,-51],
  'colerm-colplant': [100,-25, 16,12, 100,-16, 55,-16],
  'agromet': [100,20, 14,14, 100,30, 55,30],
  'hostel-social': [78,-5, 24,28, 66,2, 55,2],
  'ps-room': [82,5, 0,0, 82,10, 55,10],
  'floral-world': [-30,-22, 12,12, -26,-16, -55,-16],
  'colfhec-lecture-hall': [-30,-50, 4,2, -30,-48, -30,-40],
  'central-lecture-hall': [0,-62, 4,2, 0,-59, 0,-40],
  'colbios-lecture-hall': [30,-62, 4,2, 30,-59, 30,-40],
  'colvet': [-95,-105, 22,16, -95,-93, -55,-85],
  // Faces east onto the campus road (facing below); footprint is world X × Z after that turn.
  'colanim': [-100,65, 12,28, -90,65, -55,75],
  // Faces west onto the campus road (facing below); footprint is world X × Z after that turn.
  'colplant': [100,65, 14,26, 89,65, 55,76],
  'colcoms': [100,-105, 18,16, 100,-93, 55,-85],
  'colbios': [30,-105, 18,12, 30,-95, 30,-85],
  'library': [20,0, 24,16, 20,12, 0,12],
  'colphys': [-35,-108, 22,14, -35,-97, -35,-85],
};
export const collegeCatalogue = [...base.colleges,
  {code:'COLERM', name:'College of Environmental Resources Management',color:'#0d9488'},
  {code:'COLCOMS', name:'College of Computing Sciences',color:'#4f46e5'},
];
const additions = ['colvet','colanim','colplant','colcoms','colbios','colphys','library'].map(id => ({
  id, name: id==='library' ? "'Nimbe Adedipe Library" : collegeCatalogue.find(c=>c.code===id.toUpperCase())!.name,
  type:id==='library'?'academic':'college',description:id==='library'?'Library lobby and student meeting point.':'College forecourt and campus meeting point.',
}));
const facings: Record<string, number> = { colanim: Math.PI / 2, colplant: -Math.PI / 2 };
export const campusLocations: CampusLocation[] = [...base.locations,...additions].map(l=>{
  const [x,z,w,d,ex,ez,sx,sz]=layout[l.id];
  const id=l.id==='colerm-colplant'?'colerm':l.id;
  const shortName=id==='senate-library'?'Senate / Admin':id==='library'?'Library':id==='hostel-social'?'HOSTEL':id.startsWith('col')&&!id.includes('hall')?id.toUpperCase():l.name.replace('FUNAAB ','');
  return {...l,id,name:id==='colerm'?collegeCatalogue.find(c=>c.code==='COLERM')!.name:id==='senate-library'?'Senate / Administration':l.name,
    shortName,position:[x,0,z],entrance:[ex,0,ez],kekeStop:[sx,0,sz],footprint:[w,d],
    interactionRadius:5,mapVisible:id!=='ceremonial-road',assetKey:'campus_'+id.replaceAll('-','_'),facing:facings[id]??0};
});
export const locationById=(id:string)=>campusLocations.find(l=>l.id===(id==='colerm-colplant'?'colerm':id))!;
export const locationPosition=(id:string):Point=>locationById(id).position;
export const CAMPUS_SPAWN:Point=[7,0,78];
export const CAR_PARK_BAY:Point=[-64,0,64];
export const CAMPUS_BOUNDS={minX:-145,maxX:145,minZ:-145,maxZ:110};
export const campusZoneName=(x:number,z:number)=>{
  const nearest=[...campusLocations].sort((a,b)=>Math.hypot(x-a.position[0],z-a.position[2])-Math.hypot(x-b.position[0],z-b.position[2]))[0];
  return Math.hypot(x-nearest.position[0],z-nearest.position[2])<24?nearest.shortName:'Campus walkways';
};
