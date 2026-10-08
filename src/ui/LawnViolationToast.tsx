import React, { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { AlertOctagon, ShieldAlert, X } from 'lucide-react';

export const LawnViolationToast: React.FC = () => {
  const { lawnViolationNotice, setLawnViolationNotice } = useGameStore();

  useEffect(() => {
    if (!lawnViolationNotice) return;
    const timer = setTimeout(() => {
      setLawnViolationNotice(null);
    }, 4500);

    return () => clearTimeout(timer);
  }, [lawnViolationNotice, setLawnViolationNotice]);

  if (!lawnViolationNotice || !lawnViolationNotice.visible) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3.5 px-5 py-3.5 rounded-3xl bg-slate-950/95 border-2 border-red-500 shadow-2xl backdrop-blur-xl max-w-md text-white">
        <div className="w-10 h-10 rounded-2xl bg-red-600/30 border border-red-500/60 flex items-center justify-center text-red-400 shrink-0">
          <ShieldAlert className="w-6 h-6 animate-pulse text-red-400" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md bg-red-600 text-white font-['Outfit']">
              CAMPUS SECURITY
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              {lawnViolationNotice.officerName}
            </span>
          </div>

          <div className="text-xs font-bold text-white mt-1">
            Caught walking on the lawn!
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
            <span className="font-extrabold text-red-400 font-mono">
              -₦{lawnViolationNotice.fineAmount} Fine
            </span>
            <span className="text-slate-400 text-[10px] italic">
              Avoid the lawn next time.
            </span>
          </div>
        </div>

        <button
          onClick={() => setLawnViolationNotice(null)}
          className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
