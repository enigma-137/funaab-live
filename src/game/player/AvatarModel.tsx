import React from 'react';
import {useHostelStore} from '../../stores/hostelStore';
import { AvatarBody } from './AvatarBody';
import type { HeldItem } from '../../config/heldItems';
import { Html } from '@react-three/drei';
import { AvatarConfig } from '../../types/game';
import { useSocialStore } from '../../stores/socialStore';
import { useGameStore } from '../../stores/gameStore';
import { useInputStore } from '../../stores/inputStore';
import { MessageSquare } from 'lucide-react';

interface AvatarModelProps {
  userId?: string;
  username: string;
  college: string;
  avatarConfig: AvatarConfig;
  animation?: 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'wave' | 'cheer';
  isLocal?: boolean;
  held?: HeldItem | null;
  /** Table spot when seated at a restaurant (see diningSpotAt). */
  table?: { y: number; z: number } | null;
}

export const AvatarModel: React.FC<AvatarModelProps> = ({
  userId,
  username,
  college,
  avatarConfig,
  animation = 'idle',
  isLocal = false,
  held,
  table,
}) => {
  const { unreadDmsByPartner, openDm } = useSocialStore();
  const riding=useGameStore(s=>s.isRidingKeke);
  const inRoom=useHostelStore(s=>!!s.owner);
  const isModalOpen = useGameStore((s) => s.activeModal !== null);
  const isTouch = useInputStore((s) => s.isTouchDevice);
  const unreadCount = unreadDmsByPartner[username.toLowerCase()] || 0;
  const hasUnreadDm = unreadCount > 0;

  const shirtColor = avatarConfig?.shirtColor || '#16a34a';

  return (
    <group>
      {/* Floating Username & College Badge & Unread DM Alert (Hidden when any modal is open) */}
      {!isModalOpen && !(isLocal&&(inRoom||riding)) && (
        <Html
          position={[0, hasUnreadDm ? 2.45 : 2.25, 0]}
          center
          // Smaller on phones, where the camera sits closer and names crowded the screen.
          distanceFactor={inRoom ? 4 : isTouch ? 8 : 11}
          zIndexRange={[5, 0]}
          style={{ pointerEvents: hasUnreadDm ? 'auto' : 'none' }}
        >
          <div className="flex flex-col items-center gap-0.5 select-none transition-all scale-90 hover:scale-95">
            {/* Unread DM Overhead Alert Bubble */}
            {hasUnreadDm && !isLocal && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  openDm({
                    id: userId || username,
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

            {/* One compact tag: colour dot, name, small college code. You get a green outline. */}
            <div className={`flex items-center gap-1 px-1.5 py-[1px] rounded-full bg-slate-950/75 backdrop-blur-sm border shadow-sm ${isLocal ? 'border-emerald-400/70' : 'border-white/10'}`}>
              <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: isLocal ? '#34d399' : shirtColor }} />
              <span className="font-semibold text-[10px] leading-[14px] text-white font-['Plus_Jakarta_Sans'] max-w-[96px] truncate">
                {username}
              </span>
              <span className="text-[7.5px] leading-[14px] font-bold tracking-wide text-slate-400 uppercase">
                {college}
              </span>
            </div>
          </div>
        </Html>
      )}

      <AvatarBody config={avatarConfig} animation={animation} identity={userId || username} trackMovement held={held} table={table} />
    </group>
  );
};
