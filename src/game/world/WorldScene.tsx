import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { CampusEnvironment } from './CampusEnvironment';
import { LocalPlayer } from '../player/LocalPlayer';
import { RemotePlayer } from '../player/RemotePlayer';
import { KekeVehicle } from '../vehicles/KekeVehicle';
import { useGameStore } from '../../stores/gameStore';

export const WorldScene: React.FC = () => {
  const { players } = useGameStore();

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [0, 5, 14], fov: 50, near: 0.1, far: 300 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
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
          {/* Static Campus Geometry */}
          <CampusEnvironment />

          {/* Autonomous Keke Route */}
          <KekeVehicle />

          {/* Local Controlled Player */}
          <LocalPlayer />

          {/* Remote Multiplayer Players */}
          {Object.entries(players).map(([id, playerState]) => (
            <RemotePlayer key={id} player={playerState} />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
};
