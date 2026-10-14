import { locationById } from './campusLocations';
import type { CampusJob } from '../types/game';
import { ECONOMY_CONFIG, deliveryReward } from './economy';

const floralPickup = locationById('floral-world').entrance, colengEntrance = locationById('coleng').entrance;
// Drop-off just in front of COLENG's door, with a wide radius: students walk up to the door, which
// used to be 6 m from the old forecourt point and outside its 5 m radius (migration 027).
const colengDropoff: [number, number, number] = [80, 0, -54];
export const CAMPUS_JOBS: CampusJob[] = [
 {id:'job-food-delivery',type:'delivery',title:'Floral World food delivery',reward:deliveryReward(floralPickup,colengEntrance),icon:'🍲',source:'Floral World pickup',sourcePos:floralPickup,destination:'COLENG entrance',destinationPos:colengDropoff,destRadius:7.5,description:'Collect a hot order and deliver it to COLENG.',status:'available'},
 {id:'job-medical-errand',type:'errand',title:'Health Centre dispatch',reward:ECONOMY_CONFIG.JOB_REWARDS['job-medical-errand'],icon:'📋',source:'Health Centre',sourcePos:locationById('health-centre').entrance,destination:'Senate Registry',destinationPos:locationById('senate-library').entrance,description:'Collect the sealed envelope and hand it to the registry.',status:'available'},
 {id:'job-sports-cones',type:'sports',title:'Sports Centre pitch check',reward:ECONOMY_CONFIG.JOB_REWARDS['job-sports-cones'],icon:'⚽',source:'Sports Centre equipment',sourcePos:locationById('sports-centre').entrance,destination:'Goalpost inspection',destinationPos:[-100,0,12],description:'Collect cones, check the pitch for 15 seconds, then finish at the goalpost.',status:'available'},
 {id:'job-game-den',type:'grounds',title:'Game Den controller shift',reward:ECONOMY_CONFIG.JOB_REWARDS['job-game-den'],icon:'🎮',source:'Game Den counter',sourcePos:locationById('ps-room').entrance,destination:'Controller station',destinationPos:[86,0,10],description:'Collect the controller kit, check the station for 15 seconds, then return the kit.',status:'available'},
];
