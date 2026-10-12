import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import worldData from '../../config/campusWorld';
import { useGameStore } from '../../stores/gameStore';
import { AvatarBody } from '../player/AvatarBody';
import { npcAppearance } from '../../config/npcAppearance';
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

const _playerVec = new THREE.Vector3();

export const SecurityOfficers: React.FC = () => {
  const routes = (worldData.securityRoutes || []) as SecurityRoute[];
  const updateSecurityOfficer = useGameStore((s) => s.updateSecurityOfficer);

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
    // Read per-frame player state directly; subscribing re-rendered this component every frame.
    const { myPosition, isOnRestrictedLawn } = useGameStore.getState();
    const playerVec = _playerVec.set(myPosition[0], 0, myPosition[2]);

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
        officer.rotation += Math.atan2(Math.sin(targetRot-officer.rotation), Math.cos(targetRot-officer.rotation)) * (1-Math.exp(-8*delta));
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
        officer.rotation += Math.atan2(Math.sin(targetAngle-officer.rotation), Math.cos(targetAngle-officer.rotation)) * (1-Math.exp(-6*delta));
      }

      // Apply to ThreeJS Group
      group.position.copy(officer.position);
      group.rotation.y = officer.rotation;

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

          <AvatarBody identity={officer.id} trackMovement accessory="security"
            config={npcAppearance(officer.id, {topStyle:'shirt',topColor:'#84cc16',bottomStyle:'trousers',bottomColor:'#14532d',shoeColor:'#17211d',hairstyle:'low-cut'})} />
        </group>
      ))}
    </group>
  );
};
