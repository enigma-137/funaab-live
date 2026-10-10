import { locationById } from './campusLocations';
import type { CampusJob } from '../types/game';
export const CAMPUS_JOBS: CampusJob[] = [
 {id:'job-food-delivery',type:'delivery',title:'Floral World food delivery',reward:250,icon:'🍲',source:'Floral World pickup',sourcePos:locationById('floral-world').entrance,destination:'COLENG forecourt',destinationPos:locationById('coleng').entrance,description:'Collect a hot order and deliver it to COLENG.',status:'available'},
 {id:'job-medical-errand',type:'errand',title:'Health Centre dispatch',reward:200,icon:'📋',source:'Health Centre',sourcePos:locationById('health-centre').entrance,destination:'Senate Registry',destinationPos:locationById('senate-library').entrance,description:'Collect the sealed envelope and hand it to the registry.',status:'available'},
 {id:'job-sports-cones',type:'sports',title:'Sports Centre pitch check',reward:175,icon:'⚽',source:'Sports Centre equipment',sourcePos:locationById('sports-centre').entrance,destination:'Goalpost inspection',destinationPos:[-100,0,12],description:'Collect cones, check the pitch for 15 seconds, then finish at the goalpost.',status:'available'},
 {id:'job-game-den',type:'grounds',title:'Game Den controller shift',reward:200,icon:'🎮',source:'Game Den counter',sourcePos:locationById('ps-room').entrance,destination:'Controller station',destinationPos:[86,0,10],description:'Collect the controller kit, check the station for 15 seconds, then return the kit.',status:'available'},
];
