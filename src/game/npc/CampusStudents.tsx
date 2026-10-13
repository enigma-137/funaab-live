import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { AvatarBody } from '../player/AvatarBody';
import { npcAppearance } from '../../config/npcAppearance';
import { campusStudentWalks, gardenChatters, walkAt, type StudentWalk } from '../../config/campusStudents';

function Walker({ walk }: { walk: StudentWalk }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const { position, rotation } = walkAt(walk, Date.now());
    g.position.set(...position);
    let d = rotation - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 6);
  });
  const start = walkAt(walk, Date.now());
  return (
    <group ref={ref} position={start.position} rotation={[0, start.rotation, 0]}>
      <AvatarBody identity={walk.id} trackMovement config={npcAppearance(walk.id)} />
    </group>
  );
}

/** Ambient students strolling the pavements, plus two friends chatting at the Love Garden. */
export function CampusStudents() {
  return (
    <group name="campus-students">
      {campusStudentWalks.map((w) => <Walker key={w.id} walk={w} />)}
      {gardenChatters.map((c) => (
        <group key={c.id} position={c.position} rotation={[0, c.rotation, 0]}>
          <AvatarBody identity={c.id} config={npcAppearance(c.id)} />
        </group>
      ))}
    </group>
  );
}
