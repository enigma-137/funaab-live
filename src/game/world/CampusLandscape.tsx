import React,{useMemo,useEffect,useLayoutEffect,useRef} from 'react';
import * as THREE from 'three';
import { campusLocations,locationById,type Point } from '../../config/campusLocations';
import { pedestrianPaths } from '../../config/campusWorld';
import { roadBounds } from '../../config/kekeRoutes';
import { VisualBuilder,campusMaterials,type Batch } from './campusVisualGeometry';
import { StaticBatches } from './CampusArchitecture';
import { CampusSign } from './CampusSign';
export type TreeSpec={pos:Point;scale:number;type:'neem'|'palm'};
export const avenueTrees:TreeSpec[]=[[-130,-120],[-130,-60],[-130,0],[-130,85],[130,-120],[130,-60],[130,0],[130,85],[-20,10],[40,10],[-35,85],[40,95],[-15,-120],[65,-120]].map(([x,z],i)=>({pos:[x,0,z],scale:.85+(i%5)*.08,type:i%2===0?'palm':'neem'}));
const ids=['colerm','colfhec','colvet','library'];
export function isClearPlanting(x:number,z:number,radius=.8){
  if([...roadBounds,...pedestrianPaths.map(p=>p.bounds)].some(b=>x+radius>b.minX&&x-radius<b.maxX&&z+radius>b.minZ&&z-radius<b.maxZ))return false;
  return !campusLocations.some(l=>l.footprint[0]>0&&Math.abs(x-l.position[0])<l.footprint[0]/2+radius&&Math.abs(z-l.position[2])<l.footprint[1]/2+radius);
}
export const gardenTrees:TreeSpec[]=ids.flatMap((id,i)=>{
  const l=locationById(id),[w,d]=l.footprint;
  return [-1,1].flatMap(side=>[[-side*(w/2+2.4),d/2+2.4],[side*(w/2+2.6),-d/2-2.2]].map(([x,z],j)=>({pos:[x+l.position[0],0,z+l.position[2]] as Point,scale:.85+(i%2)*.1,type:(j===0?'neem':'palm') as 'neem'|'palm'}))).filter(t=>isClearPlanting(t.pos[0],t.pos[2]));
});
export function buildTree(type:'neem'|'palm'){
  const b=new VisualBuilder();
  if(type==='neem'){
    b.pole([0,1.6,0],.32,3.2,'bark');
    for(let i=0;i<5;i++){
      const a=i*2.4;b.pole([Math.cos(a)*.45,2.5,Math.sin(a)*.45],.10,1.7,'bark',[Math.sin(a)*.55,0,Math.cos(a)*.55]);
      b.orb([Math.cos(a)*1.05,3.65+(i%2)*.5,Math.sin(a)*1.05],[1.35,1.05,1.3],i%2?'foliage':'leafLight');
    }
    b.orb([0,4.55,0],[1.4,.95,1.35],'foliage');
  }else{
    b.pole([0,2.5,0],.26,5,'bark');
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      // Folded, tapering fronds: an arched centre spine with drooping leaf edges.
      const vertices:number[]=[];
      const point=(t:number,side:number)=>{const length=t*3.2,width=Math.sin(t*Math.PI)*.48;return [length,5.05+Math.sin(t*Math.PI)*.6-t*.72-Math.abs(side)*width*.35,side*width];};
      for(let j=0;j<7;j++)for(const side of [-1,1]){
        const a=point(j/7,0),c=point((j+1)/7,0),d=point((j+1)/7,side),e=point(j/7,side);
        const faces=side===1?[a,d,c,a,e,d]:[a,c,d,a,d,e];vertices.push(...faces.flat());
      }
      const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();b.add(g,i%2?'leafLight':'foliage',[0,0,0],[1,1,1],[0,angle,0]);
    }
    b.orb([0,4.85,0],[.4,.42,.4],'leafDark');
  }
  return b.finish();
}
function TreeInstances({type,trees}:{type:'neem'|'palm';trees:TreeSpec[]}){
  const batches=useMemo(()=>buildTree(type),[type]);const refs=useRef<(THREE.InstancedMesh|null)[]>([]);
  useEffect(()=>()=>batches.forEach(b=>b.geometry.dispose()),[batches]);
  useLayoutEffect(()=>{const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),p=new THREE.Vector3();refs.current.forEach(mesh=>{if(!mesh)return;trees.forEach((t,i)=>{q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,i*2.4);matrix.compose(p.set(...t.pos),q,s.setScalar(t.scale));mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();});},[trees,batches]);
  return <group dispose={null}>{batches.map((b,i)=><instancedMesh key={b.material} ref={el=>{refs.current[i]=el;}} args={[b.geometry,campusMaterials[b.material],trees.length]} castShadow receiveShadow/>)}</group>;
}
export function CampusTrees(){
  const lists=useMemo(()=>{const all=[...avenueTrees,...gardenTrees];return {neem:all.filter(t=>t.type==='neem'),palm:all.filter(t=>t.type==='palm')};},[]);
  return <group name="campus-tree-instances"><TreeInstances type="neem" trees={lists.neem}/><TreeInstances type="palm" trees={lists.palm}/></group>;
}
export function buildForecourt(id:string):Batch[]{
  const l=locationById(id),[w,d]=l.footprint,b=new VisualBuilder(),front=d/2;
  // Ground-level overlays do not create steps or change the walkable floor.
  b.box([0,.028,front+1.9],[w+1,.045,3.8],'paving');
  for(const side of [-1,1]){
    const x=side*(w/2-.7);
    b.box([x,.07,front+1.7],[1.25,.08,2.7],'gravel');
    for(let j=0;j<5;j++){b.orb([x,.38,front+.65+j*.5],[.51,.34,.4],j%2?'foliage':'leafLight');if(j%2===0)b.orb([x+.25,.59,front+.7+j*.5],[.10,.11,.10],'flower');}
    for(let j=0;j<6;j++)b.box([x-side*.8,.13,front+.4+j*.5],[.18,.20,.48],j%2?'curb':'curbDark');
    const lampX=side*(w/2-2.2);
    b.pole([lampX,1.8,front+1.4],.055,3.6,'metal');b.orb([lampX,3.68,front+1.4],[.20,.23,.20],'ivory');
    // Benches sit in the planted edge, away from the centre approach.
    const benchX=side*(w/2-3.7);
    for(const z of [front+.7,front+.98,front+1.26])b.box([benchX,.48,z],[1.7,.09,.20],'wood');
    b.box([benchX,.86,front+.62],[1.7,.55,.08],'wood');
    for(const dx of [-.58,.58])b.box([benchX+dx,.24,front+.98],[.10,.48,.5],'metal');
  }
  return b.finish();
}
function Forecourt({id}:{id:string}){const batches=useMemo(()=>buildForecourt(id),[id]);useEffect(()=>()=>batches.forEach(b=>b.geometry.dispose()),[batches]);return <group position={locationById(id).position}><StaticBatches batches={batches}/></group>;}
const notices=[
  {p:[-7.8,0,78] as Point,title:'WELCOME TO FUNAAB',sub:'LEARN  /  EXPLORE  /  BELONG',w:4.6},
  {p:[8.5,0,12] as Point,title:'LIBRARY  →',sub:'COLLEGES  ↑     MAIN GATE  ↓',w:3.2},
  {p:[-40,0,-53] as Point,title:'CAMPUS NOTICEBOARD',sub:'STUDENT SOCIETIES  •  READING GROUPS  •  SPORTS',w:3.6},
];
export function CampusGardens(){return <group name="reference-building-gardens">{ids.map(id=><Forecourt key={id} id={id}/>)}{notices.map(n=><group key={n.title} position={n.p}>
  {[-1,1].map(side=><mesh key={side} position={[side*(n.w/2-.25),1.25,0]} material={campusMaterials.metal}><cylinderGeometry args={[.06,.07,2.5,6]}/></mesh>)}
  <CampusSign position={[0,2.4,0]} width={n.w} height={n.title.includes('NOTICE')?1.25:.95} title={n.title} subtitle={n.sub}/>
</group>)}</group>;}
