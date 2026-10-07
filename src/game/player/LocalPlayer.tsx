import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { useWalletStore } from '../../stores/walletStore';
import { networkManager } from '../multiplayer/networkManager';
import { AvatarModel } from './AvatarModel';
import worldData from '../../worlds/funaab/world.json';
import { InteractableZone } from '../../types/game';

const MOVE_SPEED = 6.0;
const SPRINT_SPEED = 9.5;
const ROTATION_SMOOTHING = 0.18;

export const LocalPlayer: React.FC = () => {
  const { user } = useAuthStore();
  const {
    myPosition,
    isRidingKeke,
    currentKekeId,
    kekes,
    setMyPosition,
    setMyRotation,
    setMyAnimation,
    setNearbyInteractable,
    setSelectedPlayer,
    setActiveModal,
    setRidingKeke,
    players,
  } = useGameStore();
  const { deductFare } = useWalletStore();

  const playerRef = useRef<THREE.Group>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const currentRotation = useRef<number>(0);
  const currentAnimation = useRef<'idle' | 'walk' | 'run' | 'sit'>('idle');
  const positionVec = useRef(new THREE.Vector3(myPosition[0], myPosition[1], myPosition[2]));

  const { camera } = useThree();

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if typing inside input / textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      keysPressed.current[e.key.toLowerCase()] = true;

      // Handle 'E' or 'Enter' for Context Interaction
      if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
        handleInteraction();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRidingKeke, currentKekeId, kekes]);

  const handleInteraction = async () => {
    const { nearbyInteractable, selectedPlayer, activeModal } = useGameStore.getState();

    // If modal is already open, do not re-trigger
    if (activeModal) return;

    if (isRidingKeke && currentKekeId) {
      // Exit Keke
      networkManager.exitKeke(currentKekeId);
      setRidingKeke(false, null);
      currentAnimation.current = 'idle';
      return;
    }

    if (nearbyInteractable) {
      switch (nearbyInteractable.type) {
        case 'atm':
          setActiveModal('bank');
          break;
        case 'food':
          setActiveModal('food');
          break;
        case 'playstation':
          setActiveModal('ps_match');
          break;
        case 'keke_stop': {
          // Check if keke is nearby to board
          const activeKeke = Object.values(kekes)[0];
          if (activeKeke) {
            const hasFare = await deductFare(user?.id || 'guest', 50, activeKeke.currentStopName || 'Next Stop');
            if (hasFare) {
              networkManager.enterKeke(activeKeke.id);
              setRidingKeke(true, activeKeke.id);
              currentAnimation.current = 'sit';
            }
          }
          break;
        }
      }
    } else if (selectedPlayer) {
      setActiveModal('player_profile');
    }
  };

  useFrame((_, delta) => {
    if (!playerRef.current || !user) return;

    // IF RIDING KEKE
    if (isRidingKeke && currentKekeId) {
      const activeKeke = kekes[currentKekeId];
      if (activeKeke) {
        // Position attached to keke passenger bay
        positionVec.current.set(
          activeKeke.position[0],
          activeKeke.position[1] + 0.1,
          activeKeke.position[2]
        );
        playerRef.current.position.copy(positionVec.current);
        playerRef.current.rotation.y = activeKeke.rotation;

        currentAnimation.current = 'sit';
        setMyAnimation('sit');
        setMyPosition([positionVec.current.x, positionVec.current.y, positionVec.current.z]);

        // Camera smoothly follows keke
        const camOffset = new THREE.Vector3(0, 4.5, 7.5);
        camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), activeKeke.rotation);
        camera.position.lerp(
          new THREE.Vector3().copy(positionVec.current).add(camOffset),
          0.1
        );
        camera.lookAt(positionVec.current.x, positionVec.current.y + 1.2, positionVec.current.z);
        return;
      }
    }

    // FREE MOVEMENT CONTROLS (WASD / Arrows)
    const forward = keysPressed.current['w'] || keysPressed.current['arrowup'] ? 1 : 0;
    const backward = keysPressed.current['s'] || keysPressed.current['arrowdown'] ? 1 : 0;
    const left = keysPressed.current['a'] || keysPressed.current['arrowleft'] ? 1 : 0;
    const right = keysPressed.current['d'] || keysPressed.current['arrowright'] ? 1 : 0;
    const isSprinting = keysPressed.current['shift'];

    const moveZ = backward - forward;
    const moveX = right - left;

    const isMoving = moveX !== 0 || moveZ !== 0;
    const speed = isSprinting ? SPRINT_SPEED : MOVE_SPEED;

    if (isMoving) {
      const moveDirection = new THREE.Vector3(moveX, 0, moveZ).normalize();
      const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);

      // Smooth rotation interpolation
      let angleDiff = targetAngle - currentRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      currentRotation.current += angleDiff * ROTATION_SMOOTHING;

      // Apply displacement
      positionVec.current.x += moveDirection.x * speed * delta;
      positionVec.current.z += moveDirection.z * speed * delta;

      // World Boundary Clamping
      positionVec.current.x = Math.max(worldData.bounds.minX, Math.min(worldData.bounds.maxX, positionVec.current.x));
      positionVec.current.z = Math.max(worldData.bounds.minZ, Math.min(worldData.bounds.maxZ, positionVec.current.z));

      currentAnimation.current = isSprinting ? 'run' : 'walk';
    } else {
      currentAnimation.current = 'idle';
    }

    // Apply transforms to local mesh
    playerRef.current.position.copy(positionVec.current);
    playerRef.current.rotation.y = currentRotation.current;

    // Update Zustand & sync to network
    setMyPosition([positionVec.current.x, positionVec.current.y, positionVec.current.z]);
    setMyRotation(currentRotation.current);
    setMyAnimation(currentAnimation.current);

    networkManager.sendMove(
      [positionVec.current.x, positionVec.current.y, positionVec.current.z],
      currentRotation.current,
      currentAnimation.current,
      isRidingKeke
    );

    // Third-person Camera Follow Rig
    const targetCameraPos = new THREE.Vector3(
      positionVec.current.x,
      positionVec.current.y + 4.2,
      positionVec.current.z + 7.5
    );
    camera.position.lerp(targetCameraPos, 0.12);
    camera.lookAt(
      positionVec.current.x,
      positionVec.current.y + 1.3,
      positionVec.current.z
    );

    // Check Proximity to Interactables & Nearby Players
    let closestInteractable: InteractableZone | null = null;
    let minDistance = 999;

    for (const zone of worldData.interactables as InteractableZone[]) {
      const zonePos = new THREE.Vector3(...zone.position);
      const dist = positionVec.current.distanceTo(zonePos);
      if (dist <= zone.radius && dist < minDistance) {
        minDistance = dist;
        closestInteractable = zone;
      }
    }
    setNearbyInteractable(closestInteractable);

    // Check Proximity to Other Real Players
    let closestPlayer: any = null;
    let minPlayerDist = 3.5;
    for (const player of Object.values(players)) {
      const pPos = new THREE.Vector3(...player.position);
      const dist = positionVec.current.distanceTo(pPos);
      if (dist <= minPlayerDist) {
        minPlayerDist = dist;
        closestPlayer = player;
      }
    }
    setSelectedPlayer(closestPlayer);
  });

  if (!user) return null;

  return (
    <group ref={playerRef} position={[myPosition[0], myPosition[1], myPosition[2]]}>
      <AvatarModel
        username={user.username}
        college={user.college}
        avatarConfig={user.avatarConfig}
        animation={currentAnimation.current}
        isLocal
      />
    </group>
  );
};
