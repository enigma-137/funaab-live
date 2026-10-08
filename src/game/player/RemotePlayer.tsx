import React, { useRef, useEffect } from 'react';
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

  const safePos = (pos?: [number, number, number]): [number, number, number] => {
    if (!pos || !Array.isArray(pos) || pos.length < 3 || isNaN(pos[0]) || isNaN(pos[1]) || isNaN(pos[2])) {
      return [0, 0, 8];
    }
    return [pos[0], pos[1], pos[2]];
  };

  const initial = safePos(player.position);
  const targetPos = useRef(new THREE.Vector3(...initial));
  const currentPos = useRef(new THREE.Vector3(...initial));
  const { setSelectedPlayer, setActiveModal } = useGameStore();

  useEffect(() => {
    const p = safePos(player.position);
    targetPos.current.set(p[0], p[1], p[2]);
  }, [player.position]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const p = safePos(player.position);
    targetPos.current.set(p[0], p[1], p[2]);

    // Smooth LERP movement to prevent jitter
    currentPos.current.lerp(targetPos.current, Math.min(1, delta * 12));
    groupRef.current.position.copy(currentPos.current);

    // Smooth rotation
    const safeRot = isNaN(player.rotation) ? 0 : player.rotation;
    let rotDiff = safeRot - groupRef.current.rotation.y;
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
      position={[initial[0], initial[1], initial[2]]}
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <AvatarModel
        username={player.username || 'Student'}
        college={player.college || 'COLENG'}
        avatarConfig={player.avatarConfig}
        animation={player.animation || 'idle'}
      />
    </group>
  );
};
