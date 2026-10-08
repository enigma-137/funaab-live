import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { AvatarConfig } from '../../types/game';
import { useSocialStore } from '../../stores/socialStore';
import { MessageSquare } from 'lucide-react';

interface AvatarModelProps {
  username: string;
  college: string;
  avatarConfig: AvatarConfig;
  animation?: 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'cheer';
  isLocal?: boolean;
}

export const AvatarModel: React.FC<AvatarModelProps> = ({
  username,
  college,
  avatarConfig,
  animation = 'idle',
  isLocal = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);

  const { unreadDmsByPartner, openDm } = useSocialStore();
  const unreadCount = unreadDmsByPartner[username.toLowerCase()] || 0;
  const hasUnreadDm = unreadCount > 0;

  // Procedural limb animation based on state
  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (animation === 'walk' || animation === 'run') {
      const speed = animation === 'run' ? 14 : 9;
      const legSwing = Math.sin(t * speed) * (animation === 'run' ? 0.7 : 0.45);
      const armSwing = Math.sin(t * speed) * (animation === 'run' ? 0.6 : 0.35);

      if (leftLegRef.current) leftLegRef.current.rotation.x = legSwing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -legSwing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -armSwing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = armSwing;

      // Small vertical body bounce
      if (torsoRef.current) {
        torsoRef.current.position.y = 1.05 + Math.abs(Math.sin(t * speed * 2)) * 0.08;
      }
    } else if (animation === 'sit') {
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = -Math.PI / 2;
        leftLegRef.current.position.set(-0.2, 0.4, 0.3);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = -Math.PI / 2;
        rightLegRef.current.position.set(0.2, 0.4, 0.3);
      }
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.3;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -0.3;
      if (torsoRef.current) torsoRef.current.position.y = 0.75;
    } else {
      // Idle breathing & gentle limb posture
      const breath = Math.sin(t * 2) * 0.03;
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = 0;
        leftLegRef.current.position.set(-0.2, 0.45, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.x = 0;
        rightLegRef.current.position.set(0.2, 0.45, 0);
      }
      if (leftArmRef.current) leftArmRef.current.rotation.x = breath;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -breath;
      if (torsoRef.current) torsoRef.current.position.y = 1.05 + breath * 0.5;
    }
  });

  const shirtColor = avatarConfig?.shirtColor || '#16a34a';
  const skinColor = avatarConfig?.skinColor || '#8d5524';
  const pantsColor = '#1e293b'; // Navy/dark jeans
  const shoeColor = '#0f172a';
  const hairColor = avatarConfig?.hairColor || '#1e1b18';

  return (
    <group ref={groupRef}>
      {/* Floating Username & College Badge & Unread DM Alert */}
      <Html
        position={[0, hasUnreadDm ? 2.45 : 2.25, 0]}
        center
        distanceFactor={14}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: hasUnreadDm ? 'auto' : 'none' }}
      >
        <div className="flex flex-col items-center gap-0.5 select-none transition-all scale-90 hover:scale-95">
          {/* Unread DM Overhead Alert Bubble */}
          {hasUnreadDm && !isLocal && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                openDm({
                  id: username,
                  username,
                  college,
                });
              }}
              className="mb-0.5 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-black text-[10px] shadow-xl border border-white animate-bounce pointer-events-auto cursor-pointer transition transform active:scale-95"
              title={`Click to read ${unreadCount} new message(s) from @${username}`}
            >
              <MessageSquare className="w-3 h-3 fill-white text-white" />
              <span>DM ({unreadCount})</span>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/60 shadow-md">
            <span
              className="w-1.5 h-1.5 rounded-full ring-1 ring-white/20 animate-pulse"
              style={{ backgroundColor: shirtColor }}
            />
            <span className="font-bold text-[11px] text-white tracking-wide font-['Plus_Jakarta_Sans']">
              {username}
            </span>
            {isLocal && (
              <span className="text-[9px] uppercase font-black px-1 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                YOU
              </span>
            )}
          </div>
          <div className="text-[9px] font-bold tracking-wider px-1.5 py-0.2 rounded bg-black/60 text-slate-300 border border-white/10 uppercase">
            {college}
          </div>
        </div>
      </Html>

      {/* Shadow Blob underneath avatar */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color="#000000" opacity={0.35} transparent />
      </mesh>

      {/* Head + Hair + Face Features */}
      <group ref={headRef} position={[0, 1.85, 0]}>
        {/* Head Sphere */}
        <mesh castShadow>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>

        {/* Stylised Hair / Cap */}
        <mesh position={[0, 0.12, -0.02]} castShadow>
          <sphereGeometry args={[0.28, 14, 14]} />
          <meshStandardMaterial color={hairColor} roughness={0.8} />
        </mesh>

        {/* Eyes (Stylised black beads) */}
        <mesh position={[-0.08, 0.03, 0.22]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0.08, 0.03, 0.22]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>

        {/* Glasses / Sunglasses Accent */}
        <mesh position={[0, 0.03, 0.24]}>
          <boxGeometry args={[0.26, 0.05, 0.02]} />
          <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.2} />
        </mesh>
      </group>

      {/* Torso / College Shirt */}
      <mesh ref={torsoRef} position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.55, 0.65, 0.32]} />
        <meshStandardMaterial color={shirtColor} roughness={0.4} />
      </mesh>

      {/* Backpack / Campus Bag */}
      <mesh position={[0, 1.15, -0.22]} castShadow>
        <boxGeometry args={[0.38, 0.45, 0.16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>

      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[-0.38, 1.15, 0]} castShadow>
        <boxGeometry args={[0.15, 0.55, 0.18]} />
        <meshStandardMaterial color={shirtColor} />
        {/* Hand */}
        <mesh position={[0, -0.32, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
      </mesh>

      {/* Right Arm */}
      <mesh ref={rightArmRef} position={[0.38, 1.15, 0]} castShadow>
        <boxGeometry args={[0.15, 0.55, 0.18]} />
        <meshStandardMaterial color={shirtColor} />
        {/* Hand */}
        <mesh position={[0, -0.32, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
      </mesh>

      {/* Left Leg */}
      <mesh ref={leftLegRef} position={[-0.17, 0.45, 0]} castShadow>
        <boxGeometry args={[0.18, 0.65, 0.2]} />
        <meshStandardMaterial color={pantsColor} roughness={0.6} />
        {/* Shoe */}
        <mesh position={[0, -0.36, 0.05]}>
          <boxGeometry args={[0.2, 0.14, 0.3]} />
          <meshStandardMaterial color={shoeColor} roughness={0.3} />
        </mesh>
      </mesh>

      {/* Right Leg */}
      <mesh ref={rightLegRef} position={[0.17, 0.45, 0]} castShadow>
        <boxGeometry args={[0.18, 0.65, 0.2]} />
        <meshStandardMaterial color={pantsColor} roughness={0.6} />
        {/* Shoe */}
        <mesh position={[0, -0.36, 0.05]}>
          <boxGeometry args={[0.2, 0.14, 0.3]} />
          <meshStandardMaterial color={shoeColor} roughness={0.3} />
        </mesh>
      </mesh>
    </group>
  );
};
