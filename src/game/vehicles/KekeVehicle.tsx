import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import worldData from '../../worlds/funaab/world.json';
import { useGameStore } from '../../stores/gameStore';

export const KekeVehicle: React.FC = () => {
  const kekeRef = useRef<THREE.Group>(null);
  const frontWheelRef = useRef<THREE.Mesh>(null);
  const rearLeftWheelRef = useRef<THREE.Mesh>(null);
  const rearRightWheelRef = useRef<THREE.Mesh>(null);

  const { updateKeke, isRidingKeke, currentKekeId } = useGameStore();

  // Load waypoints and stops from world data
  const route = worldData.kekeRoutes[0];
  const waypoints = useMemo(() => {
    return route.waypoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  }, [route]);

  const progressRef = useRef<{
    currentIndex: number;
    t: number;
    stopTimer: number;
    currentStopName: string;
    isStopped: boolean;
  }>({
    currentIndex: 0,
    t: 0,
    stopTimer: 0,
    currentStopName: 'Car Park Stop',
    isStopped: false,
  });

  useFrame((_, delta) => {
    if (!kekeRef.current || waypoints.length < 2) return;

    const state = progressRef.current;

    // If currently stopped at a bus stop
    if (state.isStopped) {
      state.stopTimer -= delta;
      if (state.stopTimer <= 0) {
        state.isStopped = false;
      }
      return;
    }

    const currentWP = waypoints[state.currentIndex];
    const nextIndex = (state.currentIndex + 1) % waypoints.length;
    const nextWP = waypoints[nextIndex];

    const segmentDistance = currentWP.distanceTo(nextWP);
    const speed = 4.8; // units per second
    const step = (speed * delta) / Math.max(0.1, segmentDistance);

    state.t += step;

    if (state.t >= 1) {
      state.t = 0;
      state.currentIndex = nextIndex;

      // Check if this waypoint matches a designated Stop
      const matchedStop = route.stops.find((s) => {
        const stopPos = new THREE.Vector3(...s.position);
        return stopPos.distanceTo(nextWP) < 2.0;
      });

      if (matchedStop) {
        state.isStopped = true;
        state.stopTimer = matchedStop.duration || 4.0;
        state.currentStopName = matchedStop.name;
      }
    }

    // Interpolate position
    const interpolatedPos = new THREE.Vector3().lerpVectors(
      waypoints[state.currentIndex],
      waypoints[nextIndex],
      state.t
    );

    // Compute heading rotation
    const direction = new THREE.Vector3().subVectors(nextWP, currentWP).normalize();
    const targetAngle = Math.atan2(direction.x, direction.z);

    kekeRef.current.position.copy(interpolatedPos);
    kekeRef.current.rotation.y = targetAngle;

    // Wheel rotation animation
    const wheelRot = delta * 12;
    if (frontWheelRef.current) frontWheelRef.current.rotation.x += wheelRot;
    if (rearLeftWheelRef.current) rearLeftWheelRef.current.rotation.x += wheelRot;
    if (rearRightWheelRef.current) rearRightWheelRef.current.rotation.x += wheelRot;

    // Sync to store
    updateKeke('keke-1', {
      position: [interpolatedPos.x, interpolatedPos.y, interpolatedPos.z],
      rotation: targetAngle,
      currentStopName: state.currentStopName,
      isStopped: state.isStopped,
    });
  });

  return (
    <group ref={kekeRef} position={[-18, 0, 18]}>
      {/* Floating Keke Status & Stop Banner */}
      <Html
        position={[0, 2.6, 0]}
        center
        distanceFactor={22}
        zIndexRange={[80, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex flex-col items-center gap-1 select-none">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/90 backdrop-blur-md border border-amber-500/60 shadow-xl">
            <span className="text-sm">🛺</span>
            <span className="font-bold text-xs text-amber-300 font-['Outfit'] tracking-wide">
              CAMPUS KEKE
            </span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500 text-black">
              ₦50 FARE
            </span>
          </div>
          {progressRef.current.isStopped && (
            <div className="px-2 py-0.5 rounded bg-emerald-600/90 text-white font-bold text-[10px] animate-bounce shadow-md">
              🚏 Stop: {progressRef.current.currentStopName}
            </div>
          )}
        </div>
      </Html>

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
      <mesh position={[0, 1.65, -0.1]} castShadow>
        <boxGeometry args={[1.45, 0.08, 2.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>

      {/* Roof Metal Support Pillars */}
      {[-0.65, 0.65].map((x, i) => (
        <React.Fragment key={i}>
          <mesh position={[x, 1.05, 0.8]}>
            <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          <mesh position={[x, 1.05, -0.9]}>
            <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
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
      <pointLight position={[0, 0.6, 1.8]} color="#fde047" intensity={0.8} distance={8} />

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
    </group>
  );
};
