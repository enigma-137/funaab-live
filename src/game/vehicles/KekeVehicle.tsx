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
   <Html position={[0,2.5,0]} center zIndexRange={[5,0]} style={{pointerEvents:'none'}}><div style={{whiteSpace:'nowrap',background:'#243c30',color:'#fff6d6',borderRadius:6,padding:'4px 7px',fontSize:10}}>{id==='keke-1'?'Route Keke':k.phase==='IDLE'?'Car Park Keke · Book ride':`${k.currentStopName} · ${3-k.passengers.length} seats`}</div></Html>
      {/* KEKE 3D GEOMETRY */}
      {/* Chassis Base (Yellow) */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.4, 0.4, 2.4]} />
        <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Front Nose (Narrower tapered front) */}
      <mesh position={[0, 0.5, 1.2]} castShadow>
        <boxGeometry args={[0.9, 0.5, 0.7]} />
        <meshStandardMaterial color="#ca8a04" roughness={0.3} />
      </mesh>

      {/* Front Windshield Frame & Glass */}
      <mesh position={[0, 1.2, 0.9]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[1.1, 0.7, 0.05]} />
        <meshStandardMaterial color="#38bdf8" opacity={0.65} transparent roughness={0.1} />
      </mesh>

      {/* Black Canopy Roof */}
      <mesh position={[0, 2.25, -0.1]} castShadow>
        <boxGeometry args={[1.45, 0.08, 2.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>

      {/* Roof Metal Support Pillars */}
      {[-0.65, 0.65].map((x, i) => (
        <React.Fragment key={i}>
          <mesh position={[x, 1.35, 0.8]}>
            <cylinderGeometry args={[0.025, 0.025, 1.8, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          <mesh position={[x, 1.35, -0.9]}>
            <cylinderGeometry args={[0.025, 0.025, 1.8, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Driver Seat & Handlebar */}
      <mesh position={[0, 0.75, 0.5]}>
        <boxGeometry args={[0.6, 0.25, 0.4]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.95, 1.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* Passenger Rear Bench Seat */}
      <mesh position={[0, 0.75, -0.5]}>
        <boxGeometry args={[1.2, 0.25, 0.55]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Passenger Backrest */}
      <mesh position={[0, 1.05, -0.8]}>
        <boxGeometry args={[1.2, 0.45, 0.1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Front Headlight (Emissive Yellow/White) */}
      <mesh position={[0, 0.6, 1.58]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={1.5} />
      </mesh>
      

      {/* Front Wheel */}
      <mesh ref={frontWheelRef} position={[0, 0.25, 1.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.16, 16]} />
        <meshStandardMaterial color="#020617" roughness={0.9} />
      </mesh>

      {/* Rear Left Wheel */}
      <mesh ref={rearLeftWheelRef} position={[-0.75, 0.25, -0.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.16, 16]} />
        <meshStandardMaterial color="#020617" roughness={0.9} />
      </mesh>

      {/* Rear Right Wheel */}
      <mesh ref={rearRightWheelRef} position={[0.75, 0.25, -0.6]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.16, 16]} />
        <meshStandardMaterial color="#020617" roughness={0.9} />
      </mesh>
    </group>;
}
