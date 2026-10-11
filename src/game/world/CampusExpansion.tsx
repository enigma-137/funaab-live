import { CampusRoadFinish } from './CampusLandscape';
import { CampusArchitecture } from './CampusArchitecture';
import { CampusSign } from './CampusSign';
import { campusMaterials } from './campusVisualGeometry';
import React, { useRef } from 'react';
import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { campusLocations, collegeCatalogue, locationById, type Point } from '../../config/campusLocations';
import { pedestrianPaths } from '../../config/campusWorld';
import { roadEdges, roadNodes } from '../../config/kekeRoutes';
import { useGameStore } from '../../stores/gameStore';
const cube=new THREE.BoxGeometry(1,1,1);
const materials={wall:new THREE.MeshStandardMaterial({color:'#e9e5d8'}),roof:new THREE.MeshStandardMaterial({color:'#344957'}),glass:new THREE.MeshStandardMaterial({color:'#387b8c'}),wood:new THREE.MeshStandardMaterial({color:'#997354'})};
const Block=({p,s,m='wall'}:{p:Point;s:Point;m?:keyof typeof materials})=><mesh geometry={cube} material={materials[m]} position={p} scale={s}/>;
export function CollegeWallSign({position,width,height,code,name}:{position:Point;width:number;height:number;code:string;name:string}){
  return <CampusSign position={position} width={width} height={height} title={code} subtitle={name}/>;
}

export function NearbyLabel({position,children}:{position:Point;children:React.ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  const point=React.useMemo(()=>new THREE.Vector3(...position),[...position]);
  useFrame(({camera})=>{if(ref.current)ref.current.style.visibility=camera.position.distanceToSquared(point)<40*40?'visible':'hidden';});
  return <Html position={position} center zIndexRange={[5,0]} style={{pointerEvents:'none'}}><div ref={ref} style={{whiteSpace:'nowrap',background:'#eaf0df',color:'#1f4735',border:'1px solid #a8bda1',borderRadius:4,padding:'3px 6px',fontSize:11,fontWeight:700}}>{children}</div></Html>;
}
export function CampusRoads(){return <group><CampusRoadFinish/>
  {roadEdges.map(([a,b],i)=>{const p=roadNodes[a],q=roadNodes[b],vertical=p[0]===q[0],length=Math.hypot(p[0]-q[0],p[2]-q[2]);return <group key={i} position={[(p[0]+q[0])/2,0,(p[2]+q[2])/2]}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><planeGeometry args={vertical?[13,length+2]:[length+2,13]}/><primitive object={campusMaterials.paving} attach="material"/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.022,0]}><planeGeometry args={vertical?[8,length+1]:[length+1,8]}/><primitive object={campusMaterials.road} attach="material"/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.026,0]}><planeGeometry args={vertical?[.13,length]:[length,.13]}/><meshBasicMaterial color="#e4d28a"/></mesh>
  </group>;})}
  {pedestrianPaths.map(p=>{const b=p.bounds;return <mesh key={p.id} rotation={[-Math.PI/2,0,0]} position={[(b.minX+b.maxX)/2,.032,(b.minZ+b.maxZ)/2]}><planeGeometry args={[b.maxX-b.minX,b.maxZ-b.minZ]}/><primitive object={campusMaterials.paving} attach="material"/></mesh>;})}
  {campusLocations.filter(l=>l.mapVisible).map(l=><group key={l.id} position={l.kekeStop}><mesh rotation={[-Math.PI/2,0,0]} position={[3,.04,0]}><planeGeometry args={[1,3]}/><meshBasicMaterial color="#e9bc37"/></mesh></group>)}
  </group>;}
export function CampusExpansion(){return <group>
  {['colvet','colanim','colplant','colcoms','colbios','library'].map((id,i)=>{
    const l=locationById(id),[w,d]=l.footprint,h=id==='library'?7:i===0?5:6;
    return <group key={id} position={l.position} name={l.assetKey}>
      <RigidBody type="fixed" colliders={false}>
        {id==='colvet'?<><CampusArchitecture id="colvet"/><CuboidCollider position={[0,h/2,0]} args={[w/2,h/2,d/2]}/></>:id==='library'?<>
          <CampusArchitecture id="library"/>
          <CuboidCollider position={[0,h/2,-2]} args={[w/2,h/2,(d-4)/2]}/>
        </>:<>
          <Block p={[0,h/2,0]} s={[w,h,d]}/>
          <Block p={[0,h+.3,0]} s={[w+1,.6,d+1]} m="roof"/>
          {id==='colanim'&&<mesh position={[0,h+1,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[w*.58,3,4]}/><meshStandardMaterial color="#95694f"/></mesh>}
          {id==='colplant'&&<Block p={[0,h/2,0]} s={[5,h+2,d+1]} m="glass"/>}
          {id==='colcoms'&&<Block p={[-5,h/2+1,1]} s={[6,h+2,d+1]} m="glass"/>}
          <CuboidCollider position={[0,h/2,0]} args={[w/2,h/2,d/2]}/>
        </>}
        {!['library','colvet'].includes(id)&&[-.35,0,.35].map((x,j)=><Block key={j} p={[x*w,h*.6,d/2+.05]} s={[2,1.5,.1]} m="glass"/>)}
      </RigidBody>
      {!['library','colvet'].includes(id)&&<CollegeWallSign position={[0,h-.95,d/2+.12]} width={Math.min(w-2,18)} height={1.55} code={l.shortName} name={collegeCatalogue.find(c=>c.code===l.shortName)?.name??l.name}/>}
      {!['library','colvet'].includes(id)&&[-1,1].map(side=><group key={side} position={[side*(w/2+5),0,-d/2]}><mesh position={[0,1.3,0]}><cylinderGeometry args={[.18,.24,2.6,5]}/><meshStandardMaterial color="#786446"/></mesh><mesh position={[0,3,0]}><icosahedronGeometry args={[2,0]}/><meshStandardMaterial color={i%2?'#617e49':'#3f7255'}/></mesh></group>)}
    </group>;
  })}
  <NearbyLabel position={[-68,3,55]}>CAMPUS KEKE</NearbyLabel>
  </group>;}
export function KekeRouteDebug(){
  const kekes=useGameStore(s=>s.kekes);
  if(!import.meta.env.DEV||new URLSearchParams(location.search).get('debugKeke')!=='true')return null;
  return <group>{roadEdges.map(([a,b],i)=><Line key={i} points={[roadNodes[a],roadNodes[b]].map(p=>[p[0],.2,p[2]] as Point)} color="cyan" lineWidth={2}/>)}
    {campusLocations.map(l=><mesh key={l.id} position={[l.kekeStop[0],.5,l.kekeStop[2]]}><sphereGeometry args={[.4,6,6]}/><meshBasicMaterial color="yellow"/></mesh>)}
    {Object.values(kekes).map(k=>k.route?.[k.currentWaypointIndex]&&<mesh key={k.id} position={k.route[k.currentWaypointIndex]}><sphereGeometry args={[.8,6,6]}/><meshBasicMaterial color="red"/></mesh>)}
  </group>;
}
