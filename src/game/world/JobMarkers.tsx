import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CanvasLabel } from './CanvasLabel';
import { useJobStore } from '../../stores/jobStore';
import { useGameStore } from '../../stores/gameStore';
import { CAMPUS_JOBS, JOB_HANDOVERS } from '../../config/campusJobs';
import { npcAppearance } from '../../config/npcAppearance';
import { AvatarBody } from '../player/AvatarBody';
import type { HeldItem } from '../../config/heldItems';

/** How long the giver waves after handing over, and the receiver celebrates with the package. */
const AFTER_MS = 5000;
/** Beside the marker ring and out in front of the door (entrances face +z), so they're never inside. */
const OFFSET = new THREE.Vector3(-1.3, 0, 2.0);

/** Someone at the pickup or drop-off who turns to face you and hands over / takes the package. */
function HandoverCharacter({ id, name, at, look, held, animation }: {
  id: string; name: string; at: readonly number[]; look: ReturnType<typeof npcAppearance>; held: HeldItem | null; animation: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const pos = useMemo(() => new THREE.Vector3(at[0], 0, at[2]).add(OFFSET), [at]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const me = useGameStore.getState().myPosition;
    const target = Math.atan2(me[0] - pos.x, me[2] - pos.z);
    const diff = Math.atan2(Math.sin(target - ref.current.rotation.y), Math.cos(target - ref.current.rotation.y));
    ref.current.rotation.y += diff * Math.min(1, dt * 6);
  });
  return (
    <group position={pos}>
      <group ref={ref}>
        <AvatarBody identity={id} config={look} animation={animation} held={held} />
      </group>
      <CanvasLabel position={[0, 2.25, 0]} outline="#173c2a" lines={[{ text: name, size: 0.24, color: '#ffffff' }]} />
    </group>
  );
}

export function JobMarkers() {
  const job = useJobStore((s) => s.activeJob);
  const handover = useJobStore((s) => s.handover);
  const [, rerender] = useState(0);
  // Let the after-handover moment end on its own.
  useEffect(() => {
    if (!handover) return;
    const left = handover.at + AFTER_MS - Date.now();
    if (left <= 0) return;
    const t = setTimeout(() => rerender((n) => n + 1), left + 50);
    return () => clearTimeout(t);
  }, [handover]);
  const recent = handover && Date.now() - handover.at < AFTER_MS ? handover : null;
  const shown = job ?? (recent ? CAMPUS_JOBS.find((j) => j.id === recent.jobId) ?? null : null);
  const spec = shown ? JOB_HANDOVERS[shown.id] : undefined;
  const looks = useMemo(() => spec && shown ? {
    giver: npcAppearance(`${shown.id}-giver`, spec.giver.look),
    receiver: npcAppearance(`${shown.id}-receiver`, spec.receiver.look),
  } : null, [shown?.id]);
  if (!shown) return null;
  const pickup = job?.status === 'accepted';
  const pkg: HeldItem | null = spec ? { kind: spec.kind, until: Number.MAX_SAFE_INTEGER } : null;
  const justPicked = recent?.stage === 'pickup' && recent.jobId === shown.id;
  const justDelivered = recent?.stage === 'deliver' && recent.jobId === shown.id;
  return (
    <>
      {job && (
        <group position={pickup ? job.sourcePos : job.destinationPos}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .08, 0]}><ringGeometry args={[1.1, 1.4, 24]} /><meshBasicMaterial color="#fbc766" transparent opacity={.8} /></mesh>
          <CanvasLabel position={[0, 2.5, 0]} outline="#173c2a" lines={[{ text: pickup ? 'PICK UP HERE' : 'DELIVER / FINISH', size: .4, color: '#fff0a8' }]} />
        </group>
      )}
      {spec && looks && (pickup || justPicked) && (
        <HandoverCharacter id={`${shown.id}-giver`} name={spec.giver.name} at={shown.sourcePos} look={looks.giver}
          held={pickup ? pkg : null} animation={pickup ? 'idle' : 'wave'} />
      )}
      {spec && looks && (job?.status === 'picked_up' || justDelivered) && (
        <HandoverCharacter id={`${shown.id}-receiver`} name={justDelivered ? "Thank you!" : spec.receiver.name} at={shown.destinationPos} look={looks.receiver}
          held={justDelivered ? pkg : null} animation={justDelivered ? 'cheer' : 'wave'} />
      )}
    </>
  );
}
