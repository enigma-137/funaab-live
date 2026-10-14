import { LibraryEnvironment } from './LibraryEnvironment';
import { LIBRARY_ROOM } from '../../config/library';
import { HostelEnvironment } from './HostelEnvironment';
import { JobMarkers } from './JobMarkers';
import { NavigationMarker } from './NavigationMarker';
import { useHostelStore } from '../../stores/hostelStore';
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useDayNight } from './dayNight';
import { NightLights } from './NightLights';
import { Physics } from '@react-three/rapier';
import { CampusEnvironment } from './CampusEnvironment';
import { LocalPlayer } from '../player/LocalPlayer';
import { RemotePlayer } from '../player/RemotePlayer';
import { KekeVehicle } from '../vehicles/KekeVehicle';
import { SecurityOfficers } from '../npc/SecurityOfficers';
import { TouchInputController } from '../controls/TouchInputController';
import { TapRippleEffect } from '../controls/TapRippleEffect';
import { useGameStore } from '../../stores/gameStore';

export const WorldScene: React.FC = () => {
  const roomId=useHostelStore(s=>s.roomId);
  const hostel=roomId!=='world:funaab:main';
  // Selectors: subscribing to the whole store re-rendered the entire Canvas tree on every per-frame player update.
  const players = useGameStore((s) => s.players);
  const myConnectionId = useGameStore((s) => s.myConnectionId);
  const debugPhysics = useGameStore((s) => s.debugPhysics);
  const night = useDayNight((s) => s.night);

  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        shadows
        dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.75)]}
        camera={{ position: [0, 5, 14], fov: 50, near: 0.1, far: 300 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      >
        {/* Hostel courtyard and rooms share campus day/night; the library interior stays lit. */}
        <SkyAndLight night={roomId === LIBRARY_ROOM ? 0 : night} indoor={roomId.startsWith('world:funaab:hostel-room:')} />

        <Suspense fallback={null}>
          {/* timeStep="vary": one physics step per rendered frame, so the kinematic player, its mesh and
              the follow camera stay in lock-step on 60/90/120Hz and variable-rate mobile displays. */}
          <Physics key={roomId} debug={debugPhysics} gravity={[0, -9.81, 0]} timeStep="vary">
            {/* Static Campus Geometry with Colliders & Navigation Waypoint */}
            {roomId === LIBRARY_ROOM ? <LibraryEnvironment /> : hostel ? <HostelEnvironment /> : <><CampusEnvironment /><NightLights /><JobMarkers /><NavigationMarker /></>}

            {/* Autonomous Keke Route */}
            {!hostel && <><KekeVehicle id="keke-1"/><KekeVehicle id="keke-carpark"/></>}

            {/* Campus Security Officers (Patrol & Lawn Rule Enforcement) */}
            {!hostel && <SecurityOfficers />}

            {/* Local Controlled Player (with Kinematic RigidBody) */}
            <LocalPlayer offCampus={hostel} />

            {/* Remote Multiplayer Players */}
            {Object.entries(players).map(([key, playerState]) => {
              const playerKey = playerState.connectionId || key;
              if (playerKey === myConnectionId) return null;
              return <RemotePlayer key={playerKey} player={playerState} />;
            })}

            {/* Visual Tap-to-move Ripple Indicator */}
            <TapRippleEffect />

            {/* Mobile Touch & Drag Gesture Controller */}
            <TouchInputController />
          </Physics>
        </Suspense>
      </Canvas>
    </div>
  );
};

const mix = (a: string, b: string, t: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sky, fog and the sun/moon, blended from bright tropical day (0) to campus night (1). */
/** `indoor` (your room): little moonlight gets in after dark, so the ceiling bulb and lamps light it. */
function SkyAndLight({ night: n, indoor = false }: { night: number; indoor?: boolean }) {
  // Moonlight comes from the opposite side so shadows swing round after dark.
  const sun: [number, number, number] = n < 0.5 ? [30, 45, 25] : [-30, 50, -20];
  return (
    <>
      <color attach="background" args={[mix('#7dd3fc', '#0b1430', n)]} />
      <fog attach="fog" args={[mix('#bae6fd', '#101a33', n), lerp(45, 32, n), lerp(130, 115, n)]} />

      {/* Ambient & Warm Tropical Sunlight, cooling to moonlight at night */}
      <ambientLight intensity={lerp(0.65, indoor ? 0.16 : 0.5, n)} color={mix('#fef08a', '#8d9fd6', n)} />
      <directionalLight
        position={sun}
        intensity={lerp(1.2, indoor ? 0.08 : 0.38, n)}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        color={mix('#fffbeb', '#a9bbff', n)}
      />
      <hemisphereLight groundColor={mix('#1e3a1e', '#0a1410', n)} color={mix('#60a5fa', '#29407a', n)} intensity={lerp(0.4, indoor ? 0.1 : 0.32, n)} />

      {/* Atmospheric Sky by day, stars by night */}
      {n < 0.7 && (
        <Sky
          distance={450000}
          sunPosition={n < 0.4 ? [30, 45, 25] : [30, lerp(45, -4, Math.min(1, n * 1.4)), 25]}
          inclination={0.6}
          azimuth={0.25}
          turbidity={6}
          rayleigh={lerp(0.5, 2.5, n)}
        />
      )}
      {n >= 0.45 && <Stars radius={160} depth={40} count={1400} factor={4} saturation={0} fade speed={0.4} />}
    </>
  );
}
