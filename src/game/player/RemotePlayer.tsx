import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlayerState } from '../../types/game';
import { AvatarModel } from './AvatarModel';
import { useGameStore } from '../../stores/gameStore';

interface RemotePlayerProps {
  player: PlayerState;
}

export const RemotePlayer: React.FC<RemotePlayerProps> = ({ player }) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(...player.position));
  const currentPos = useRef(new THREE.Vector3(...player.position));
  const { setSelectedPlayer, setActiveModal } = useGameStore();

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Update target from latest network state
    targetPos.current.set(player.position[0], player.position[1], player.position[2]);

    // Smooth LERP movement to prevent jitter
    currentPos.current.lerp(targetPos.current, Math.min(1, delta * 12));
    groupRef.current.position.copy(currentPos.current);

    // Smooth rotation
    let rotDiff = player.rotation - groupRef.current.rotation.y;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    groupRef.current.rotation.y += rotDiff * Math.min(1, delta * 14);
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    setSelectedPlayer(player);
    setActiveModal('player_profile');
  };

  return (
    <group
      ref={groupRef}
      position={[player.position[0], player.position[1], player.position[2]]}
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <AvatarModel
        username={player.username}
        college={player.college}
        avatarConfig={player.avatarConfig}
        animation={player.animation || 'idle'}
      />
    </group>
  );
};
