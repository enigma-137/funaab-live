import { HostelEnvironment } from './HostelEnvironment';
import { JobMarkers } from './JobMarkers';
import { useHostelStore } from '../../stores/hostelStore';
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
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
  const { players, myConnectionId, debugPhysics } = useGameStore();

  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        shadows
        dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.75)]}
        camera={{ position: [0, 5, 14], fov: 50, near: 0.1, far: 300 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      >
        <color attach="background" args={['#7dd3fc']} />
        <fog attach="fog" args={['#bae6fd', 45, 130]} />

        {/* Ambient & Warm Tropical Sunlight */}
        <ambientLight intensity={0.65} color="#fef08a" />
        <directionalLight
          position={[30, 45, 25]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={120}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
          color="#fffbeb"
        />
        <hemisphereLight groundColor="#1e3a1e" color="#60a5fa" intensity={0.4} />

        {/* Atmospheric Sky */}
        <Sky
          distance={450000}
          sunPosition={[30, 45, 25]}
          inclination={0.6}
          azimuth={0.25}
          turbidity={6}
          rayleigh={0.5}
        />

        <Suspense fallback={null}>
          <Physics key={roomId} debug={debugPhysics} gravity={[0, -9.81, 0]}>
            {/* Static Campus Geometry with Colliders */}
            {hostel ? <HostelEnvironment /> : <><CampusEnvironment /><JobMarkers /></>}

            {/* Autonomous Keke Route */}
            {!hostel && <KekeVehicle />}

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
