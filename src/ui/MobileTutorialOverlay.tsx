import React from 'react';
import { useInputStore } from '../stores/inputStore';
import { Footprints, Eye, Compass, Sparkles } from 'lucide-react';

export const MobileTutorialOverlay: React.FC = () => {
  const { isTouchDevice, mobileTutorialDismissed, setMobileTutorialDismissed, triggerHaptic } = useInputStore();

  if (!isTouchDevice || mobileTutorialDismissed) return null;

  const handleDismiss = () => {
    triggerHaptic(20);
    setMobileTutorialDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900/95 border-2 border-emerald-500/60 p-6 shadow-2xl backdrop-blur-xl text-white">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shadow-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black font-['Outfit'] text-white">
              FUNAAB Life Touch Controls
            </h3>
            <p className="text-xs text-slate-400">Lightweight mobile navigation</p>
          </div>
        </div>

        {/* 3 Guide Points */}
        <div className="space-y-3.5 mb-6">
          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Footprints className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-sky-300 uppercase tracking-wider">Tap to Walk</div>
              <div className="text-xs text-slate-300">Tap anywhere on the roads or paths to walk there directly.</div>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Drag to Look</div>
              <div className="text-xs text-slate-300">Swipe across the screen to rotate camera 360° around your student.</div>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Tap to Interact</div>
              <div className="text-xs text-slate-300">Tap other students, Keke, Floral World, or lecture doors to approach & interact.</div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleDismiss}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-xl transform active:scale-98 transition flex items-center justify-center gap-2"
        >
          Got It, Start Exploring!
        </button>
      </div>
    </div>
  );
};
