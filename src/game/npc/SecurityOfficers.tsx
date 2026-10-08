import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import worldData from '../../worlds/funaab/world.json';
import { useGameStore } from '../../stores/gameStore';
import { SecurityRoute } from '../../types/game';

interface OfficerRuntime {
  id: string;
  name: string;
  title: string;
  speed: number;
  detectionRadius: number;
  waypoints: THREE.Vector3[];
  currentIndex: number;
  t: number;
  position: THREE.Vector3;
  rotation: number;
  alertTimer: number;
  alertText: string;
}

export const SecurityOfficers: React.FC = () => {
  const routes = (worldData.securityRoutes || []) as SecurityRoute[];
  const { updateSecurityOfficer, isOnRestrictedLawn, myPosition } = useGameStore();

  const officersRef = useRef<Record<string, THREE.Group | null>>({});

  // Initialize runtime state for each officer
  const runtimes = useMemo(() => {
    return routes.map((r) => {
      const wps = r.points.map((p) => new THREE.Vector3(p[0], 0, p[2]));
      return {
        id: r.id,
        name: r.name,
        title: r.title,
        speed: r.speed || 2.2,
        detectionRadius: r.detectionRadius || 13.0,
        waypoints: wps,
        currentIndex: 0,
        t: 0,
        position: wps[0].clone(),
        rotation: 0,
        alertTimer: 0,
        alertText: '',
      } as OfficerRuntime;
    });
  }, [routes]);

  useFrame((_, delta) => {
    const playerVec = new THREE.Vector3(myPosition[0], 0, myPosition[2]);

    runtimes.forEach((officer) => {
      if (officer.waypoints.length < 2) return;

      const group = officersRef.current[officer.id];
      if (!group) return;

      // Check distance to player
      const distToPlayer = officer.position.distanceTo(playerVec);
      const isPlayerCaught = isOnRestrictedLawn && distToPlayer <= officer.detectionRadius;

      if (isPlayerCaught) {
        // Alert mode: Face player and raise alert
        officer.alertTimer = Math.max(officer.alertTimer, 3.5);
        officer.alertText = '🚨 HEY! GET OFF THE LAWN!';

        const lookDir = new THREE.Vector3().subVectors(playerVec, officer.position).normalize();
        const targetRot = Math.atan2(lookDir.x, lookDir.z);
        officer.rotation = THREE.MathUtils.lerp(officer.rotation, targetRot, delta * 8);
      } else {
        if (officer.alertTimer > 0) {
          officer.alertTimer -= delta;
        }

        // Standard waypoint patrol
        const currentWP = officer.waypoints[officer.currentIndex];
        const nextIndex = (officer.currentIndex + 1) % officer.waypoints.length;
        const nextWP = officer.waypoints[nextIndex];

        const segDist = currentWP.distanceTo(nextWP);
        const step = (officer.speed * delta) / Math.max(0.1, segDist);
        officer.t += step;

        if (officer.t >= 1) {
          officer.t = 0;
          officer.currentIndex = nextIndex;
        }

        officer.position.lerpVectors(
          officer.waypoints[officer.currentIndex],
          officer.waypoints[nextIndex],
          officer.t
        );

        const moveDir = new THREE.Vector3().subVectors(nextWP, currentWP).normalize();
        const targetAngle = Math.atan2(moveDir.x, moveDir.z);
        officer.rotation = THREE.MathUtils.lerp(officer.rotation, targetAngle, delta * 6);
      }

      // Apply to ThreeJS Group
      group.position.copy(officer.position);
      group.rotation.y = officer.rotation;

      // Animate walking limbs
      const limbAngle = isPlayerCaught ? 0 : Math.sin(Date.now() * 0.008 * officer.speed) * 0.45;
      const leftLeg = group.getObjectByName('leftLeg');
      const rightLeg = group.getObjectByName('rightLeg');
      const leftArm = group.getObjectByName('leftArm');
      const rightArm = group.getObjectByName('rightArm');

      if (leftLeg) leftLeg.rotation.x = limbAngle;
      if (rightLeg) rightLeg.rotation.x = -limbAngle;
      if (leftArm) leftArm.rotation.x = -limbAngle;
      if (rightArm) rightArm.rotation.x = limbAngle;

      // Sync state to game store
      updateSecurityOfficer(officer.id, {
        id: officer.id,
        name: officer.name,
        title: officer.title,
        position: [officer.position.x, 0, officer.position.z],
        rotation: officer.rotation,
        state: isPlayerCaught ? 'alert' : 'patrol',
        alertMessage: officer.alertTimer > 0 ? officer.alertText : undefined,
      });
    });
  });

  return (
    <group>
      {runtimes.map((officer) => (
        <group
          key={officer.id}
          ref={(el) => {
            officersRef.current[officer.id] = el;
          }}
          position={officer.position}
        >
          {/* Floating Security Badge & Overhead Title */}
          <Html
            position={[0, 2.3, 0]}
            center
            distanceFactor={20}
            zIndexRange={[5, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div className="flex flex-col items-center gap-1 select-none pointer-events-none">
              {officer.alertTimer > 0 ? (
                <div className="px-3 py-1 rounded-xl bg-red-600 text-white font-black text-xs shadow-2xl border-2 border-yellow-300 animate-bounce whitespace-nowrap">
                  {officer.alertText}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/90 backdrop-blur-md border border-lime-400/60 shadow-lg text-[10px] whitespace-nowrap">
                  <span className="text-xs">👮</span>
                  <span className="font-extrabold text-lime-300 font-['Outfit']">
                    {officer.name}
                  </span>
                  <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-lime-500 text-black uppercase">
                    Security
                  </span>
                </div>
              )}
            </div>
          </Html>

          {/* ─── 3D LOW-POLY SECURITY OFFICER MODEL ─── */}
          {/* Head & Security Beret */}
          <group position={[0, 1.45, 0]}>
            {/* Face / Head */}
            <mesh castShadow position={[0, 0, 0]}>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshStandardMaterial color="#8d5524" roughness={0.7} />
            </mesh>
            {/* Dark Green Security Beret */}
            <mesh position={[0, 0.16, 0]} rotation={[0.1, 0, -0.15]} castShadow>
              <cylinderGeometry args={[0.18, 0.16, 0.12, 12]} />
              <meshStandardMaterial color="#064e3b" />
            </mesh>
            {/* Gold Beret Badge */}
            <mesh position={[0.08, 0.16, 0.14]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#facc15" metalness={0.8} />
            </mesh>
          </group>

          {/* Torso with High-Vis Lime/Yellow Security Vest */}
          <mesh position={[0, 0.95, 0]} castShadow>
            <boxGeometry args={[0.54, 0.65, 0.28]} />
            <meshStandardMaterial color="#84cc16" roughness={0.5} />
          </mesh>
          {/* Yellow Reflective Crossed Straps */}
          <mesh position={[0, 0.95, 0.145]}>
            <boxGeometry args={[0.48, 0.12, 0.01]} />
            <meshStandardMaterial color="#facc15" />
          </mesh>
          <mesh position={[0, 0.95, -0.145]}>
            <boxGeometry args={[0.48, 0.12, 0.01]} />
            <meshStandardMaterial color="#facc15" />
          </mesh>
          {/* Chest Security Shield / Badge */}
          <mesh position={[-0.14, 1.05, 0.15]}>
            <boxGeometry args={[0.08, 0.1, 0.02]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>

          {/* Dark Green Security Trousers (Pelvis) */}
          <mesh position={[0, 0.58, 0]} castShadow>
            <boxGeometry args={[0.48, 0.16, 0.26]} />
            <meshStandardMaterial color="#14532d" />
          </mesh>

          {/* Left Leg */}
          <group name="leftLeg" position={[-0.14, 0.5, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <boxGeometry args={[0.18, 0.44, 0.2]} />
              <meshStandardMaterial color="#14532d" />
            </mesh>
            {/* Black Boot */}
            <mesh position={[0, -0.44, 0.04]} castShadow>
              <boxGeometry args={[0.2, 0.12, 0.28]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} />
            </mesh>
          </group>

          {/* Right Leg */}
          <group name="rightLeg" position={[0.14, 0.5, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <boxGeometry args={[0.18, 0.44, 0.2]} />
              <meshStandardMaterial color="#14532d" />
            </mesh>
            {/* Black Boot */}
            <mesh position={[0, -0.44, 0.04]} castShadow>
              <boxGeometry args={[0.2, 0.12, 0.28]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} />
            </mesh>
          </group>

          {/* Left Arm */}
          <group name="leftArm" position={[-0.34, 1.15, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <boxGeometry args={[0.14, 0.44, 0.18]} />
              <meshStandardMaterial color="#84cc16" />
            </mesh>
            {/* Hand */}
            <mesh position={[0, -0.44, 0]}>
              <boxGeometry args={[0.12, 0.1, 0.14]} />
              <meshStandardMaterial color="#8d5524" />
            </mesh>
          </group>

          {/* Right Arm with Walkie-Talkie */}
          <group name="rightArm" position={[0.34, 1.15, 0]}>
            <mesh position={[0, -0.2, 0]} castShadow>
              <boxGeometry args={[0.14, 0.44, 0.18]} />
              <meshStandardMaterial color="#84cc16" />
            </mesh>
            {/* Hand & Radio */}
            <mesh position={[0, -0.44, 0]}>
              <boxGeometry args={[0.12, 0.1, 0.14]} />
              <meshStandardMaterial color="#8d5524" />
            </mesh>
            {/* Walkie-Talkie in Hand */}
            <mesh position={[0, -0.44, 0.1]}>
              <boxGeometry args={[0.06, 0.14, 0.06]} />
              <meshStandardMaterial color="#020617" />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};
