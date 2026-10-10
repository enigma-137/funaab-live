import React, { useRef } from 'react';
import { Text } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { useHostelStore } from '../../stores/hostelStore';
import { ROOM_ANCHORS, hostelItem } from '../../config/hostelShop';
import { openHostel } from '../../ui/HostelLife';
function Box({pos,size,color}:{pos:[number,number,number];size:[number,number,number];color:string}) {
 return <mesh position={pos} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color}/></mesh>;
}
export function HostelItemModel({id,ghost=false,tv=false}:{id:string;ghost?:boolean;tv?:boolean}) {
 const screen=useRef<Mesh>(null);
 useFrame(({clock})=>{if(screen.current&&tv)screen.current.scale.x=.7+Math.sin(clock.elapsedTime*2)*.15;});
 const name=hostelItem(id)?.name||id;
 const tvModel=id==='hostel_tv_basic',chair=id==='hostel_chair',table=id==='hostel_table',rug=id==='hostel_rug',wall=['hostel_curtain','hostel_poster'].includes(id),bed=['hostel_pillow','hostel_bedsheet'].includes(id);
 return <group onClick={e=>{e.stopPropagation();useHostelStore.setState({notice:name});}}>
  {tvModel?<><Box pos={[0,.6,0]} size={[1.45,.9,.12]} color={ghost?'#8ce6af':'#27302e'}/><mesh position={[0,.6,.07]}><planeGeometry args={[1.25,.7]}/><meshBasicMaterial color={tv?'#83dcac':'#162121'}/></mesh>{tv&&<mesh ref={screen} position={[0,.6,.08]}><planeGeometry args={[1,.15]}/><meshBasicMaterial color="#f3ca66"/></mesh>}<Box pos={[0,.1,0]} size={[.5,.2,.4]} color="#303c36"/></>:
   chair?<><Box pos={[0,.5,0]} size={[.7,.1,.7]} color="#db8155"/><Box pos={[0,.9,-.3]} size={[.7,.8,.1]} color="#db8155"/>{[-.26,.26].flatMap(x=>[-.26,.26].map(z=><Box key={`${x}${z}`} pos={[x,.25,z]} size={[.08,.5,.08]} color="#df8d63"/>))}</>:
   table?<><Box pos={[0,.7,0]} size={[1.2,.1,.8]} color="#9a7049"/>{[-.5,.5].flatMap(x=>[-.3,.3].map(z=><Box key={`${x}${z}`} pos={[x,.35,z]} size={[.1,.7,.1]} color="#77512e"/>))}</>:
   <Box pos={[0,wall?0:bed?.05:rug?.02:.25,0]} size={wall?[1.1,.9,.06]:bed?[.85,.12,.65]:rug?[1.5,.035,1.3]:[.55,.5,.45]} color={ghost?'#76d6b4':id.includes('fan')?'#81a39c':id.includes('ps')?'#e6e8e4':'#bd925c'}/>}
  {ghost&&<mesh position={[0,.7,0]}><boxGeometry args={[1.5,1.5,1]}/><meshBasicMaterial wireframe color="#20a865" transparent opacity={.35}/></mesh>}
 </group>;
}
export function HostelEnvironment(){
 const {owner,snapshot,preview,travel}=useHostelStore();
 if(!owner)return <group>
  <RigidBody type="fixed" colliders="cuboid"><Box pos={[0,-.2,0]} size={[32,.4,30]} color="#cbbd98"/></RigidBody>
  <RigidBody type="fixed" colliders="cuboid"><Box pos={[-7,2,-4]} size={[9,4,6]} color="#e8d8b6"/><Box pos={[7,1.5,-4]} size={[6,3,5]} color="#649981"/></RigidBody>
  <Box pos={[-7,4.1,-4]} size={[10,.3,7]} color="#597065"/><Box pos={[7,3.1,-4]} size={[7,.25,6]} color="#a56342"/>
  <Text position={[-7,3.2,-.95]} fontSize={.44} color="#244d3a">STUDENT HOSTEL</Text><Text position={[7,2.5,-1.45]} fontSize={.42} color="#fff4d5">IYA IBEJI SHOP</Text>
  <mesh position={[-7,1.2,-.9]} onClick={e=>{e.stopPropagation();travel('room');}}><boxGeometry args={[1.8,2.4,.2]}/><meshStandardMaterial color="#4a6455"/></mesh>
  <mesh position={[7,1,-1.4]} onClick={e=>{e.stopPropagation();openHostel('shop');}}><boxGeometry args={[2,2,.2]}/><meshStandardMaterial color="#dbbe71"/></mesh>
  <Text position={[-7,1.5,.3]} fontSize={.3} color="#173e2a">My Room →</Text><Text position={[7,1.5,-.5]} fontSize={.3} color="#173e2a">Visit Iya Ibeji</Text>
  <Box pos={[8,.35,7]} size={[3,.7,2]} color="#8a8069"/><Text position={[8,1.5,7]} fontSize={.3} color="#294b3b">SECURITY POST</Text>
  <Box pos={[0,.015,8]} size={[3,.03,12]} color="#aaa58f"/>
  <Text position={[0,1,12]} fontSize={.35} color="#224331" onClick={()=>travel('campus')}>← Go Campus</Text>
  <Text position={[0,.1,1]} rotation={[-Math.PI/2,0,0]} fontSize={.45} color="#43634d">COURTYARD</Text>
 </group>;
 return <group>
  <RigidBody type="fixed" colliders="cuboid"><Box pos={[0,-.15,0]} size={[8,.3,8]} color="#c5b795"/><Box pos={[0,1.5,-4]} size={[8,3,.15]} color="#e9e1c9"/><Box pos={[-4,1.5,0]} size={[.15,3,8]} color="#ded5be"/><Box pos={[4,1.5,0]} size={[.15,3,8]} color="#ded5be"/><Box pos={[0,.25,4]} size={[8,.5,.15]} color="#b8ac93"/></RigidBody>
  <Box pos={[-2,1.9,-3.9]} size={[1.5,1,.1]} color="#8dbfc1"/>
  <RigidBody type="fixed" colliders="cuboid"><Box pos={[-2.6,.15,-2.8]} size={[1.25,.3,2]} color="#849789"/></RigidBody>
  <Box pos={[-3.2,.3,2]} size={[.4,.6,.4]} color="#608ca3"/><mesh position={[0,2.8,-1]}><sphereGeometry args={[.12,8,8]}/><meshBasicMaterial color="#fff4be"/></mesh>
  <Text position={[0,2.5,-3.88]} fontSize={.22} color="#476349">{snapshot?.owner_name}’s place</Text>
  <Text position={[0,.7,3.8]} rotation={[0,Math.PI,0]} fontSize={.25} color="#244732" onClick={()=>travel('hostel')}>Leave room</Text>
  {snapshot?.placements.map(p=>{const a=ROOM_ANCHORS.find(a=>a.id===p.anchor);if(!a)return null;return <group key={p.item_id} position={[...a.position]} rotation={[0,p.rotation*Math.PI/180,0]}><HostelItemModel id={p.item_id} tv={snapshot.room.tv_on}/></group>;})}
  {preview&&ROOM_ANCHORS.filter(a=>a.type===hostelItem(preview.item)?.placementType).map(a=><mesh key={a.id} position={[a.position[0],Math.max(.04,a.position[1]),a.position[2]]} rotation={[-Math.PI/2,0,0]} onClick={e=>{e.stopPropagation();useHostelStore.setState({preview:{...preview,anchor:a.id}});}}><circleGeometry args={[.5,16]}/><meshBasicMaterial color="#4add9b" transparent opacity={.4}/></mesh>)}
  {preview&&(()=>{const a=ROOM_ANCHORS.find(a=>a.id===preview.anchor)!;return <group position={[...a.position]} rotation={[0,preview.rotation*Math.PI/180,0]}><HostelItemModel id={preview.item} ghost/></group>;})()}
 </group>;
}
