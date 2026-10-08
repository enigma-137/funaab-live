import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useWalletStore } from '../stores/walletStore';
import { networkManager } from '../game/multiplayer/networkManager';
import worldData from '../worlds/funaab/world.json';
import { KekeDestination } from '../types/game';
import { MapPin, Navigation, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export const KekeDestinationModal: React.FC = () => {
  const { user } = useAuthStore();
  const { kekes, setActiveModal, setRidingKeke, myPosition } = useGameStore();
  const { balance, deductFare } = useWalletStore();

  const destinations = (worldData.kekeDestinations || []) as KekeDestination[];
  const [selectedDestId, setSelectedDestId] = useState<string>(destinations[0]?.id || 'dest-carpark');
  const [isBoarding, setIsBoarding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedDest = destinations.find((d) => d.id === selectedDestId) || destinations[0];
  const activeKeke = Object.values(kekes)[0] || { id: 'keke-1', currentStopName: 'Car Park Stop' };

  const handleConfirmBoarding = async () => {
    if (!selectedDest || !user) return;
    setErrorMessage(null);

    if (balance < selectedDest.fare) {
      setErrorMessage(`Insufficient balance! You need ₦${selectedDest.fare} (Balance: ₦${balance})`);
      return;
    }

    setIsBoarding(true);

    try {
      const success = await deductFare(user.id, selectedDest.fare, selectedDest.name);
      if (success) {
        // Send network event with chosen destination
        networkManager.enterKeke(activeKeke.id, selectedDest.id, selectedDest.name);
        setRidingKeke(true, activeKeke.id, selectedDest.id);
        setActiveModal(null);
      } else {
        setErrorMessage('Failed to process payment. Please try again.');
        setIsBoarding(false);
      }
    } catch (e) {
      setErrorMessage('Transport error occurred.');
      setIsBoarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900/95 border border-amber-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-xl shadow-lg">
              🛺
            </div>
            <div>
              <h2 className="text-base font-black text-white font-['Outfit'] tracking-wide flex items-center gap-2">
                CAMPUS KEKE TRANSPORT
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-black uppercase tracking-wider">
                  Official Transit
                </span>
              </h2>
              <p className="text-xs text-amber-200/80">
                Where are you going? Safe & fast road transit across FUNAAB.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveModal(null)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Current Stop: <strong className="text-white">{activeKeke.currentStopName || 'Campus Route'}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Your Balance:</span>
            <span className="font-extrabold text-emerald-400 font-mono text-sm">
              ₦{balance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Destination Selection Cards */}
        <div className="p-6 overflow-y-auto space-y-2.5 flex-1">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Choose Destination Stop:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {destinations.map((dest) => {
              const isSelected = dest.id === selectedDestId;
              const canAfford = balance >= dest.fare;

              return (
                <div
                  key={dest.id}
                  onClick={() => setSelectedDestId(dest.id)}
                  className={`relative p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 shadow-lg ring-2 ring-amber-400/40'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60'
                  } ${!canAfford ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{dest.icon}</span>
                      <div>
                        <div className="text-xs font-black text-white font-['Outfit']">
                          {dest.name}
                        </div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">
                          {dest.description}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 mt-1 text-[11px]">
                    <span className="text-slate-400 text-[10px]">Fare:</span>
                    <span
                      className={`font-black font-mono text-xs px-2 py-0.5 rounded-lg ${
                        canAfford
                          ? isSelected
                            ? 'bg-amber-500 text-black'
                            : 'bg-slate-700 text-amber-300'
                          : 'bg-red-950 text-red-400'
                      }`}
                    >
                      ₦{dest.fare}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer / Action Button */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-t border-slate-800 gap-3">
          <div className="text-xs">
            <div className="text-slate-400 text-[10px] uppercase">Selected Route</div>
            <div className="font-bold text-white font-['Outfit'] flex items-center gap-1.5">
              <span>{selectedDest?.icon}</span>
              <span>{selectedDest?.name}</span>
              <span className="text-amber-400 font-mono font-black">(₦{selectedDest?.fare})</span>
            </div>
          </div>

          <button
            onClick={handleConfirmBoarding}
            disabled={isBoarding || balance < (selectedDest?.fare || 0)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-black font-black text-xs font-['Outfit'] tracking-wide shadow-xl transition transform active:scale-95"
          >
            <Navigation className="w-4 h-4" />
            <span>{isBoarding ? 'Boarding Keke...' : `Board Keke • ₦${selectedDest?.fare}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
