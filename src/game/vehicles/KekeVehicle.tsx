import React,{useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {useGameStore} from '../../stores/gameStore';
import {locationById,CAR_PARK_BAY} from '../../config/campusLocations';
import {renderedKekes} from './kekePresentation';
export function KekeVehicle({id}:{id:string}){
 const initial=useRef(id==='keke-1'?locationById('sports-centre').kekeStop:CAR_PARK_BAY);
 const k=useGameStore(s=>s.kekes[id]);
 const kekeRef=useRef<THREE.Group>(null),frontWheelRef=useRef<THREE.Mesh>(null),rearLeftWheelRef=useRef<THREE.Mesh>(null),rearRightWheelRef=useRef<THREE.Mesh>(null);
 useFrame((_,dt)=>{
   const latest=useGameStore.getState().kekes[id];if(!latest||!kekeRef.current)return;
   const group=kekeRef.current,target=new THREE.Vector3(...latest.position);
   if(group.position.distanceTo(target)>8)group.position.copy(target);else group.position.lerp(target,1-Math.exp(-18*dt));
   let diff=latest.rotation-group.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));group.rotation.y+=diff*(1-Math.exp(-20*dt));
   renderedKekes[id]={...latest,position:group.position.toArray() as [number,number,number],rotation:group.rotation.y};
   if(!latest.isStopped)for(const ref of [frontWheelRef,rearLeftWheelRef,rearRightWheelRef])if(ref.current)ref.current.rotation.x+=dt*14;
 },-2);
 if(!k||k.phase==='RETURNING')return null;
 const book=()=>{const store=useGameStore.getState();if(Math.hypot(store.myPosition[0]-k.position[0],store.myPosition[2]-k.position[2])>8)return;store.setNearbyInteractable({id,type:'keke_stop',targetId:id,label:'Campus Keke',actionText:'Book Ride',position:k.position,radius:8});store.setActiveModal('keke_destination');};
 return <group ref={kekeRef} position={initial.current} onClick={e=>{e.stopPropagation();book();}}>
   <Html position={[0,2.75,0]} center zIndexRange={[5,0]} style={{pointerEvents:'none'}}><div style={{whiteSpace:'nowrap',background:'#243c30',color:'#fff6d6',borderRadius:6,padding:'4px 7px',fontSize:10}}>{id==='keke-1'?'Route Keke':k.phase==='IDLE'?'Car Park Keke · Book ride':`${k.currentStopName} · ${3-k.passengers.length} seats`}</div></Html>
      <KekeBody frontWheelRef={frontWheelRef} rearLeftWheelRef={rearLeftWheelRef} rearRightWheelRef={rearRightWheelRef}/>
    </group>;
}


// Shared across every keke so extra vehicles add no material allocations.
const M={
 body:new THREE.MeshStandardMaterial({color:'#f6dc6b',roughness:.45,metalness:.1}),
 bodyDark:new THREE.MeshStandardMaterial({color:'#e3c24f',roughness:.5}),
 black:new THREE.MeshStandardMaterial({color:'#16181d',roughness:.85}),
 canvas:new THREE.MeshStandardMaterial({color:'#1f2228',roughness:.95}),
 seat:new THREE.MeshStandardMaterial({color:'#9ca3af',roughness:.8}),
 seatDark:new THREE.MeshStandardMaterial({color:'#6b7280',roughness:.8}),
 glass:new THREE.MeshStandardMaterial({color:'#cfe8f3',opacity:.35,transparent:true,roughness:.05,depthWrite:false}),
 chrome:new THREE.MeshStandardMaterial({color:'#e5e7eb',roughness:.25,metalness:.8}),
 stripe:new THREE.MeshStandardMaterial({color:'#9aa3b2',roughness:.6}),
 lamp:new THREE.MeshStandardMaterial({color:'#fffbe8',emissive:'#fff3b0',emissiveIntensity:1.2}),
 indicator:new THREE.MeshStandardMaterial({color:'#fb923c',emissive:'#f97316',emissiveIntensity:.6}),
 tail:new THREE.MeshStandardMaterial({color:'#ef4444',emissive:'#b91c1c',emissiveIntensity:.5}),
 tyre:new THREE.MeshStandardMaterial({color:'#111214',roughness:.95}),
 hub:new THREE.MeshStandardMaterial({color:'#f3f4f6',roughness:.4,metalness:.3}),
 skin:new THREE.MeshStandardMaterial({color:'#7a4a2b',roughness:.7}),
 shirt:new THREE.MeshStandardMaterial({color:'#3fae5a',roughness:.8}),
 shorts:new THREE.MeshStandardMaterial({color:'#4b5563',roughness:.8}),
};
type V3=[number,number,number];
const Box=({p,s,m,r}:{p:V3;s:V3;m:THREE.Material;r?:V3})=><mesh position={p} rotation={r} material={m} castShadow><boxGeometry args={s}/></mesh>;
const Rod=({p,len,m,r,rad=.025}:{p:V3;len:number;m:THREE.Material;r?:V3;rad?:number})=><mesh position={p} rotation={r} material={m}><cylinderGeometry args={[rad,rad,len,8]}/></mesh>;
const Wheel=React.forwardRef<THREE.Mesh,{p:V3}>(({p},ref)=><mesh ref={ref} position={p} rotation={[0,0,Math.PI/2]} material={M.tyre} castShadow>
 <cylinderGeometry args={[.25,.25,.16,18]}/>
 <mesh material={M.hub}><cylinderGeometry args={[.13,.13,.18,12]}/></mesh>
 {/* Dark spokes make the spin readable */}
 <mesh material={M.black}><boxGeometry args={[.22,.19,.04]}/></mesh>
</mesh>);

function KekeBody({frontWheelRef,rearLeftWheelRef,rearRightWheelRef}:{frontWheelRef:React.Ref<THREE.Mesh>;rearLeftWheelRef:React.Ref<THREE.Mesh>;rearRightWheelRef:React.Ref<THREE.Mesh>}){
 return <>
  {/* Floor pan and side sills */}
  <Box p={[0,.42,.1]} s={[1.36,.1,2.4]} m={M.body}/>
  <Box p={[0,.37,.1]} s={[1.3,.04,2.3]} m={M.black}/>
  {[-1,1].map(sx=><React.Fragment key={sx}>
   <Box p={[sx*.66,.52,.5]} s={[.06,.16,1.0]} m={M.body}/>
   {/* Rear quarter panel with grey livery stripes */}
   <Box p={[sx*.68,.66,-.68]} s={[.06,.5,.85]} m={M.body}/>
   <Box p={[sx*.713,.74,-.62]} s={[.01,.035,.7]} m={M.stripe}/>
   <Box p={[sx*.713,.8,-.62]} s={[.01,.035,.7]} m={M.stripe}/>
   <Box p={[sx*.713,.47,-.68]} s={[.01,.05,.85]} m={M.black}/>
   {/* Rear wheel arch */}
   <Box p={[sx*.75,.6,-.6]} s={[.22,.06,.66]} m={M.bodyDark}/>
   {/* Black canvas rear corner */}
   <Box p={[sx*.69,1.55,-.98]} s={[.03,1.3,.32]} m={M.canvas}/>
   {/* Yellow mid pillar and roof-edge trim */}
   <Rod p={[sx*.67,1.4,.2]} len={1.75} m={M.body} rad={.03}/>
   <Box p={[sx*.725,2.12,.15]} s={[.03,.06,2.45]} m={M.body}/>
  </React.Fragment>)}

  {/* Rear body, bench and backrest (bench height matches seatPosition) */}
  <Box p={[0,.62,-.75]} s={[1.3,.38,.75]} m={M.body}/>
  <Box p={[0,.81,-.5]} s={[1.24,.14,.56]} m={M.seat}/>
  <Box p={[0,1.18,-.84]} s={[1.24,.6,.12]} m={M.seat} r={[-.1,0,0]}/>
  <Box p={[0,.85,-1.08]} s={[1.4,.6,.08]} m={M.body}/>
  <Box p={[0,1.6,-1.1]} s={[1.4,1.2,.05]} m={M.canvas}/>
  {[-.55,.55].map(x=><Box key={x} p={[x,.82,-1.13]} s={[.16,.1,.02]} m={M.tail}/>)}

  {/* Grab rail between driver and passengers */}
  <Rod p={[0,1.25,.2]} len={1.32} m={M.chrome} r={[0,0,Math.PI/2]} rad={.018}/>

  {/* Driver seat */}
  <Box p={[0,.62,.55]} s={[.36,.32,.34]} m={M.seatDark}/>
  <Box p={[0,.84,.55]} s={[.52,.12,.44]} m={M.seat}/>
  <Box p={[0,1.12,.32]} s={[.5,.45,.08]} m={M.seat} r={[-.12,0,0]}/>

  {/* Front cowl: tapered nose wrapping the front wheel */}
  <Box p={[0,.95,1.25]} s={[1.12,.62,.5]} m={M.body}/>
  <Box p={[0,1.3,1.12]} s={[1.08,.12,.42]} m={M.black}/>
  <Box p={[0,.6,1.3]} s={[.9,.36,.42]} m={M.body} r={[-.3,0,0]}/>
  <Box p={[0,1.27,1.24]} s={[1.12,.08,.5]} m={M.bodyDark}/>
  {/* Headlights, indicators and grille */}
  {[-.34,.34].map(x=><React.Fragment key={x}>
   <Box p={[x,1.04,1.505]} s={[.2,.14,.02]} m={M.lamp}/>
   <Box p={[x*1.38,1.04,1.5]} s={[.07,.08,.02]} m={M.indicator}/>
  </React.Fragment>)}
  <Box p={[0,.94,1.505]} s={[.36,.04,.02]} m={M.black}/>

  {/* Windscreen with black frame and wiper */}
  <group position={[0,1.73,1.3]} rotation={[-.14,0,0]}>
   <mesh material={M.glass}><boxGeometry args={[1.04,.72,.03]}/></mesh>
   {[-.54,.54].map(x=><Box key={x} p={[x,0,0]} s={[.06,.78,.06]} m={M.black}/>)}
   <Box p={[0,.38,0]} s={[1.14,.06,.06]} m={M.black}/>
   <Box p={[0,-.38,0]} s={[1.14,.06,.06]} m={M.black}/>
   <Box p={[.1,-.15,.03]} s={[.025,.5,.01]} m={M.black} r={[0,0,.55]}/>
  </group>
  {/* Side mirror */}
  <Rod p={[-.68,1.55,1.32]} len={.22} m={M.black} r={[0,0,.9]} rad={.015}/>
  <Box p={[-.8,1.65,1.32]} s={[.1,.16,.04]} m={M.black}/>

  {/* Handlebar */}
  <Rod p={[0,1.22,.98]} len={.3} m={M.black} r={[.5,0,0]} rad={.02}/>
  <Rod p={[0,1.36,.9]} len={.62} m={M.black} r={[0,0,Math.PI/2]} rad={.02}/>

  {/* Rounded black roof */}
  <Box p={[0,2.24,.15]} s={[1.48,.1,2.5]} m={M.black}/>
  <Rod p={[0,2.19,1.4]} len={1.48} m={M.black} r={[0,0,Math.PI/2]} rad={.1}/>
  <Rod p={[0,2.19,-1.1]} len={1.48} m={M.black} r={[0,0,Math.PI/2]} rad={.1}/>
  <Box p={[0,2.3,.15]} s={[1.3,.04,2.3]} m={M.black}/>

  {/* Driver */}
  <group position={[0,.9,.55]}>
   <Box p={[0,.32,-.04]} s={[.38,.48,.22]} m={M.shirt}/>
   <mesh position={[0,.7,-.02]} material={M.skin} castShadow><sphereGeometry args={[.14,12,10]}/></mesh>
   <mesh position={[0,.75,-.05]} material={M.black}><sphereGeometry args={[.135,10,8,0,Math.PI*2,0,1.3]}/></mesh>
   {[-.11,.11].map(x=><React.Fragment key={x}>
    <Box p={[x,.05,.16]} s={[.14,.14,.4]} m={M.shorts}/>
    <Box p={[x,-.22,.34]} s={[.1,.42,.1]} m={M.skin}/>
    <Box p={[x*2.1,.3,.2]} s={[.09,.09,.42]} m={M.skin} r={[-.35,0,0]}/>
   </React.Fragment>)}
  </group>

  {/* Wheels with mudguard */}
  <Box p={[0,.52,1.45]} s={[.24,.06,.5]} m={M.bodyDark}/>
  <Wheel ref={frontWheelRef} p={[0,.25,1.45]}/>
  <Wheel ref={rearLeftWheelRef} p={[-.75,.25,-.6]}/>
  <Wheel ref={rearRightWheelRef} p={[.75,.25,-.6]}/>
 </>;
}
