import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';
import { useGameStore } from '../stores/gameStore';
import worldData from '../worlds/funaab/world.json';
import { FoodItem } from '../types/game';
import { X, UtensilsCrossed, CheckCircle2, ShoppingBag } from 'lucide-react';

export const FoodVendorModal: React.FC = () => {
  const { user } = useAuthStore();
  const { balance, purchaseFood } = useWalletStore();
  const { setActiveModal } = useGameStore();

  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleBuy = async (item: FoodItem) => {
    if (!user || purchasingId) return;
    setPurchasingId(item.id);
    setSuccessMessage(null);

    const res = await purchaseFood(user.id, item);
    if (res.success) {
      setSuccessMessage(`Bought ${item.name}! Added to your inventory.`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } else {
      setSuccessMessage(res.error || 'Purchase failed!');
      setTimeout(() => setSuccessMessage(null), 3500);
    }
    setPurchasingId(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-orange-500/40 rounded-3xl shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans']">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-950 via-slate-900 to-orange-950 border-b border-orange-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 text-lg">
              🍗
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Outfit']">Mama Cass Campus Buka</h2>
              <p className="text-[11px] text-orange-300">Hot Meals, Snacks & Cold Drinks</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Reminder & Alert */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Your Wallet Balance:</span>
          <span className="font-extrabold text-emerald-400 font-mono">
            ₦{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Menu Grid */}
        <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
          {(worldData.foodMenu as FoodItem[]).map((item) => {
            const canAfford = balance >= item.price;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-orange-500/50 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      ₦{item.price.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleBuy(item)}
                  disabled={!canAfford || purchasingId === item.id}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-['Outfit'] flex items-center gap-1.5 transition transform active:scale-95 ${
                    canAfford
                      ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  {purchasingId === item.id ? 'Buying...' : canAfford ? 'Buy' : 'No Funds'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
