import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody } from '@react-three/rapier';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { useWalletStore } from '../../stores/walletStore';
import { useInputStore } from '../../stores/inputStore';
import { networkManager } from '../multiplayer/networkManager';
import { useLectureStore } from '../../stores/lectureStore';
import { AvatarModel } from './AvatarModel';
import worldData from '../../worlds/funaab/world.json';
import { InteractableZone } from '../../types/game';

import { classifyTerrain, lawnEnforcement } from '../rules/lawnSecuritySystem';

const MOVE_SPEED = 6.0;
const SPRINT_SPEED = 9.5;
const ROTATION_SMOOTHING = 0.22;
const CAPSULE_HALF_HEIGHT = 0.5;
const CAPSULE_RADIUS = 0.35;
const PLAYER_CENTER_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS; // 0.85m

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
    setSelectedHallLocationId,
    setActiveModal,
    setRidingKeke,
    setIsOnRestrictedLawn,
    setCurrentTerrainType,
    setLawnViolationNotice,
    securityOfficers,
    players,
    toggleDebugPhysics,
    toggleDebugNet,
  } = useGameStore();
  const { deductFare, applyLawnFine } = useWalletStore();
  const {
    targetDestination,
    targetInteraction,
    clearTargetDestination,
    cameraYaw,
    cameraPitch,
  } = useInputStore();

  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const avatarVisualRef = useRef<THREE.Group>(null);
  const characterControllerRef = useRef<any>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const currentRotation = useRef<number>(0);
  const currentAnimation = useRef<'idle' | 'walk' | 'run' | 'sit'>('idle');
  const stuckTimerRef = useRef<number>(0);

  const { world, rapier } = useRapier();
  const { camera } = useThree();

  // Initialize Kinematic Character Controller in Rapier world
  useEffect(() => {
    if (!characterControllerRef.current && world && rapier) {
      const offset = 0.04;
      const controller = world.createCharacterController(offset);
      controller.enableAutostep(0.3, 0.2, true);
      controller.enableSnapToGround(0.5);
      controller.setSlideEnabled(true);
      controller.setMaxSlopeClimbAngle((45 * Math.PI) / 180);
      controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);
      characterControllerRef.current = controller;
    }

    return () => {
      if (characterControllerRef.current && world) {
        try {
          world.removeCharacterController(characterControllerRef.current);
        } catch (e) {}
        characterControllerRef.current = null;
      }
    };
  }, [world, rapier]);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const key = e.key.toLowerCase();
      keysPressed.current[key] = true;

      // Handle 'E' or 'Enter' for Context Interaction
      if (key === 'e' || e.key === 'Enter') {
        handleInteraction();
      }

      // Physics debug shortcut: 'P' or 'F3'
      if (key === 'p' || e.key === 'F3') {
        toggleDebugPhysics();
      }

      // Network debug shortcut: 'F2'
      if (e.key === 'F2') {
        toggleDebugNet();
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
    if (activeModal) return;

    if (isRidingKeke && currentKekeId) {
      networkManager.exitKeke(currentKekeId);
      setRidingKeke(false, null, null);
      currentAnimation.current = 'idle';
      return;
    }

    if (nearbyInteractable) {
      switch (nearbyInteractable.type) {
        case 'atm':
          setActiveModal('bank');
          break;
        case 'food':
        case 'restaurant_dining':
          setActiveModal('floral_world');
          break;
        case 'lecture_hall':
          setSelectedHallLocationId(nearbyInteractable.targetId || nearbyInteractable.id || 'colfhec-lecture-hall');
          setActiveModal('lecture_hall');
          break;
        case 'playstation':
          setActiveModal('ps_match');
          break;
        case 'keke_stop':
          setActiveModal('keke_destination');
          break;
        case 'job_board':
          setActiveModal('campus_jobs');
          break;
      }
    } else if (selectedPlayer) {
      setActiveModal('player_profile');
    }
  };

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || !user) return;

    const controller = characterControllerRef.current;
    const body = rigidBodyRef.current;

    // 1. IF RIDING KEKE
    if (isRidingKeke && currentKekeId) {
      const activeKeke = kekes[currentKekeId];
      if (activeKeke) {
        const nextY = activeKeke.position[1] + PLAYER_CENTER_OFFSET;
        body.setNextKinematicTranslation({
          x: activeKeke.position[0],
          y: nextY,
          z: activeKeke.position[2],
        });

        if (avatarVisualRef.current) {
          avatarVisualRef.current.rotation.y = activeKeke.rotation;
        }

        currentAnimation.current = 'sit';
        setMyAnimation('sit');
        setMyPosition([activeKeke.position[0], activeKeke.position[1], activeKeke.position[2]]);
        setMyRotation(activeKeke.rotation);

        const totalYaw = activeKeke.rotation + cameraYaw;
        const camDist = 7.5;
        const camHeight = 4.2;
        const cx = activeKeke.position[0] + Math.sin(totalYaw) * Math.cos(cameraPitch) * camDist;
        const cy = nextY + camHeight + Math.sin(cameraPitch) * camDist * 0.5;
        const cz = activeKeke.position[2] + Math.cos(totalYaw) * Math.cos(cameraPitch) * camDist;

        camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.14);
        camera.lookAt(activeKeke.position[0], nextY + 0.5, activeKeke.position[2]);
        return;
      }
    }

    // 2. MOVEMENT: KEYBOARD (WASD) OR TAP-TO-MOVE
    const forward = keysPressed.current['w'] || keysPressed.current['arrowup'] ? 1 : 0;
    const backward = keysPressed.current['s'] || keysPressed.current['arrowdown'] ? 1 : 0;
    const left = keysPressed.current['a'] || keysPressed.current['arrowleft'] ? 1 : 0;
    const right = keysPressed.current['d'] || keysPressed.current['arrowright'] ? 1 : 0;
    const isSprinting = keysPressed.current['shift'];

    const moveZ = backward - forward;
    const moveX = right - left;
    const isKeyboardMoving = moveX !== 0 || moveZ !== 0;

    // If keyboard is touched, clear any tap destination immediately
    if (isKeyboardMoving && targetDestination) {
      clearTargetDestination();
    }

    const currentTranslation = body.translation();
    let nextX = currentTranslation.x;
    let nextY = currentTranslation.y;
    let nextZ = currentTranslation.z;

    let moveDirection: THREE.Vector3 | null = null;
    let activeSpeed = isSprinting ? SPRINT_SPEED : MOVE_SPEED;

    if (isKeyboardMoving) {
      // Rotate movement vector according to camera yaw orientation
      const rawDir = new THREE.Vector3(moveX, 0, moveZ).normalize();
      rawDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
      moveDirection = rawDir;
    } else if (targetDestination) {
      const dx = targetDestination[0] - currentTranslation.x;
      const dz = targetDestination[2] - currentTranslation.z;
      const distToTarget = Math.hypot(dx, dz);

      const arrivalRadius = targetInteraction ? Math.min(targetInteraction.radius * 0.85, 2.2) : 0.45;

      if (distToTarget <= arrivalRadius) {
        // Reached destination cleanly - do not auto-force open modals
        clearTargetDestination();
        moveDirection = null;
      } else {
        moveDirection = new THREE.Vector3(dx, 0, dz).normalize();
        activeSpeed = MOVE_SPEED;
      }
    }

    if (moveDirection && controller) {
      const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);

      // Smooth visual rotation interpolation
      let angleDiff = targetAngle - currentRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      currentRotation.current += angleDiff * ROTATION_SMOOTHING;

      // Calculate desired displacement vector
      const desiredDisplacement = {
        x: moveDirection.x * activeSpeed * delta,
        y: -9.81 * delta * 0.5, // gentle ground snapping gravity
        z: moveDirection.z * activeSpeed * delta,
      };

      // Query Rapier kinematic character controller to resolve static obstacle collisions & slide
      const playerCollider = body.collider(0);
      if (playerCollider) {
        controller.computeColliderMovement(playerCollider, desiredDisplacement);
        const computedMovement = controller.computedMovement();

        nextX = currentTranslation.x + computedMovement.x;
        nextY = Math.max(PLAYER_CENTER_OFFSET, currentTranslation.y + computedMovement.y);
        nextZ = currentTranslation.z + computedMovement.z;

        // Stuck detection against solid walls for tap-to-move
        if (targetDestination) {
          const actualProgress = Math.hypot(computedMovement.x, computedMovement.z);
          if (actualProgress < 0.005) {
            stuckTimerRef.current += delta;
            if (stuckTimerRef.current > 0.45) {
              clearTargetDestination();
              stuckTimerRef.current = 0;
            }
          } else {
            stuckTimerRef.current = 0;
          }
        }
      }

      currentAnimation.current = isSprinting ? 'run' : 'walk';
    } else if (controller) {
      // Stationary grounding
      stuckTimerRef.current = 0;
      const playerCollider = body.collider(0);
      if (playerCollider) {
        controller.computeColliderMovement(playerCollider, { x: 0, y: -9.81 * delta * 0.2, z: 0 });
        const computedMovement = controller.computedMovement();
        nextY = Math.max(PLAYER_CENTER_OFFSET, currentTranslation.y + computedMovement.y);
      }
      currentAnimation.current = 'idle';
    }

    // World Boundary Clamping
    nextX = Math.max(worldData.bounds.minX + 0.5, Math.min(worldData.bounds.maxX - 0.5, nextX));
    nextZ = Math.max(worldData.bounds.minZ + 0.5, Math.min(worldData.bounds.maxZ - 0.5, nextZ));

    // Update Rapier Kinematic Position
    body.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });

    // Rotate visual avatar
    if (avatarVisualRef.current) {
      avatarVisualRef.current.rotation.y = currentRotation.current;
    }

    // Read authoritative ground position (feet)
    const feetPosition: [number, number, number] = [nextX, Math.max(0, nextY - PLAYER_CENTER_OFFSET), nextZ];

    setMyPosition(feetPosition);
    setMyRotation(currentRotation.current);
    setMyAnimation(currentAnimation.current);

    networkManager.sendMove(
      feetPosition,
      currentRotation.current,
      currentAnimation.current,
      isRidingKeke
    );

    // Third-person Orbit Camera Rig (supports drag-to-look around player)
    const camDist = 8.2;
    const camHeight = 3.6;
    const cx = nextX + Math.sin(cameraYaw) * Math.cos(cameraPitch) * camDist;
    const cy = nextY + camHeight + Math.sin(cameraPitch) * camDist * 0.6;
    const cz = nextZ + Math.cos(cameraYaw) * Math.cos(cameraPitch) * camDist;

    camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.14);
    camera.lookAt(nextX, nextY + 0.8, nextZ);

    // Terrain Classification & FUNAAB Lawn Rule Enforcement
    const terrain = classifyTerrain(feetPosition[0], feetPosition[2]);
    setIsOnRestrictedLawn(terrain.restricted);
    setCurrentTerrainType(terrain.type);

    if (!isRidingKeke) {
      const officersList = Object.values(securityOfficers).map((o) => ({
        id: o.id,
        name: o.name,
        position: o.position,
        detectionRadius: 13.0,
      }));

      const enforcement = lawnEnforcement.checkEnforcement(feetPosition, officersList);
      if (enforcement.caught && enforcement.officerName) {
        // Player caught on restricted lawn!
        const fineAmount = enforcement.fineAmount || 500;
        applyLawnFine(user.id, fineAmount);
        networkManager.reportLawnFine(enforcement.officerName, fineAmount);
        setLawnViolationNotice({
          visible: true,
          officerName: enforcement.officerName,
          fineAmount,
          timestamp: Date.now(),
        });
      }
    }

    // Check Proximity to Interactables
    const feetVec = new THREE.Vector3(...feetPosition);
    let closestInteractable: InteractableZone | null = null;
    let minDistance = 999;
    const interactionPriority: Record<InteractableZone['type'], number> = {
      keke_stop: 0,
      food: 1,
      restaurant_dining: 1,
      lecture_hall: 2,
      playstation: 3,
      atm: 4,
      job_board: 5,
      player: 6,
      bench: 7,
    };

    for (const zone of worldData.interactables as InteractableZone[]) {
      const zonePos = new THREE.Vector3(...zone.position);
      const dist = feetVec.distanceTo(zonePos);
      const isCloser = dist < minDistance - 0.01;
      const isPriorityTie =
        Math.abs(dist - minDistance) <= 0.01 &&
        closestInteractable !== null &&
        interactionPriority[zone.type] < interactionPriority[closestInteractable.type];
      if (dist <= zone.radius && (isCloser || isPriorityTie)) {
        minDistance = dist;
        closestInteractable = zone;
      }
    }
    setNearbyInteractable(closestInteractable);

    // Auto-close proximity modals when walking outside interaction radius + hysteresis buffer
    const activeModal = useGameStore.getState().activeModal;
    if (activeModal) {
      const PROXIMITY_MODAL_ZONES: Record<string, string[]> = {
        bank: ['atm'],
        food: ['food', 'restaurant_dining'],
        floral_world: ['food', 'restaurant_dining'],
        lecture_hall: ['lecture_hall'],
        keke_destination: ['keke_stop'],
        campus_jobs: ['job_board'],
        jobs: ['job_board'],
        ps_match: ['playstation'],
      };

      const targetZoneTypes = PROXIMITY_MODAL_ZONES[activeModal];
      if (targetZoneTypes) {
        const isInClassroom = useLectureStore.getState().isInClassroom;
        const isRiding = isRidingKeke || useGameStore.getState().isRidingKeke;
        const currentMatch = useGameStore.getState().currentMatch;
        const isPlayingMatch = currentMatch && currentMatch.status === 'in_progress';

        if (!isInClassroom && !isRiding && !isPlayingMatch) {
          const HYSTERESIS_BUFFER = 2.0; // 2.0m tolerance buffer outside base radius to prevent boundary jitter
          let isWithinRadius = false;

          for (const zone of worldData.interactables as InteractableZone[]) {
            if (targetZoneTypes.includes(zone.type)) {
              if (activeModal === 'lecture_hall') {
                const selectedHallId = useGameStore.getState().selectedHallLocationId;
                if (selectedHallId && zone.targetId !== selectedHallId && zone.id !== selectedHallId) {
                  continue;
                }
              }

              const zonePos = new THREE.Vector3(...zone.position);
              const dist = feetVec.distanceTo(zonePos);
              if (dist <= zone.radius + HYSTERESIS_BUFFER) {
                isWithinRadius = true;
                break;
              }
            }
          }

          if (!isWithinRadius) {
            setActiveModal(null);
          }
        }
      } else if (activeModal === 'player_profile') {
        const selPlayer = useGameStore.getState().selectedPlayer;
        if (selPlayer) {
          const pPos = new THREE.Vector3(...selPlayer.position);
          const dist = feetVec.distanceTo(pPos);
          if (dist > 5.5) {
            setActiveModal(null);
          }
        } else {
          setActiveModal(null);
        }
      }
    }

    // Check Proximity to Other Real Players
    let closestPlayer: any = null;
    let minPlayerDist = 3.5;
    for (const player of Object.values(players)) {
      const pPos = new THREE.Vector3(...player.position);
      const dist = feetVec.distanceTo(pPos);
      if (dist <= minPlayerDist) {
        minPlayerDist = dist;
        closestPlayer = player;
      }
    }
    setSelectedPlayer(closestPlayer);
  });

  if (!user) return null;

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[myPosition[0], myPosition[1] + PLAYER_CENTER_OFFSET, myPosition[2]]}
      lockRotations
    >
      {/* Exact Capsule Collider: halfHeight 0.5, radius 0.35 => height 1.7m */}
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} position={[0, 0, 0]} />

      {/* Visual Avatar Mesh attached to physics body with offset to match feet level */}
      <group ref={avatarVisualRef} position={[0, -PLAYER_CENTER_OFFSET, 0]}>
        <AvatarModel
          username={user.username}
          college={user.college}
          avatarConfig={user.avatarConfig}
          animation={currentAnimation.current}
          isLocal
        />
      </group>
    </RigidBody>
  );
};
