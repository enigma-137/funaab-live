import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasLabel } from './CanvasLabel';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { bearingTo } from './navigationMath';

// Flat chevron lying on the ground, tip pointing +Z before it is turned toward the waypoint.
const chevron = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.95);
  shape.lineTo(0.62, -0.25);
  shape.lineTo(0.2, -0.05);
  shape.lineTo(0.2, -0.7);
  shape.lineTo(-0.2, -0.7);
  shape.lineTo(-0.2, -0.05);
  shape.lineTo(-0.62, -0.25);
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2); // shape +Y becomes world -Z ...
  g.rotateY(Math.PI); // ... then flip so the tip points +Z (heading 0)
  return g;
})();

/** Ground arrow circling the student, always pointing at the waypoint (hidden on arrival or in a keke). */
const GuideArrow: React.FC = () => {
  const ref = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const { myPosition, navigationDestination, isRidingKeke } = useGameStore.getState();
    const dest = navigationDestination?.position;
    const far = !!dest && Math.hypot(dest[0] - myPosition[0], dest[2] - myPosition[2]) > 6;
    g.visible = far && !isRidingKeke;
    if (!g.visible || !dest) return;
    const heading = bearingTo(myPosition, dest);
    const reach = 1.7 + Math.sin(clock.getElapsedTime() * 4) * 0.15;
    g.position.set(myPosition[0] + Math.sin(heading) * reach, myPosition[1] + 0.08, myPosition[2] + Math.cos(heading) * reach);
    g.rotation.y = heading;
    if (mat.current) mat.current.opacity = 0.7 + Math.sin(clock.getElapsedTime() * 4) * 0.2;
  });
  return (
    <group ref={ref} visible={false}>
      <mesh geometry={chevron} renderOrder={2}>
        <meshBasicMaterial ref={mat} color="#34d399" transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

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
    <>
    <GuideArrow />
    <group position={[pos[0], 0.05, pos[2]]}>
      {/* Ground Navigation Beacon Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[1.5, 2.0, 32]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* Vertical light pillar, tall enough to spot over the buildings from across campus */}
      <mesh ref={beaconRef} position={[0, 15, 0]}>
        <cylinderGeometry args={[0.35, 1.2, 30, 16, 1, true]} />
        <meshBasicMaterial color="#6ee7b7" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* Floating waypoint label & live distance (canvas lettering: no font download). */}
      <CanvasLabel
        position={[0, 3.2, 0]}
        lines={[
          { text: `📍 ${navigationDestination.shortName}`, size: 0.65, color: '#ffffff' },
          { text: `${dist}m ahead`, size: 0.38, color: '#a7f3d0' },
        ]}
      />
    </group>
    </>
  );
};
