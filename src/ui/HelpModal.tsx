import React from 'react';
import { Sheet } from './Sheet';
import { ECONOMY_CONFIG, formatNaira } from '../config/economy';
import { kekeDestinations } from '../config/kekeRoutes';
import { useGameStore } from '../stores/gameStore';
import { X, HelpCircle, Compass, Gamepad2, Users, Landmark } from 'lucide-react';

export const HelpModal: React.FC = () => {
  const { setActiveModal } = useGameStore();

  return (
    <Sheet title={'Campus Guide & Controls'} subtitle={'Everything you need to know in FUNAAB Life'} icon={<HelpCircle className="w-4 h-4" />} accent="#059669" onClose={() => setActiveModal(null)}>

        {/* Guide Content */}
        <div className="p-6 space-y-4 text-xs text-slate-300">
          <div>
            <h3 className="font-bold text-sm font-['Outfit'] mb-2 flex items-center gap-1.5 text-emerald-400">
              <Compass className="w-4 h-4" /> On a phone
            </h3>
            <ul className="space-y-1.5 mb-3">
              <li><strong className="text-white">Tap the ground</strong> to walk there · <strong className="text-white">drag</strong> to look around.</li>
              <li><strong className="text-white">Bottom-right button</strong> appears near things you can use (sit, buy, play, ride).</li>
              <li><strong className="text-white">Phone</strong> (top-right) has your wallet, jobs, map, messages and more.</li>
            </ul>
            <h3 className="font-bold text-sm font-['Outfit'] mb-2 flex items-center gap-1.5 text-emerald-400">
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
              <li><strong className="text-emerald-400">🌿 FUNAAB Lawn Rule:</strong> Walking across green lawns is strictly prohibited! Campus Security officers patrol the grounds and will fine violators <strong className="text-red-400">{formatNaira(ECONOMY_CONFIG.LAWN_FINE)}</strong>. Use paved footpaths and roads. (Sports Centre turf is legal).</li>
              <li><strong className="text-amber-400">🛺 Destination Keke Transit:</strong> Board yellow Keke Napeps at the Car Park or stops, choose your destination, and enjoy automatic road transit across campus (fares: {formatNaira(Math.min(...kekeDestinations.map((d) => d.fare)))} – {formatNaira(Math.max(...kekeDestinations.map((d) => d.fare)))}).</li>
              <li><strong className="text-white">Main Gate:</strong> The ceremonial resumption gate monument.</li>
              <li><strong className="text-white">COLFHEC & Senate:</strong> Academic lecture halls and central library.</li>
              <li><strong className="text-white">Microfinance ATM:</strong> View your balance & transfer money to other students.</li>
              <li><strong className="text-white">Mama Buka Canteen:</strong> Buy hot Jollof Rice, Suya, Shawarma, and cold drinks.</li>
              <li><strong className="text-white">PS Game Den:</strong> Play 1v1 multiplayer penalty shootout against other online students.</li>
              <li><strong className="text-white">Sports Centre:</strong> Walk to the penalty spot for practice shots or a 1v1 Penalty Challenge (3 shots each). Drag to aim, hold to power, release to shoot.</li>
              <li><strong className="text-white">Love Garden:</strong> A shady tree with benches east of the Library. Sit down, gist, relax.</li>
            </ul>
          </div>
        </div>
    </Sheet>
  );
};
