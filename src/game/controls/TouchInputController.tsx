import { useHostelStore } from '../../stores/hostelStore';
import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useInputStore } from '../../stores/inputStore';
import { useGameStore } from '../../stores/gameStore';
import { swipeToRotation } from '../camera/cameraMath';
import { CameraGestureTracker } from './cameraGesture';

// Tap-to-move resolves against the ground plane (same extent as the old invisible 310m raycast mesh).
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.01);
const GROUND_HALF_EXTENT = 155;
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

const gameplayInputBlocked = (): boolean => {
  const hostel = useHostelStore.getState();
  return (
    Boolean(useGameStore.getState().activeModal) ||
    useInputStore.getState().isInputFocused ||
    Boolean(hostel.preview) ||
    Boolean(hostel.pose)
  );
};

/**
 * Canvas gesture controller: one-finger swipe (or mouse drag) orbits the camera,
 * a quick tap walks to the tapped ground point. Listens on the canvas element
 * directly so swipes over the sky or buildings rotate just as well as over ground.
 */
export const TouchInputController: React.FC = () => {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    const tracker = new CameraGestureTracker();
    const input = useInputStore.getState();

    const endDrag = () => {
      tracker.reset();
      if (useInputStore.getState().isDraggingCamera) input.setIsDraggingCamera(false);
    };

    const sample = (e: PointerEvent) => ({ pointerId: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now() });

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (gameplayInputBlocked()) return;
      tracker.down(sample(e));
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onMove = (e: PointerEvent) => {
      if (!tracker.active) return;
      if (gameplayInputBlocked()) {
        endDrag();
        return;
      }
      const result = tracker.move(sample(e));
      if (result.kind !== 'rotate') return;
      const [dYaw, dPitch] = swipeToRotation(result.dx, result.dy, el.clientWidth, el.clientHeight, e.pointerType);
      const store = useInputStore.getState();
      if (!store.isDraggingCamera) store.setIsDraggingCamera(true);
      store.rotateCamera(dYaw, dPitch);
    };

    const onUp = (e: PointerEvent) => {
      const result = tracker.up(sample(e));
      if (!tracker.active && useInputStore.getState().isDraggingCamera) input.setIsDraggingCamera(false);
      if (result.kind !== 'tap' || gameplayInputBlocked()) return;
      // With the joystick on, walking is the stick's job: a tap just selects things.
      if (useInputStore.getState().controlMode === 'joystick' && e.pointerType !== 'mouse') return;

      const rect = el.getBoundingClientRect();
      _ndc.set(((result.x - rect.left) / rect.width) * 2 - 1, -((result.y - rect.top) / rect.height) * 2 + 1);
      _raycaster.setFromCamera(_ndc, camera);
      if (!_raycaster.ray.intersectPlane(GROUND_PLANE, _hit)) return;
      if (Math.abs(_hit.x) > GROUND_HALF_EXTENT || Math.abs(_hit.z) > GROUND_HALF_EXTENT) return;

      const dest: [number, number, number] = [_hit.x, 0, _hit.z];
      // Scene objects (a player, a keke, a sign) react on the DOM 'click' that follows this
      // pointerup. Decide after it: if the tap opened something, it was not a walk order.
      // Otherwise tapping someone to message them would stand you up and walk you over.
      window.setTimeout(() => {
        if (gameplayInputBlocked()) return;
        const store = useInputStore.getState();
        store.triggerHaptic(18);
        store.setTapRipple(dest);
        store.setTargetDestination(dest);
      }, 0);
    };

    const onCancel = (e: PointerEvent) => {
      tracker.cancel(e.pointerId);
      if (!tracker.active && useInputStore.getState().isDraggingCamera) input.setIsDraggingCamera(false);
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') endDrag();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', endDrag);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', endDrag);
      document.removeEventListener('visibilitychange', onVisibility);
      endDrag();
    };
  }, [gl, camera]);

  return null;
};
