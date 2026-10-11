import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';

export const NavigationMarker: React.FC = () => {
  const navigationDestination = useGameStore((s) => s.navigationDestination);
  const clearNavigationDestination = useGameStore((s) => s.clearNavigationDestination);
  // Whole-metre distance: re-renders only when the label changes, not on every player frame.
  const dist = useGameStore((s) =>
    s.navigationDestination
      ? Math.round(
          Math.hypot(
            s.myPosition[0] - s.navigationDestination.position[0],
            s.myPosition[2] - s.navigationDestination.position[2]
          )
        )
      : 0
  );

  const ringRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);

  // Check arrival proximity: if within 5m, auto-clear
  useEffect(() => {
    if (!navigationDestination) return;
    const myPosition = useGameStore.getState().myPosition;
    const exactDist = Math.hypot(
      myPosition[0] - navigationDestination.position[0],
      myPosition[2] - navigationDestination.position[2]
    );
    if (exactDist <= 5.0) {
      clearNavigationDestination();
    }
  }, [dist, navigationDestination, clearNavigationDestination]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 1.2;
      const s = 1 + Math.sin(t * 3) * 0.15;
      ringRef.current.scale.set(s, s, 1);
    }
    if (beaconRef.current) {
      const mat = beaconRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = 0.25 + Math.sin(t * 4) * 0.12;
      }
    }
  });

  if (!navigationDestination) return null;

  const pos = navigationDestination.position;

  return (
    <group position={[pos[0], 0.05, pos[2]]}>
      {/* Ground Navigation Beacon Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[1.5, 2.0, 32]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Vertical Light Pillar / Beam */}
      <mesh ref={beaconRef} position={[0, 6, 0]}>
        <cylinderGeometry args={[0.25, 1.2, 12, 16, 1, true]} />
        <meshBasicMaterial color="#6ee7b7" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* Floating 3D Waypoint Label & Live Distance */}
      <group position={[0, 3.2, 0]}>
        <Text
          position={[0, 0.45, 0]}
          fontSize={0.65}
          color="#ffffff"
          outlineColor="#064e3b"
          outlineWidth={0.06}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {`📍 ${navigationDestination.shortName}`}
        </Text>
        <Text
          position={[0, -0.2, 0]}
          fontSize={0.38}
          color="#a7f3d0"
          outlineColor="#064e3b"
          outlineWidth={0.04}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {`${dist}m ahead`}
        </Text>
      </group>
    </group>
  );
};
