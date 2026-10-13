import React, { useEffect, useState } from 'react';
import { ECONOMY_CONFIG, formatNaira } from '../config/economy';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';
import { useGameStore } from '../stores/gameStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { CheckCircle2 } from 'lucide-react';
import { ModalCloseButton } from './ModalCloseButton';

export const DailyRewardModal: React.FC = () => {
  const { user } = useAuthStore();
  const { claimDailyReward, lastDailyRewardDate } = useWalletStore();
  const { setActiveModal } = useGameStore();

  const todayStr = new Date().toISOString().split('T')[0];
  const isAlreadyClaimed = lastDailyRewardDate === todayStr;

  const [claimed, setClaimed] = useState(isAlreadyClaimed);
  const [message, setMessage] = useState<string | null>(null);

  const handleClaim = async () => {
    if (!user) return;
    const res = await claimDailyReward(user.id);
    if (res.success) {
      setClaimed(true);
      setMessage(res.message);
      networkManager.sendDailyRewardClaimed(user.username, res.amount);
      setTimeout(() => {
        setActiveModal(null);
      }, 2000);
    } else {
      setMessage(res.message);
    }
  };

  const close = () => setActiveModal(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label="Daily allowance" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-3xl bg-slate-900 border-2 border-emerald-500/40 shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans'] text-center">
        <ModalCloseButton onClose={close} label="Close daily allowance" style={{ position: 'absolute', top: 12, right: 12 }} />
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-600 to-amber-500 mx-auto flex items-center justify-center text-3xl shadow-xl mb-3 animate-bounce">
            🎁
          </div>
          <h2 className="text-xl font-black text-white font-['Outfit'] tracking-wide">
            WELCOME TO CAMPUS!
          </h2>
          <p className="text-xs text-emerald-300 font-semibold mt-0.5">
            Daily Resumption Allowance
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[11px] text-slate-400 uppercase font-bold">Today's Allowance</div>
            <div className="text-3xl font-black text-emerald-400 font-mono">+{formatNaira(ECONOMY_CONFIG.DAILY_RESUMPTION_ALLOWANCE)}</div>
            <div className="text-[10px] text-slate-500">Credited directly to your game wallet</div>
          </div>

          {message && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {!claimed ? (
            <button
              onClick={handleClaim}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs font-['Outfit'] tracking-wider uppercase shadow-xl transition transform active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Collect {formatNaira(ECONOMY_CONFIG.DAILY_RESUMPTION_ALLOWANCE)} Allowance</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-3 px-4 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
