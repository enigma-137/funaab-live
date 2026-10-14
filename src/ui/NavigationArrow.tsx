import React from 'react';
import { Navigation2 } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useInputStore } from '../stores/inputStore';
import { bearingTo, compassPoint, screenTurn, turnHint } from '../game/world/navigationMath';

const STEP = Math.PI / 36; // 5°: the arrow only re-renders when it would visibly move

/** Arrow that points where to walk, relative to the current camera view. */
export const NavigationArrow: React.FC = () => {
  const cameraYaw = useInputStore((s) => s.cameraYaw);
  const step = useGameStore((s) => {
    const d = s.navigationDestination;
    return d ? Math.round(screenTurn(s.myPosition, d.position, cameraYaw) / STEP) : 0;
  });
  const point = useGameStore((s) => (s.navigationDestination ? compassPoint(bearingTo(s.myPosition, s.navigationDestination.position)) : ''));
  const turn = step * STEP;
  return (
    <div className="flex items-center gap-1.5 shrink-0" role="img" aria-label={`${turnHint(turn)}, heading ${point}`}>
      <span className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/70 flex items-center justify-center">
        <Navigation2
          className="w-5 h-5 text-emerald-300 fill-emerald-400 transition-transform duration-150"
          style={{ transform: `rotate(${(turn * 180) / Math.PI}deg)` }}
        />
      </span>
      <span className="leading-tight">
        <span className="block text-[10px] font-black text-white whitespace-nowrap">{turnHint(turn)}</span>
        <span className="block text-[9px] font-bold text-emerald-300/80">Heading {point}</span>
      </span>
    </div>
  );
};
