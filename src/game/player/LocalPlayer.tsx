import { renderedKekes } from '../vehicles/kekePresentation';
import { seatPosition } from '../../config/kekeSimulation';
import { useHostelStore } from '../../stores/hostelStore';
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
import worldData from '../../config/campusWorld';
import { InteractableZone } from '../../types/game';

import { classifyTerrain, lawnEnforcement } from '../rules/lawnSecuritySystem';
import { useShallow } from 'zustand/react/shallow';
import { CAMERA_ROTATION_RATE, damp, dampFactor, dampFollow, orbitPosition } from '../camera/cameraMath';

const MOVE_SPEED = 6.0;
const SPRINT_SPEED = 9.5;
// Avatar turn rate (1/s); equals the old 0.22-per-frame smoothing at 60fps but is frame-rate independent.
const ROTATION_RATE = 15;
const CAPSULE_HALF_HEIGHT = 0.5;
const CAPSULE_RADIUS = 0.35;
const PLAYER_CENTER_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS; // 0.85m
// Runs before @react-three/rapier's stepper (priority 0) whatever the mount order, so the
// kinematic target set this frame is what gets stepped and rendered this frame.
const PLAYER_FRAME_PRIORITY = -1;

// Per-frame scratch objects (avoid GC hitches on mobile).
const _up = new THREE.Vector3(0, 1, 0);
const _moveDir = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _feet = new THREE.Vector3();
const _zone = new THREE.Vector3();

export const LocalPlayer: React.FC<{offCampus?:boolean}> = ({offCampus=false}) => {

  const { user } = useAuthStore();
  // Subscribe only to what rendering / the key handler need. Values that change every
  // frame (position, officers, players, camera angles, tap target) are read via getState()
  // inside useFrame so this component (and the avatar) doesn't re-render at frame rate.
  const {
    isRidingKeke,
    currentKekeId,
    myAnimation,
    setMyPosition,
    setMyRotation,
    setMyAnimation,
    setNearbyInteractable,
    setSelectedPlayer,
    setSelectedHallLocationId,
    setActiveModal,
    setIsOnRestrictedLawn,
    setCurrentTerrainType,
    setLawnViolationNotice,
    toggleDebugPhysics,
    toggleDebugNet,
  } = useGameStore(
    useShallow((s) => ({
      isRidingKeke: s.isRidingKeke,
      currentKekeId: s.currentKekeId,
      myAnimation: s.myAnimation,
      setMyPosition: s.setMyPosition,
      setMyRotation: s.setMyRotation,
      setMyAnimation: s.setMyAnimation,
      setNearbyInteractable: s.setNearbyInteractable,
      setSelectedPlayer: s.setSelectedPlayer,
      setSelectedHallLocationId: s.setSelectedHallLocationId,
      setActiveModal: s.setActiveModal,
      setIsOnRestrictedLawn: s.setIsOnRestrictedLawn,
      setCurrentTerrainType: s.setCurrentTerrainType,
      setLawnViolationNotice: s.setLawnViolationNotice,
      toggleDebugPhysics: s.toggleDebugPhysics,
      toggleDebugNet: s.toggleDebugNet,
    }))
  );
  const applyLawnFine = useWalletStore((s) => s.applyLawnFine);
  const clearTargetDestination = useInputStore((s) => s.clearTargetDestination);
  // Spawn position is only for the initial RigidBody placement: a changing `position` prop makes
  // @react-three/rapier setTranslation() on every re-render, snapping the body back a frame.
  const [spawnPosition] = React.useState(() => useGameStore.getState().myPosition);

  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const avatarVisualRef = useRef<THREE.Group>(null);
  const characterControllerRef = useRef<any>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const currentRotation = useRef<number>(0);
  const currentAnimation = useRef<'idle' | 'walk' | 'run' | 'sit' | 'sleep'>('idle');
  const stuckTimerRef = useRef<number>(0);
  // Camera rig state: damped follow point + lightly smoothed orbit angles.
  const cameraFollow = useRef(new THREE.Vector3());
  const cameraFollowPrevTarget = useRef(new THREE.Vector3());
  const cameraRig = useRef({ initialized: false, yaw: 0, pitch: 0 });

  const { world, rapier } = useRapier();
  const { camera, size } = useThree();

  useEffect(() => {
    useGameStore.getState().setPlayerRef(rigidBodyRef);
    return () => {
      const store = useGameStore.getState();
      if (store.playerRef === rigidBodyRef) store.setPlayerRef(null);
    };
  }, []);

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
        if (useGameStore.getState().seatedAt) {
          useGameStore.getState().standUp();
          return;
        }
        handleInteraction();
      }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        useGameStore.getState().standUp();
      }

      // Toggle Campus Map: 'M'
      if (key === 'm') {
        const { activeModal, setActiveModal } = useGameStore.getState();
        setActiveModal(activeModal === 'campus_map' ? null : 'campus_map');
        return;
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
  }, [isRidingKeke, currentKekeId]);

  const handleInteraction = async () => {
    const { nearbyInteractable, selectedPlayer, activeModal } = useGameStore.getState();
    if (activeModal) return;

    if (isRidingKeke && currentKekeId) {
      networkManager.exitKeke(currentKekeId);

      currentAnimation.current = 'idle';
      return;
    }

    if (nearbyInteractable) {
      switch (nearbyInteractable.type) {
        case 'atm':
          setActiveModal('bank');
          break;
        case 'food':
          setActiveModal('floral_world');
          break;
        case 'restaurant_dining':
        case 'bench':
          useGameStore.getState().sitAtPosition(
            nearbyInteractable.position,
            nearbyInteractable.rotation,
          );
          useInputStore.getState().clearTargetDestination();
          break;
        case 'lecture_hall':
          setSelectedHallLocationId(nearbyInteractable.targetId || nearbyInteractable.id || 'colfhec-lecture-hall');
          setActiveModal('lecture_hall');
          break;
        case 'playstation':
          setActiveModal('ps_match');
          break;
        case 'library':
          setActiveModal('library');
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

  // Rigid third-person orbit: the follow point glides after the target (frame-rate independent),
  // while swipe rotation is applied almost immediately.
  const updateOrbitCamera = (
    target: { x: number; y: number; z: number },
    yaw: number,
    pitch: number,
    distance: number,
    height: number,
    pitchHeightScale: number,
    lookHeight: number,
    delta: number
  ) => {
    const rig = cameraRig.current;
    const follow = cameraFollow.current;
    if (!rig.initialized) {
      follow.set(target.x, target.y, target.z);
      cameraFollowPrevTarget.current.copy(follow);
      rig.yaw = yaw;
      rig.pitch = pitch;
      rig.initialized = true;
    } else {
      dampFollow(follow, cameraFollowPrevTarget.current, target, delta);
      rig.yaw = damp(rig.yaw, yaw, CAMERA_ROTATION_RATE, delta);
      rig.pitch = damp(rig.pitch, pitch, CAMERA_ROTATION_RATE, delta);
    }
    orbitPosition(follow, rig.yaw, rig.pitch, distance, height, pitchHeightScale, camera.position);
    camera.lookAt(follow.x, follow.y + lookHeight, follow.z);
  };

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || !user) return;

    const controller = characterControllerRef.current;
    const body = rigidBodyRef.current;
    const { cameraYaw, cameraPitch, targetDestination, targetInteraction } = useInputStore.getState();
    const { securityOfficers, players, kekes } = useGameStore.getState();

    // 1. IF RIDING KEKE
    if (isRidingKeke && currentKekeId) {
      const activeKeke = renderedKekes[currentKekeId] || kekes[currentKekeId];
      if (activeKeke) {
        const seat=seatPosition(activeKeke,useGameStore.getState().myConnectionId || '');
        const nextY = seat[1] + PLAYER_CENTER_OFFSET;
        body.setNextKinematicTranslation({
          x: seat[0],
          y: nextY,
          z: seat[2],
        });

        if (avatarVisualRef.current) {
          avatarVisualRef.current.rotation.y = activeKeke.rotation;
        }

        currentAnimation.current = 'sit';
        setMyAnimation('sit');
        setMyPosition(seat);
        setMyRotation(activeKeke.rotation);

        // Preserve the walking orbit on boarding and through road turns.
        _camTarget.set(activeKeke.position[0], nextY, activeKeke.position[2]);
        updateOrbitCamera(_camTarget, cameraYaw, cameraPitch, 7.5, 4.2, 0.5, 0.5, delta);
        return;
      }
    }

    const seatedAt = useGameStore.getState().seatedAt;
    if (seatedAt) {
      if (targetDestination) {
        useGameStore.getState().standUp();
      } else {
        const [x, , z] = seatedAt.position;
        body.setNextKinematicTranslation({
          x,
          y: PLAYER_CENTER_OFFSET,
          z,
        });
        currentRotation.current = seatedAt.rotation;
        currentAnimation.current = 'sit';
        if (avatarVisualRef.current) avatarVisualRef.current.rotation.y = seatedAt.rotation;
        setMyPosition(seatedAt.position);
        setMyRotation(seatedAt.rotation);
        setMyAnimation('sit');
        networkManager.sendMove(seatedAt.position, seatedAt.rotation, 'sit', false);

        const camDist =
          useHostelStore.getState().roomId === 'world:funaab:library' ? 6 : 8.2;
        const cx = x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * camDist;
        const cy = PLAYER_CENTER_OFFSET + 3.6 + Math.sin(cameraPitch) * camDist * 0.6;
        const cz = z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * camDist;
        camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.14);
        camera.lookAt(x, PLAYER_CENTER_OFFSET + 0.5, z);
        return;
      }
    }

    // 2. MOVEMENT: KEYBOARD (WASD) OR TAP-TO-MOVE
    const isModalOpen = Boolean(useGameStore.getState().activeModal);
    const forward = !isModalOpen && (keysPressed.current['w'] || keysPressed.current['arrowup']) ? 1 : 0;
    const backward = !isModalOpen && (keysPressed.current['s'] || keysPressed.current['arrowdown']) ? 1 : 0;
    const left = !isModalOpen && (keysPressed.current['a'] || keysPressed.current['arrowleft']) ? 1 : 0;
    const right = !isModalOpen && (keysPressed.current['d'] || keysPressed.current['arrowright']) ? 1 : 0;
    const isSprinting = !isModalOpen && Boolean(keysPressed.current['shift']);

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
      moveDirection = _moveDir.set(moveX, 0, moveZ).normalize().applyAxisAngle(_up, cameraYaw);
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
        moveDirection = _moveDir.set(dx, 0, dz).normalize();
        activeSpeed = MOVE_SPEED;
      }
    }

    const roomState=useHostelStore.getState();
    if(offCampus && (roomState.pose||roomState.preview)) moveDirection=null;
    if(useGameStore.getState().activeModal) moveDirection=null;
    if (moveDirection && controller) {
      const targetAngle = Math.atan2(moveDirection.x, moveDirection.z);

      // Smooth visual rotation interpolation
      let angleDiff = targetAngle - currentRotation.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      currentRotation.current += angleDiff * dampFactor(ROTATION_RATE, delta);

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

    if(offCampus) { const bound=roomState.roomId === 'world:funaab:library'?11.4:useHostelStore.getState().owner?3.5:14;nextX=Math.max(-bound,Math.min(bound,nextX));nextZ=Math.max(-bound,Math.min(bound,nextZ)); }
    if(offCampus&&roomState.pose){[nextX,nextY,nextZ]=roomState.pose.position;nextY+=PLAYER_CENTER_OFFSET;currentRotation.current=roomState.pose.rotation;}
    if(roomState.teleport){[nextX,nextY,nextZ]=roomState.teleport;nextY+=PLAYER_CENTER_OFFSET;useHostelStore.setState({teleport:null});}
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
    if(offCampus && roomState.pose) currentAnimation.current=roomState.pose.animation;
    setMyAnimation(currentAnimation.current);

    networkManager.sendMove(
      feetPosition,
      currentRotation.current,
      currentAnimation.current,
      isRidingKeke
    );

    // Third-person Orbit Camera Rig (supports drag-to-look around player)
    const camDist = roomState.roomId === 'world:funaab:library' ? 6 : 8.2;
    const camHeight = 3.6;
    const roomCamK = dampFactor(10.5, delta); // ≈ old 0.16-per-frame lerp at 60fps

    const hostelState=useHostelStore.getState();
    const decorating=offCampus && hostelState.owner && !!hostelState.preview;
    const lens=camera as THREE.PerspectiveCamera;
    if(lens.view?.enabled)lens.clearViewOffset();
    const fov=hostelState.owner?(size.width<650&&!decorating?65:55):50;if(lens.fov!==fov){lens.fov=fov;lens.updateProjectionMatrix();}
    if(decorating){
      const height=size.width<650?12:9;
      camera.position.lerp(_camTarget.set(0,height,7),roomCamK);camera.lookAt(0,0,-.3);
    }else if(offCampus&&hostelState.owner){
      // Clamp the orbit eye inside the room walls; no camera can pass through masonry.
      const clamp=(n:number)=>Math.max(-3.65,Math.min(3.65,n));
      camera.position.lerp(_camTarget.set(clamp(nextX*.25+Math.sin(cameraYaw)*3.2),(size.width<650?8:5.2)+cameraPitch,clamp(nextZ*.25+Math.cos(cameraYaw)*3.2)),roomCamK);
      camera.lookAt(nextX*.25,.65,nextZ*.25-.8);
    }else{
      updateOrbitCamera(_camTarget.set(nextX,nextY,nextZ),cameraYaw,cameraPitch,camDist,camHeight,0.6,0.8,delta);
    }

    if(offCampus) { setIsOnRestrictedLawn(false); setNearbyInteractable(null); return; }
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
    const feetVec = _feet.set(feetPosition[0], feetPosition[1], feetPosition[2]);
    let closestInteractable: InteractableZone | null = null;
    let minDistance = 999;
    const interactionPriority: Record<InteractableZone['type'], number> = {
      library: 1,
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
      const zonePos = _zone.set(zone.position[0], zone.position[1], zone.position[2]);
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
    for(const k of Object.values(kekes)){
      const dist=Math.hypot(feetPosition[0]-k.position[0],feetPosition[2]-k.position[2]);
      if(k.isStopped&&dist<8&&dist<minDistance){minDistance=dist;closestInteractable={id:k.id,type:'keke_stop',targetId:k.id,label:k.id==='keke-1'?'Route Keke':'Car Park Keke',actionText:k.phase==='BOARDING'?'Join Ride':'Book Ride',position:k.position,radius:8};}
    }
    if(useGameStore.getState().activeModal!=='keke_destination')setNearbyInteractable(closestInteractable);

    // Auto-close proximity modals when walking outside interaction radius + hysteresis buffer
    const activeModal = useGameStore.getState().activeModal;
    if (activeModal) {
      const PROXIMITY_MODAL_ZONES: Record<string, string[]> = {
        bank: ['atm'],
        food: ['food', 'restaurant_dining'],
        floral_world: ['food', 'restaurant_dining'],
        lecture_hall: ['lecture_hall'],

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

              const zonePos = _zone.set(zone.position[0], zone.position[1], zone.position[2]);
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
          const pPos = _zone.set(selPlayer.position[0], selPlayer.position[1], selPlayer.position[2]);
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
      const pPos = _zone.set(player.position[0], player.position[1], player.position[2]);
      const dist = feetVec.distanceTo(pPos);
      if (dist <= minPlayerDist) {
        minPlayerDist = dist;
        closestPlayer = player;
      }
    }
    setSelectedPlayer(closestPlayer);
  }, PLAYER_FRAME_PRIORITY);

  if (!user) return null;

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[spawnPosition[0], spawnPosition[1] + PLAYER_CENTER_OFFSET, spawnPosition[2]]}
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
          animation={myAnimation}
          isLocal
        />
      </group>
    </RigidBody>
  );
};
