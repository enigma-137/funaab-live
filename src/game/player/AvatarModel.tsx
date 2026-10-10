import React from 'react';
import { AvatarBody } from './AvatarBody';
import { Html } from '@react-three/drei';
import { AvatarConfig } from '../../types/game';
import { useSocialStore } from '../../stores/socialStore';
import { useGameStore } from '../../stores/gameStore';
import { MessageSquare } from 'lucide-react';

interface AvatarModelProps {
  userId?: string;
  username: string;
  college: string;
  avatarConfig: AvatarConfig;
  animation?: 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'cheer';
  isLocal?: boolean;
}

export const AvatarModel: React.FC<AvatarModelProps> = ({
  userId,
  username,
  college,
  avatarConfig,
  animation = 'idle',
  isLocal = false,
}) => {
  const { unreadDmsByPartner, openDm } = useSocialStore();
  const isModalOpen = useGameStore((s) => s.activeModal !== null);
  const unreadCount = unreadDmsByPartner[username.toLowerCase()] || 0;
  const hasUnreadDm = unreadCount > 0;

  const shirtColor = avatarConfig?.shirtColor || '#16a34a';

  return (
    <group>
      {/* Floating Username & College Badge & Unread DM Alert (Hidden when any modal is open) */}
      {!isModalOpen && (
        <Html
          position={[0, hasUnreadDm ? 2.45 : 2.25, 0]}
          center
          distanceFactor={14}
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
      )}

      <AvatarBody config={avatarConfig} animation={animation} />
    </group>
  );
};
