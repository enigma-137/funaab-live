import React, { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '../../types/game';
import { normalizeAvatar } from '../../config/avatar';

// Asset boundary: all consumers use config + pose. Replace the parts here with
// manifest-backed GLBs without changing profiles, transport or the editor.
export const AvatarBody = memo(
  ({ config, animation = 'idle' }: { config: AvatarConfig; animation?: string }) => {
    const a = normalizeAvatar(config);
    const leftLeg = useRef<THREE.Group>(null),
      rightLeg = useRef<THREE.Group>(null);
    const leftArm = useRef<THREE.Group>(null),
      rightArm = useRef<THREE.Group>(null);
    const body = useRef<THREE.Group>(null);
    const materials = useMemo(
      () => ({
        skin: new THREE.MeshStandardMaterial({ color: a.skinTone, roughness: 0.85 }),
        hair: new THREE.MeshStandardMaterial({ color: a.hairColor, roughness: 1 }),
        top: new THREE.MeshStandardMaterial({ color: a.topColor, roughness: 0.85 }),
        bottom: new THREE.MeshStandardMaterial({ color: a.bottomColor, roughness: 0.9 }),
        shoe: new THREE.MeshStandardMaterial({ color: a.shoeColor, roughness: 0.8 }),
        eye: new THREE.MeshBasicMaterial({ color: '#211b18' }),
      }),
      [a.skinTone, a.hairColor, a.topColor, a.bottomColor, a.shoeColor],
    );
    useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
    useFrame(({ clock }) => {
      const t = clock.elapsedTime,
        moving = animation === 'walk' || animation === 'run',
        sitting = animation === 'sit';
      const swing = moving ? Math.sin(t * (animation === 'run' ? 12 : 8)) * 0.55 : 0;
      if (leftLeg.current) leftLeg.current.rotation.x = sitting ? -Math.PI / 2 : swing;
      if (rightLeg.current) rightLeg.current.rotation.x = sitting ? -Math.PI / 2 : -swing;
      if (leftArm.current) leftArm.current.rotation.x = sitting ? -0.4 : -swing * 0.7;
      if (rightArm.current) {
        rightArm.current.rotation.x = sitting ? -0.4 : swing * 0.7;
        rightArm.current.rotation.z = animation === 'wave' ? -2.4 + Math.sin(t * 5) * 0.2 : -0.08;
      }
      if (body.current)
        body.current.position.y = sitting
          ? -0.28
          : moving
            ? Math.abs(swing) * 0.045
            : Math.sin(t * 2) * 0.012;
    });
    const width = a.bodyType === 'feminine' ? 0.25 : 0.29;
    const fullHair = ['short-afro', 'short-natural', 'natural-puff'].includes(a.hairstyle);
    const ball = (
      position: [number, number, number],
      size: number,
      material: THREE.Material = materials.hair,
      scale?: [number, number, number],
    ) => (
      <mesh position={position} scale={scale} material={material}>
        <sphereGeometry args={[size, 10, 8]} />
      </mesh>
    );
    return (
      <group ref={body}>
        <mesh position={[0, 1.2, 0]} material={materials.top}>
          <cylinderGeometry
            args={[width, a.topStyle === 'blouse' ? 0.28 : width * 0.87, 0.65, 10]}
          />
        </mesh>
        {['polo', 'shirt'].includes(a.topStyle) && (
          <mesh position={[0, 1.51, 0.06]} rotation={[0.3, 0, 0]} material={materials.top}>
            <torusGeometry args={[0.12, 0.036, 4, 10, Math.PI]} />
          </mesh>
        )}
        {a.topStyle === 'shirt' && (
          <mesh position={[0, 1.24, width]} material={materials.shoe}>
            <boxGeometry args={[0.025, 0.48, 0.012]} />
          </mesh>
        )}
        {a.topStyle === 'hoodie' && ball([0, 1.48, -0.15], 0.2, materials.top)}
        {ball([0, 1.62, 0], 0.1, materials.skin)}
        <group position={[0, 1.85, 0]}>
          {ball([0, 0, 0], 0.245, materials.skin, [0.88, 1.12, 0.93])}
          {ball([-0.212, 0, 0], 0.047, materials.skin)}
          {ball([0.212, 0, 0], 0.047, materials.skin)}
          {ball([0, 0.16, -0.025], fullHair ? 0.27 : 0.235, materials.hair, [
            1,
            fullHair ? 0.85 : 0.45,
            1,
          ])}
          {a.hairstyle === 'fade' && ball([0, 0.19, -0.035], 0.2, materials.hair, [0.85, 0.4, 1])}
          {['bun', 'natural-puff'].includes(a.hairstyle) &&
            ball([0, 0.29, -0.14], a.hairstyle === 'bun' ? 0.15 : 0.22)}
          {['braids', 'short-twists'].includes(a.hairstyle) &&
            Array.from({ length: 8 }, (_, i) => (
              <mesh
                key={i}
                position={[
                  Math.cos((i * Math.PI) / 4) * 0.2,
                  a.hairstyle === 'braids' ? -0.06 : 0.22,
                  Math.sin((i * Math.PI) / 4) * 0.17 - 0.03,
                ]}
                material={materials.hair}
              >
                <capsuleGeometry args={[0.04, a.hairstyle === 'braids' ? 0.37 : 0.11, 2, 5]} />
              </mesh>
            ))}
          {ball([-0.078, 0.02, 0.213], 0.023, materials.eye)}
          {ball([0.078, 0.02, 0.213], 0.023, materials.eye)}
          {ball([0, -0.035, 0.23], 0.034, materials.skin)}
        </group>
        {([-1, 1] as const).map((side) => (
          <group
            key={side}
            ref={side === -1 ? leftArm : rightArm}
            position={[side * (width + 0.08), 1.43, 0]}
            rotation={[0, 0, side * -0.08]}
          >
            <mesh position={[0, -0.2, 0]} material={materials.top}>
              <capsuleGeometry
                args={[
                  0.085,
                  a.topStyle === 't-shirt' || a.topStyle === 'polo' ? 0.18 : 0.34,
                  2,
                  8,
                ]}
              />
            </mesh>
            <mesh position={[0, -0.43, 0]} material={materials.skin}>
              <capsuleGeometry args={[0.068, 0.15, 2, 8]} />
            </mesh>
            {ball([0, -0.55, 0], 0.075, materials.skin)}
          </group>
        ))}
        {a.bottomStyle === 'skirt' && (
          <mesh position={[0, 0.73, 0]} material={materials.bottom}>
            <cylinderGeometry args={[0.25, 0.35, 0.48, 10]} />
          </mesh>
        )}
        {([-1, 1] as const).map((side) => (
          <group
            key={side}
            ref={side === -1 ? leftLeg : rightLeg}
            position={[side * 0.135, 0.89, 0]}
          >
            <mesh
              position={[0, -0.34, 0]}
              material={a.bottomStyle === 'skirt' ? materials.skin : materials.bottom}
            >
              <capsuleGeometry args={[a.bottomStyle === 'joggers' ? 0.1 : 0.09, 0.49, 2, 8]} />
            </mesh>
            <mesh position={[0, -0.77, 0.055]} material={materials.shoe}>
              <boxGeometry args={[0.19, a.shoeStyle === 'flats' ? 0.085 : 0.13, 0.31]} />
            </mesh>
            {a.bottomStyle === 'jeans' && (
              <mesh position={[0, -0.3, 0.09]} material={materials.bottom}>
                <boxGeometry args={[0.12, 0.15, 0.018]} />
              </mesh>
            )}
          </group>
        ))}
      </group>
    );
  },
);
