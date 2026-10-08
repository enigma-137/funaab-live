import React from 'react';
import { ThreeEvent } from '@react-three/fiber';
import worldData from '../../worlds/funaab/world.json';
import { InteractableZone } from '../../types/game';
import { useInputStore } from '../../stores/inputStore';
import { useGameStore } from '../../stores/gameStore';

export const InteractableHitboxes: React.FC = () => {
  const { setTargetDestination, triggerHaptic } = useInputStore();
  const { myPosition, setSelectedHallLocationId, setActiveModal } = useGameStore();

  const handlePointerDown = (e: ThreeEvent<PointerEvent>, zone: InteractableZone) => {
    e.stopPropagation();

    // Check distance between local player and interactable
    const px = myPosition[0];
    const pz = myPosition[2];
    const zx = zone.position[0];
    const zz = zone.position[2];
    const dist = Math.hypot(zx - px, zz - pz);

    triggerHaptic(25);

    if (dist <= zone.radius) {
      // Direct instant interaction
      switch (zone.type) {
        case 'atm':
          setActiveModal('bank');
          break;
        case 'food':
        case 'restaurant_dining':
          setActiveModal('floral_world');
          break;
        case 'lecture_hall':
          setSelectedHallLocationId(zone.targetId || zone.id || 'colfhec-lecture-hall');
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
    } else {
      // Approach interactable first, then trigger
      setTargetDestination([zone.position[0], zone.position[1], zone.position[2]], {
        type: zone.type,
        id: zone.id,
        targetId: zone.targetId,
        label: zone.label,
        position: zone.position,
        radius: zone.radius,
      });
    }
  };

  return (
    <group>
      {(worldData.interactables as InteractableZone[]).map((zone) => (
        <mesh
          key={zone.id}
          position={[zone.position[0], zone.position[1] + 1.2, zone.position[2]]}
          onPointerDown={(e) => handlePointerDown(e, zone)}
          visible={false}
        >
          {/* Generous touch hitbox */}
          <cylinderGeometry args={[Math.max(2.2, zone.radius * 0.75), Math.max(2.2, zone.radius * 0.75), 2.5, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};
