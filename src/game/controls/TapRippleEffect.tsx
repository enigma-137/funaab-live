import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useInputStore } from '../../stores/inputStore';

export const TapRippleEffect: React.FC = () => {
  const { tapRipple, clearTapRipple } = useInputStore();
  const ringRef = useRef<THREE.Mesh>(null);
  const diskRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number>(0);
  const currentIdRef = useRef<number | null>(null);

  useFrame(() => {
    if (!tapRipple) {
      currentIdRef.current = null;
      return;
    }

    if (currentIdRef.current !== tapRipple.id) {
      currentIdRef.current = tapRipple.id;
      startTimeRef.current = performance.now();
    }

    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const duration = 0.55; // 550ms animation
    const progress = Math.min(1, elapsed / duration);

    if (progress >= 1) {
      clearTapRipple();
      return;
    }

    // Scale from 0.2 to 1.35
    const currentScale = 0.2 + progress * 1.15;
    const opacity = (1 - progress) * 0.9;

    if (ringRef.current) {
      ringRef.current.scale.set(currentScale, currentScale, 1);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = opacity;
    }

    if (diskRef.current) {
      diskRef.current.scale.set(currentScale * 0.65, currentScale * 0.65, 1);
      const mat = diskRef.current.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = opacity * 0.45;
    }
  });

  if (!tapRipple) return null;

  return (
    <group position={[tapRipple.position[0], 0.04, tapRipple.position[2]]}>
      {/* Outer expanding ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.72, 32]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner glowing core disk */}
      <mesh ref={diskRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial
          color="#22c55e"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
