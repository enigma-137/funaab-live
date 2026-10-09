import React, { useState, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { ActivityFeedItem } from '../types/game';
import { Bell, X } from 'lucide-react';

export const ActivityFeed: React.FC = () => {
  const { activityEvents } = useGameStore();
  const [visibleEvents, setVisibleEvents] = useState<ActivityFeedItem[]>([]);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  useEffect(() => {
    if (!activityEvents || activityEvents.length === 0) return;
    setVisibleEvents(activityEvents.slice(-4));
  }, [activityEvents]);

  if (visibleEvents.length === 0 || isMinimized) return null;

  return (
    <div className="fixed top-20 right-4 z-40 pointer-events-auto max-w-xs w-full space-y-1.5 animate-in slide-in-from-right-4 duration-300 font-['Plus_Jakarta_Sans']">
      <div className="flex items-center justify-between px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 backdrop-blur-md">
        <div className="flex items-center gap-1.5 font-bold text-slate-300">
          <Bell className="w-3 h-3 text-emerald-400" />
          <span>Campus Live Activity</span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="hover:text-white transition"
          title="Dismiss Feed"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {visibleEvents.map((evt) => (
        <div
          key={evt.id}
          className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl backdrop-blur-md text-xs leading-tight"
        >
          <span className="text-base shrink-0">
            {evt.type === 'delivery'
              ? '🛵'
              : evt.type === 'transfer'
                ? '💸'
                : evt.type === 'fine'
                  ? '🚨'
                  : evt.type === 'ps_win'
                    ? '🏆'
                    : '🎓'}
          </span>
          <div className="text-[11px] text-slate-200 font-medium">{evt.text}</div>
        </div>
      ))}
    </div>
  );
};
