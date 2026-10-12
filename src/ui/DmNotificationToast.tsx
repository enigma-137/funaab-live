import React, { useEffect } from 'react';
import { useSocialStore } from '../stores/socialStore';
import { useInputStore } from '../stores/inputStore';
import { useShallow } from 'zustand/react/shallow';
import { MessageSquare, X, ArrowRight } from 'lucide-react';

export const DmNotificationToast: React.FC = () => {
  const { lastIncomingDm, dismissLastIncomingDm, openDm } = useSocialStore();
  const { triggerHaptic } = useInputStore(useShallow((s) => ({ triggerHaptic: s.triggerHaptic })));

  useEffect(() => {
    if (lastIncomingDm) {
      triggerHaptic([30, 40, 30]);
      const timer = setTimeout(() => {
        dismissLastIncomingDm();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [lastIncomingDm]);

  if (!lastIncomingDm) return null;

  const handleOpen = () => {
    openDm({
      id: lastIncomingDm.senderId,
      username: lastIncomingDm.senderName,
      college: lastIncomingDm.college || 'STUDENT',
    });
    dismissLastIncomingDm();
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-in slide-in-from-top-4 duration-300 w-full max-w-md px-4 select-none">
      <div className="p-3 sm:p-3.5 rounded-3xl bg-slate-950/95 border-2 border-red-500/80 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-white">
        {/* Sender & Snippet */}
        <div
          onClick={handleOpen}
          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 group"
        >
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition">
              <MessageSquare className="w-5 h-5 fill-white" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-red-600 animate-ping" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="text-[10px] font-black uppercase text-red-400 tracking-wider">
                New Direct Message
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {lastIncomingDm.college || 'COLENG'}
              </span>
            </div>
            <div className="text-xs font-bold text-white truncate font-['Outfit'] mt-0.5">
              @{lastIncomingDm.senderName}: <span className="font-normal text-slate-200">{lastIncomingDm.text}</span>
            </div>
          </div>
        </div>

        {/* Action Button & Dismiss */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleOpen}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-md transition transform active:scale-95 flex items-center gap-1"
          >
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={dismissLastIncomingDm}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
