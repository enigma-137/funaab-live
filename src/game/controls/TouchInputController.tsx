import React, { useRef } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useInputStore } from '../../stores/inputStore';
import { useGameStore } from '../../stores/gameStore';

export const TouchInputController: React.FC = () => {
  const {
    rotateCamera,
    setTargetDestination,
    setTapRipple,
    triggerHaptic,
    isInputFocused,
  } = useInputStore();
  const { activeModal } = useGameStore();

  const pointerDownState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startTime: number;
    isDragging: boolean;
  } | null>(null);

  const { camera } = useThree();

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // If a modal is open or user is typing in chat/inputs, ignore 3D canvas touch gestures
    if (activeModal || isInputFocused) return;

    // Only handle primary button / touch
    if (e.nativeEvent.button !== undefined && e.nativeEvent.button !== 0) return;

    pointerDownState.current = {
      pointerId: e.nativeEvent.pointerId,
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      lastX: e.nativeEvent.clientX,
      lastY: e.nativeEvent.clientY,
      startTime: performance.now(),
      isDragging: false,
    };
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const state = pointerDownState.current;
    if (!state || state.pointerId !== e.nativeEvent.pointerId) return;

    const currentX = e.nativeEvent.clientX;
    const currentY = e.nativeEvent.clientY;
    const dx = currentX - state.lastX;
    const dy = currentY - state.lastY;
    const totalDist = Math.hypot(currentX - state.startX, currentY - state.startY);

    if (totalDist > 8 || state.isDragging) {
      state.isDragging = true;
      // Drag to rotate / orbit camera
      const yawSensitivity = 0.0055;
      const pitchSensitivity = 0.0035;
      rotateCamera(-dx * yawSensitivity, dy * pitchSensitivity);
    }

    state.lastX = currentX;
    state.lastY = currentY;
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    const state = pointerDownState.current;
    if (!state || state.pointerId !== e.nativeEvent.pointerId) return;

    const totalDist = Math.hypot(e.nativeEvent.clientX - state.startX, e.nativeEvent.clientY - state.startY);
    const duration = performance.now() - state.startTime;

    pointerDownState.current = null;

    // If it was a quick tap without significant drag, perform tap-to-move
    if (totalDist < 10 && duration < 400) {
      if (e.point) {
        const dest: [number, number, number] = [e.point.x, 0, e.point.z];
        triggerHaptic(18);
        setTapRipple(dest);
        setTargetDestination(dest);
      }
    }
  };

  return (
    <group>
      {/* Invisible ground plane overlay for raycasting taps across the entire campus area */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        visible={false}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
};
