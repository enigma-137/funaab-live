import { renderedKekes } from '../vehicles/kekePresentation';
import { useCarStore } from '../../stores/carStore';
import { useRaceStore } from '../../stores/raceStore';
import { RACE, gridSpot } from '../../config/carRace';
import { toast } from '../../stores/toastStore';
import { CAR_MODELS, DRIVE, DRIVER_SEAT, FUEL_STATION, PASSENGER_SEATS, SEAT_EYE } from '../../config/cars';
import { CarBody, Cockpit } from '../vehicles/CarBody';
import { ECONOMY_CONFIG } from '../../config/economy';
import { onDanceFloor, partyOpen } from '../../config/partyHall';
import { diningSpotAt } from '../../config/campusWorld';
import { seatPosition } from '../../config/kekeSimulation';
import { roomSizeNow, useHostelStore } from '../../stores/hostelStore';
import { ROOM_SIZES } from '../../config/roomMakeover';
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
import { openFoodVendor } from '../../stores/foodVendorStore';
import { openFootball, useFootballStore, amParticipant } from '../../stores/footballStore';
import { openCourtGame, courtStores, onCourt } from '../../stores/courtGameStore';
import { HOSTEL_COURTYARD_BOUND, HOSTEL_SPAWN } from '../../config/hostelCompound';
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
    myHeldItem,
    seatedAt,
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
      myHeldItem: s.myHeldItem,
      seatedAt: s.seatedAt,
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
  const currentAnimation = useRef<'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'pray' | 'dance'>('idle');
  const stuckTimerRef = useRef<number>(0);
  const lastSeatExit = useRef<[number, number, number] | null>(null);
  // Camera rig state: damped follow point + lightly smoothed orbit angles.
  const cameraFollow = useRef(new THREE.Vector3());
  const cameraFollowPrevTarget = useRef(new THREE.Vector3());
  const cameraRig = useRef({ initialized: false, yaw: 0, pitch: 0 });
  // Driving: the car's own kinematic collider and controller (so the whole car body hits walls),
  // its ground position, heading and speed.
  const carPhys = useRef<{ body: any; collider: any; controller: any; car: string } | null>(null);
  const drive = useRef({ x: 0, z: 0, heading: 0, speed: 0, active: false });
  const drivingCar = useCarStore((s) => s.driving);
  const ride = useCarStore((s) => s.ride);
  const carView = useCarStore((s) => s.view);
  const rideCar = useGameStore((s) => (ride ? s.players[ride.driver]?.car ?? null : null));
  const ridePaint = useGameStore((s) => (ride ? s.players[ride.driver]?.carPaint ?? null : null));
  const myPaint = useCarStore((s) => (s.driving ? s.paint[s.driving] ?? null : null));
  // Getting a lift: smoothed copy of the driver's car position and heading.
  const rideSmooth = useRef({ x: 0, z: 0, heading: 0, init: false });
  const onCampusNow = useHostelStore((s) => s.roomId === 'world:funaab:main');

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

  const removeCarPhys = () => {
    const cp = carPhys.current;
    if (!cp) return;
    try { world.removeCharacterController(cp.controller); world.removeRigidBody(cp.body); } catch { /* world already gone */ }
    carPhys.current = null;
  };
  useEffect(() => () => removeCarPhys(), []);
  useEffect(() => { const h = () => parkCar(); window.addEventListener('car-park', h); return () => window.removeEventListener('car-park', h); }, []);
  // Out of a lift: step out on the passenger side.
  useEffect(() => {
    const h = () => {
      const r = rideSmooth.current;
      if (!r.init) return;
      r.init = false;
      useHostelStore.setState({ teleport: [r.x - Math.cos(r.heading) * 2.1, 0, r.z + Math.sin(r.heading) * 2.1] });
    };
    window.addEventListener('car-ride-exit', h);
    return () => window.removeEventListener('car-ride-exit', h);
  }, []);
  /** Park where you are and step out on the driver's side. */
  const parkCar = () => {
    const d = drive.current, car = useCarStore.getState().driving;
    if (!car) return;
    if (Math.abs(d.speed) > 1) { toast({ icon: '🚗', text: 'Slow down to a stop before you park.', tone: 'info' }); return; }
    useCarStore.getState().park([d.x, 0, d.z], d.heading);
    d.active = false; d.speed = 0;
    removeCarPhys();
    const out = DRIVE.half[0] * (CAR_MODELS[car]?.scale ?? 1) + 0.8;
    useHostelStore.setState({ teleport: [d.x + Math.cos(d.heading) * out, 0, d.z - Math.sin(d.heading) * out] });
    setNearbyInteractable(null);
  };

  const handleInteraction = async () => {
    const { nearbyInteractable, selectedPlayer, activeModal } = useGameStore.getState();
    if (activeModal) return;

    if (isRidingKeke && currentKekeId) {
      networkManager.exitKeke(currentKekeId);

      currentAnimation.current = 'idle';
      return;
    }

    if (nearbyInteractable?.type === 'car') {
      const t = nearbyInteractable.targetId || '';
      if (t === 'drive') useCarStore.getState().enter();
      else if (t === 'race') useRaceStore.getState().start();
      else if (t === 'park') parkCar();
      else if (t === 'unride') useCarStore.getState().leaveRide();
      else if (t.startsWith('ride:')) useCarStore.getState().askRide(t.slice(5));
      else useGameStore.getState().setActiveModal('fuel');
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
            nearbyInteractable.seat ?? nearbyInteractable.position,
            nearbyInteractable.rotation,
            { animation: nearbyInteractable.pose, exit: nearbyInteractable.exit },
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
        case 'campus_bet':
          setActiveModal('campus_bet');
          break;
        case 'food_vendor':
          openFoodVendor(nearbyInteractable.targetId);
          break;
        case 'football':
          openFootball();
          break;
        case 'basketball':
        case 'volleyball':
          openCourtGame(nearbyInteractable.type);
          break;
        case 'hustle':
          setActiveModal('hustles');
          break;
        case 'lodge':
          setActiveModal('estate');
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

    const setLensFov = (fov: number) => { const lens = camera as THREE.PerspectiveCamera; if (lens.fov !== fov) { lens.fov = fov; lens.updateProjectionMatrix(); } };
    /** Inside view: from a seat (car-local) looking ahead along the heading, with a little drag-to-look. */
    const insideCamera = (cx: number, cz: number, heading: number, seat: readonly number[]) => {
      const c = Math.cos(heading), sn = Math.sin(heading);
      const ex = cx + seat[0] * c + (seat[2] + 0.05) * sn, ez = cz - seat[0] * sn + (seat[2] + 0.05) * c;
      const look = heading + Math.atan2(Math.sin(cameraYaw - heading - Math.PI), Math.cos(cameraYaw - heading - Math.PI)) * 0.6;
      // A phone held upright has a narrow view; widen it so the dashboard and road both fit.
      setLensFov(size.width < size.height ? 78 : 62);
      camera.position.set(ex, SEAT_EYE + (seat[1] ?? 0) + 0.15, ez);
      camera.lookAt(ex + Math.sin(look) * 10, SEAT_EYE - 0.05 - cameraPitch * 2, ez + Math.cos(look) * 10);
    };

    // 1a. GETTING A LIFT in someone else's car (campus only)
    const liftState = useCarStore.getState();
    if (liftState.ride && useHostelStore.getState().roomId === 'world:funaab:main') {
      const drv = players[liftState.ride.driver];
      if (!drv || !drv.car) { liftState.rideEnded('driver_left'); }
      else {
        const r = rideSmooth.current, k = 1 - Math.exp(-delta * 10);
        if (!r.init) { r.x = drv.position[0]; r.z = drv.position[2]; r.heading = drv.rotation; r.init = true; }
        r.x += (drv.position[0] - r.x) * k; r.z += (drv.position[2] - r.z) * k;
        r.heading += Math.atan2(Math.sin(drv.rotation - r.heading), Math.cos(drv.rotation - r.heading)) * k;
        const seat = PASSENGER_SEATS[liftState.ride.seat] ?? PASSENGER_SEATS[0], c = Math.cos(r.heading), sn = Math.sin(r.heading);
        const px = r.x + seat[0] * c + seat[2] * sn, pz = r.z - seat[0] * sn + seat[2] * c;
        body.setNextKinematicTranslation({ x: px, y: PLAYER_CENTER_OFFSET, z: pz });
        currentRotation.current = r.heading;
        if (avatarVisualRef.current) avatarVisualRef.current.rotation.y = r.heading;
        currentAnimation.current = 'sit';
        const feet: [number, number, number] = [px, 0, pz];
        setMyPosition(feet); setMyRotation(r.heading); setMyAnimation('sit');
        networkManager.sendMove(feet, r.heading, 'sit', false, null);
        if (liftState.view === 'inside') insideCamera(r.x, r.z, r.heading, seat);
        else { setLensFov(50); updateOrbitCamera(_camTarget.set(r.x, PLAYER_CENTER_OFFSET, r.z), cameraYaw, cameraPitch, 13.5, 5.4, 0.6, 0.9, delta); }
        const near: InteractableZone = { id: 'lift', type: 'car', targetId: 'unride', label: CAR_MODELS[drv.car]?.name ?? 'Car', actionText: 'Get out', position: feet, radius: 3 };
        if (useGameStore.getState().nearbyInteractable?.targetId !== 'unride') setNearbyInteractable(near);
        setIsOnRestrictedLawn(false);
        return;
      }
    }

    // 1b. DRIVING YOUR CAR (campus only)
    const carState = useCarStore.getState();
    if (carState.driving && controller && useHostelStore.getState().roomId === 'world:funaab:main') {
      const model = CAR_MODELS[carState.driving], k = model.scale, d = drive.current;
      if (!d.active) {
        const p = carState.parked;
        d.x = p?.position[0] ?? body.translation().x; d.z = p?.position[2] ?? body.translation().z;
        d.heading = p?.rotation ?? currentRotation.current; d.speed = 0; d.active = true;
      }
      if (!carPhys.current || carPhys.current.car !== carState.driving) {
        removeCarPhys();
        const cb = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(d.x, 0, d.z));
        const cc = world.createCollider(rapier.ColliderDesc.cuboid(DRIVE.half[0] * k, DRIVE.half[1], DRIVE.half[2] * k).setTranslation(0, DRIVE.half[1] + 0.12, 0), cb);
        const ctl = world.createCharacterController(0.05);
        ctl.setSlideEnabled(true);
        carPhys.current = { body: cb, collider: cc, controller: ctl, car: carState.driving };
      }
      // Race: the car is put on the grid and held there until the lights go green.
      const race = useRaceStore.getState();
      if (race.gridPending) {
        const spot = gridSpot(0);
        d.x = spot.x; d.z = spot.z; d.heading = spot.heading; d.speed = 0;
        useRaceStore.setState({ gridPending: false });
        useInputStore.getState().setCameraYaw(spot.heading + Math.PI);
      }
      const held = race.status === 'countdown';
      if (held) d.speed = 0;
      const modal = Boolean(useGameStore.getState().activeModal);
      const kp = keysPressed.current;
      const [jx, jy] = modal ? [0, 0] : useInputStore.getState().joystick;
      const throttle = modal || held ? 0 : Math.max(-1, Math.min(1, -jy + ((kp['w'] || kp['arrowup']) ? 1 : 0) - ((kp['s'] || kp['arrowdown']) ? 1 : 0)));
      const steer = modal ? 0 : Math.max(-1, Math.min(1, jx + ((kp['d'] || kp['arrowright']) ? 1 : 0) - ((kp['a'] || kp['arrowleft']) ? 1 : 0)));
      const fuel = carState.fuel[carState.driving] ?? 0;
      const top = model.topSpeed;
      if (fuel > 0 && Math.abs(throttle) > 0.08) {
        // Throttle against the motion brakes first, then reverses.
        const braking = Math.sign(throttle) !== Math.sign(d.speed) && Math.abs(d.speed) > 0.3;
        d.speed += throttle * (braking ? DRIVE.brake : DRIVE.accel) * delta;
      } else {
        d.speed -= Math.sign(d.speed) * Math.min(Math.abs(d.speed), (DRIVE.drag + Math.abs(d.speed) * 0.12) * delta);
      }
      d.speed = Math.max(-DRIVE.reverseMax, Math.min(top, d.speed));
      // Steering bites with speed; reversing turns the other way.
      const grip = Math.min(1, Math.abs(d.speed) / 4) * Math.sign(d.speed);
      d.heading -= steer * DRIVE.turnRate * grip * delta;
      const want = { x: Math.sin(d.heading) * d.speed * delta, y: 0, z: Math.cos(d.heading) * d.speed * delta };
      const cp = carPhys.current;
      cp.body.setTranslation({ x: d.x, y: 0, z: d.z }, true);
      cp.body.setRotation({ x: 0, y: Math.sin(d.heading / 2), z: 0, w: Math.cos(d.heading / 2) }, true);
      const capsule = body.collider(0);
      cp.controller.computeColliderMovement(cp.collider, want, undefined, undefined, (c: any) => c.handle !== cp.collider.handle && c.handle !== capsule?.handle && !c.isSensor());
      const moved = cp.controller.computedMovement();
      const wanted = Math.hypot(want.x, want.z), got = Math.hypot(moved.x, moved.z);
      if (wanted > 0.001 && got < wanted * 0.35) d.speed *= 0.25; // bumped into something
      d.x = Math.max(worldData.bounds.minX + 2, Math.min(worldData.bounds.maxX - 2, d.x + moved.x));
      d.z = Math.max(worldData.bounds.minZ + 2, Math.min(worldData.bounds.maxZ - 2, d.z + moved.z));
      if (got > 0) carState.drove(got);
      body.setNextKinematicTranslation({ x: d.x, y: PLAYER_CENTER_OFFSET, z: d.z });
      currentRotation.current = d.heading;
      if (avatarVisualRef.current) avatarVisualRef.current.rotation.y = d.heading;
      currentAnimation.current = 'sit';
      const feet: [number, number, number] = [d.x, 0, d.z];
      setMyPosition(feet); setMyRotation(d.heading); setMyAnimation('sit');
      networkManager.sendMove(feet, d.heading, 'sit', false, carState.driving, carState.paint[carState.driving] ?? null);
      // The camera settles in behind the car as you drive.
      if (Math.abs(d.speed) > 2) {
        const behind = d.heading + Math.PI, diff = Math.atan2(Math.sin(behind - cameraYaw), Math.cos(behind - cameraYaw));
        useInputStore.getState().setCameraYaw(cameraYaw + diff * Math.min(1, delta * 1.6));
      }
      if (carState.view === 'inside') insideCamera(d.x, d.z, d.heading, DRIVER_SEAT);
      else { setLensFov(50); updateOrbitCamera(_camTarget.set(d.x, PLAYER_CENTER_OFFSET, d.z), cameraYaw, cameraPitch, 13.5, 5.4, 0.6, 0.9, delta); }
      // At a pump you can fill up; anywhere else the button parks the car.
      const pump = FUEL_STATION.pumps.find((q) => Math.hypot(q[0] - d.x, q[2] - d.z) < FUEL_STATION.pumpRadius);
      const start = RACE.track[0];
      const atStart = race.status === 'idle' && Math.abs(d.speed) < 1 && Math.hypot(start[0] - d.x, start[2] - d.z) < RACE.startRadius;
      const near: InteractableZone = pump
        ? { id: 'fuel-pump', type: 'car', targetId: 'fuel', label: FUEL_STATION.name, actionText: 'Buy fuel', position: pump, radius: FUEL_STATION.pumpRadius }
        : atStart ? { id: 'race-start', type: 'car', targetId: 'race', label: RACE.name, actionText: 'Race to COLFHEC', position: start, radius: RACE.startRadius }
        : { id: 'my-car', type: 'car', targetId: 'park', label: model.name, actionText: Math.abs(d.speed) > 1 ? 'Stop to park' : 'Park & get out', position: feet, radius: 3 };
      if (useGameStore.getState().nearbyInteractable?.actionText !== near.actionText) setNearbyInteractable(near);
      setIsOnRestrictedLawn(false);
      return;
    }
    // Left campus while driving (hostel, library): the car stays parked where you were.
    if (carState.driving && drive.current.active) carState.park([drive.current.x, 0, drive.current.z], drive.current.heading);
    if (drive.current.active) { drive.current.active = false; removeCarPhys(); }

    const seatedAt = useGameStore.getState().seatedAt;
    // Getting up from a bed: step beside it rather than inside its collider.
    if (!seatedAt && lastSeatExit.current) {
      useHostelStore.setState({ teleport: lastSeatExit.current });
      lastSeatExit.current = null;
    }
    if (seatedAt) {
      if (targetDestination) {
        useGameStore.getState().standUp();
      } else {
        const [x, seatY, z] = seatedAt.position;
        const pose = seatedAt.animation ?? 'sit';
        lastSeatExit.current = seatedAt.exit ?? null;
        body.setNextKinematicTranslation({
          x,
          y: PLAYER_CENTER_OFFSET + seatY,
          z,
        });
        currentRotation.current = seatedAt.rotation;
        currentAnimation.current = pose;
        if (avatarVisualRef.current) avatarVisualRef.current.rotation.y = seatedAt.rotation;
        setMyPosition(seatedAt.position);
        setMyRotation(seatedAt.rotation);
        setMyAnimation(pose);
        networkManager.sendMove(seatedAt.position, seatedAt.rotation, pose, false);

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
    const isSprinting = !isModalOpen && (Boolean(keysPressed.current['shift']) || Math.hypot(...useInputStore.getState().joystick) > 0.92);

    // On-screen joystick (touch): a dead zone, then walk; pushed all the way, jog.
    const [jx, jy] = isModalOpen ? [0, 0] : useInputStore.getState().joystick;
    const stick = Math.hypot(jx, jy);
    const stickOn = stick > 0.18;
    const moveZ = stickOn ? jy / stick : backward - forward;
    const moveX = stickOn ? jx / stick : right - left;
    const isKeyboardMoving = stickOn || moveX !== 0 || moveZ !== 0;

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
      // Standing on The Arena's dance floor while the party is on: dance.
      currentAnimation.current = onDanceFloor([currentTranslation.x, 0, currentTranslation.z]) && partyOpen(Date.now()) ? 'dance' : 'idle';
    }

    // World Boundary Clamping
    nextX = Math.max(worldData.bounds.minX + 0.5, Math.min(worldData.bounds.maxX - 0.5, nextX));
    nextZ = Math.max(worldData.bounds.minZ + 0.5, Math.min(worldData.bounds.maxZ - 0.5, nextZ));

    if(offCampus) { const inRoom=!!useHostelStore.getState().owner, bound=roomState.roomId === 'world:funaab:library'?11.4:inRoom?3.5:HOSTEL_COURTYARD_BOUND;
      // An expanded room (migration 024) is wider along X.
      const boundX=inRoom?ROOM_SIZES[roomSizeNow()].halfX-0.5:bound;nextX=Math.max(-boundX,Math.min(boundX,nextX));nextZ=Math.max(-bound,Math.min(bound,nextZ)); }
    if(offCampus&&roomState.pose){[nextX,nextY,nextZ]=roomState.pose.position;nextY+=PLAYER_CENTER_OFFSET;currentRotation.current=roomState.pose.rotation;}
    if(roomState.teleport){[nextX,nextY,nextZ]=roomState.teleport;nextY+=PLAYER_CENTER_OFFSET;useHostelStore.setState({teleport:null});}
    const faceRotation=useGameStore.getState().faceRotation;
    if(faceRotation!==null){currentRotation.current=faceRotation;useGameStore.getState().setFaceRotation(null);}
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
      const big=roomSizeNow()==='large', height=(size.width<650?12:9)*(big?1.45:1);
      camera.position.lerp(_camTarget.set(0,height,big?9.5:7),roomCamK);camera.lookAt(0,0,-.3);
    }else if(offCampus&&hostelState.owner){
      // Clamp the orbit eye inside the room walls; no camera can pass through masonry.
      const clamp=(n:number,r=3.65)=>Math.max(-r,Math.min(r,n)), wide=ROOM_SIZES[roomSizeNow()].halfX-0.35;
      camera.position.lerp(_camTarget.set(clamp(nextX*.25+Math.sin(cameraYaw)*3.2,wide),(size.width<650?8:5.2)+cameraPitch,clamp(nextZ*.25+Math.cos(cameraYaw)*3.2)),roomCamK);
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
        const fineAmount = enforcement.fineAmount || ECONOMY_CONFIG.LAWN_FINE;
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
      campus_bet: 1,
      food_vendor: 1,
      football: 1,
      basketball: 1,
      volleyball: 1,
      hustle: 1,
      lodge: 1,
      party: 1,
      arcade: 1,
      car: 0,
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
        // A seat someone is already sitting on is not offered.
        if ((zone.type === 'bench' || zone.type === 'restaurant_dining') && Object.values(players).some((p) =>
          p.animation === 'sit' && !p.kekeRiding && Math.hypot(p.position[0] - zone.position[0], p.position[2] - zone.position[2]) < 0.3)) continue;
        minDistance = dist;
        closestInteractable = zone;
      }
    }
    for(const k of Object.values(kekes)){
      const dist=Math.hypot(feetPosition[0]-k.position[0],feetPosition[2]-k.position[2]);
      if(k.isStopped&&dist<8&&dist<minDistance){minDistance=dist;closestInteractable={id:k.id,type:'keke_stop',targetId:k.id,label:k.id==='korope-1'?'Korope Bus':k.id==='keke-1'?'Route Keke':'Car Park Keke',actionText:k.id==='korope-1'?(k.phase==='WAITING'?'Join Korope':'Hop On'):k.phase==='BOARDING'?'Join Ride':'Book Ride',position:k.position,radius:8};}
    }
    // Your parked car and the fuel pumps (on foot you can fill a car you own too).
    const myCar = useCarStore.getState().parked;
    if (myCar) {
      const dist = Math.hypot(feetPosition[0] - myCar.position[0], feetPosition[2] - myCar.position[2]);
      if (dist < 3.6 && dist < minDistance + 1) { minDistance = dist; closestInteractable = { id: 'my-car', type: 'car', targetId: 'drive', label: CAR_MODELS[myCar.car]?.name ?? 'Your car', actionText: 'Drive', position: myCar.position, radius: 3.6 }; }
    }
    // Someone driving and stopped nearby: hop in for a lift.
    for (const p of Object.values(players)) {
      if (!p.car || !p.connectionId) continue;
      const dist = Math.hypot(feetPosition[0] - p.position[0], feetPosition[2] - p.position[2]);
      if (dist < 4.5 && dist < minDistance + 1) { minDistance = dist; closestInteractable = { id: `ride-${p.connectionId}`, type: 'car', targetId: `ride:${p.connectionId}`, label: `${p.username}'s ${CAR_MODELS[p.car]?.name ?? 'car'}`, actionText: `Ride with ${p.username}`, position: p.position, radius: 4.5 }; }
    }
    for (const q of FUEL_STATION.pumps) {
      const dist = Math.hypot(feetPosition[0] - q[0], feetPosition[2] - q[2]);
      if (dist < 2.2 && dist < minDistance) { minDistance = dist; closestInteractable = { id: 'fuel-pump', type: 'car', targetId: 'fuel', label: FUEL_STATION.name, actionText: 'Buy fuel', position: q, radius: 2.2 }; }
    }
    if(useGameStore.getState().activeModal!=='keke_destination')setNearbyInteractable(closestInteractable);

    // Auto-close proximity modals when walking outside interaction radius + hysteresis buffer
    const activeModal = useGameStore.getState().activeModal;
    if (activeModal) {
      // Only counter-style dialogs close when you walk away. Wallet (bank) and Jobs are phone
      // apps opened from anywhere, so they must not snap shut when you're away from an ATM/board.
      const PROXIMITY_MODAL_ZONES: Record<string, string[]> = {
        food: ['food', 'restaurant_dining'],
        floral_world: ['food', 'restaurant_dining'],
        lecture_hall: ['lecture_hall'],
        ps_match: ['playstation'],
        campus_bet: ['campus_bet'],
        food_vendor: ['food_vendor'],
        football: ['football'],
        basketball: ['basketball'],
        volleyball: ['volleyball'],
      };

      const targetZoneTypes = PROXIMITY_MODAL_ZONES[activeModal];
      if (targetZoneTypes) {
        const isInClassroom = useLectureStore.getState().isInClassroom;
        const isRiding = isRidingKeke || useGameStore.getState().isRidingKeke;
        const currentMatch = useGameStore.getState().currentMatch;
        const pitch = useFootballStore.getState().state;
        const court = activeModal === 'basketball' || activeModal === 'volleyball' ? courtStores[activeModal].getState().state : null;
        const isPlayingMatch = (currentMatch && currentMatch.status === 'in_progress')
          || (activeModal === 'football' && pitch.status !== 'LOBBY' && amParticipant(pitch))
          || (!!court && court.status !== 'LOBBY' && onCourt(court));

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
        {drivingCar && onCampusNow && (carView === 'inside' ? <Cockpit id={drivingCar} paint={myPaint} /> : <CarBody id={drivingCar} paint={myPaint} />)}
        {ride && rideCar && onCampusNow && carView === 'inside' && (() => { const seat = PASSENGER_SEATS[ride.seat] ?? PASSENGER_SEATS[0]; return <group position={[-seat[0], -seat[1], -seat[2]]}><Cockpit id={rideCar} paint={ridePaint} /></group>; })()}
        <group position={drivingCar && onCampusNow ? DRIVER_SEAT : [0, 0, 0]}>
        <AvatarModel
          userId={user.id}
          username={user.username}
          college={user.college}
          avatarConfig={user.avatarConfig}
          animation={myAnimation}
          isLocal
          held={myHeldItem}
          table={seatedAt && seatedAt.animation !== 'sleep' ? diningSpotAt(seatedAt.position) : null}
          hidden={onCampusNow && (!!drivingCar || !!ride)}
        />
        </group>
      </group>
    </RigidBody>
  );
};
