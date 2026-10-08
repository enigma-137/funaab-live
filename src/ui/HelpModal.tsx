import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { X, HelpCircle, Compass, Gamepad2, Users, Landmark } from 'lucide-react';

export const HelpModal: React.FC = () => {
  const { setActiveModal } = useGameStore();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-emerald-500/40 rounded-3xl shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans']">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-sm">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Outfit']">Campus Guide & Controls</h2>
              <p className="text-[11px] text-slate-400">Everything you need to know in FUNAAB Life</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guide Content */}
        <div className="p-6 space-y-4 max-h-96 overflow-y-auto text-xs text-slate-300">
          <div>
            <h3 className="font-bold text-white text-sm font-['Outfit'] mb-2 flex items-center gap-1.5 text-emerald-400">
              <Compass className="w-4 h-4" /> Keyboard Controls
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded mr-2">W A S D</span>
                <span>Walk Around</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded mr-2">SHIFT</span>
                <span>Sprint / Run Fast</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="font-mono font-bold text-emerald-400 bg-slate-800 px-1.5 py-0.5 rounded mr-2">E / ENTER</span>
                <span>Context Interact</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded mr-2">ENTER</span>
                <span>Send Chat Message</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-white text-sm font-['Outfit'] mb-2 flex items-center gap-1.5 text-amber-400">
              <Landmark className="w-4 h-4" /> Campus Rules & Hotspots
            </h3>
            <ul className="space-y-1.5 list-disc pl-4 text-slate-300">
              <li><strong className="text-emerald-400">🌿 FUNAAB Lawn Rule:</strong> Walking across green lawns is strictly prohibited! Campus Security officers patrol the grounds and will fine violators <strong className="text-red-400">₦500</strong>. Use paved footpaths and roads. (Sports Centre turf is legal).</li>
              <li><strong className="text-amber-400">🛺 Destination Keke Transit:</strong> Board yellow Keke Napeps at the Car Park or stops, choose your destination, and enjoy automatic road transit across campus (fares: ₦50 - ₦150).</li>
              <li><strong className="text-white">Main Gate:</strong> The ceremonial resumption gate monument.</li>
              <li><strong className="text-white">COLFHEC & Senate:</strong> Academic lecture halls and central library.</li>
              <li><strong className="text-white">Microfinance ATM:</strong> View your balance & transfer money to other students.</li>
              <li><strong className="text-white">Mama Buka Canteen:</strong> Buy hot Jollof Rice, Suya, Shawarma, and cold drinks.</li>
              <li><strong className="text-white">PS Game Den:</strong> Play 1v1 multiplayer penalty shootout against other online students.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
