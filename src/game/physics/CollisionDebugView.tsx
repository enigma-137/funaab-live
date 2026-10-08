import React from 'react';
import { physicsWorld } from './physicsWorld';
import { useGameStore } from '../../stores/gameStore';

export const CollisionDebugView: React.FC = () => {
  const { debugPhysics, myPosition } = useGameStore();

  if (!debugPhysics) return null;

  return (
    <group>
      {/* Static Building & Prop Colliders */}
      {physicsWorld.debugShapes.map((shape, idx) => {
        if (shape.type === 'cuboid' && shape.halfExtents) {
          const [hx, hy, hz] = shape.halfExtents;
          return (
            <group key={idx} position={shape.position}>
              <mesh>
                <boxGeometry args={[hx * 2, hy * 2, hz * 2]} />
                <meshBasicMaterial color="#00ff88" wireframe transparent opacity={0.65} />
              </mesh>
            </group>
          );
        }

        if (shape.type === 'cylinder' && shape.radius && shape.halfHeight) {
          return (
            <group key={idx} position={shape.position}>
              <mesh>
                <cylinderGeometry args={[shape.radius, shape.radius, shape.halfHeight * 2, 12]} />
                <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.65} />
              </mesh>
            </group>
          );
        }

        return null;
      })}

      {/* Local Player Capsule Collider Wireframe */}
      <group position={[myPosition[0], myPosition[1] + 0.85, myPosition[2]]}>
        <mesh>
          <capsuleGeometry args={[0.35, 1.0, 8, 16]} />
          <meshBasicMaterial color="#f43f5e" wireframe transparent opacity={0.9} />
        </mesh>
      </group>
    </group>
  );
};
