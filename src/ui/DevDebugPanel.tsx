import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { Activity, Box, Eye, EyeOff, Radio, Users, Shield } from 'lucide-react';

export const DevDebugPanel: React.FC = () => {
  const { user } = useAuthStore();
  const {
    isConnected,
    connectionStatus,
    ping,
    onlineCount,
    myConnectionId,
    myPosition,
    players,
    debugPhysics,
    debugNet,
    toggleDebugPhysics,
    toggleDebugNet,
  } = useGameStore();

  const debugHudEnabled =
    import.meta.env.DEV ||
    import.meta.env.VITE_ENABLE_DEBUG_HUD === 'true' ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === 'true');

  if (!debugHudEnabled) return null;

  if (!debugNet && !debugPhysics) {
    return (
      <div className="fixed bottom-4 right-4 z-40 pointer-events-auto flex items-center gap-2">
        <button
          onClick={toggleDebugNet}
          className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-[10px] font-mono font-bold text-slate-400 hover:text-emerald-400 border border-slate-700/60 shadow-lg backdrop-blur-md transition"
          title="Toggle Dev Diagnostics (F2 / P)"
        >
          ⚙ DEV HUD
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-40 w-72 pointer-events-auto rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-emerald-500/40 shadow-2xl p-3.5 font-mono text-[11px] text-slate-300 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 text-emerald-400 font-bold tracking-wider">
          <Activity className="w-4 h-4" />
          <span>FUNAAB DEV HUD</span>
        </div>
        <button
          onClick={() => {
            if (debugNet) toggleDebugNet();
            if (debugPhysics) toggleDebugPhysics();
          }}
          className="text-slate-500 hover:text-white text-xs px-1"
        >
          ✕
        </button>
      </div>

      {/* Network Stats */}
      <div className="space-y-1.5 mb-3">
        <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
          <span>NET STATUS</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[9px] ${
              isConnected ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-red-950 text-red-300'
            }`}
          >
            {connectionStatus.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-slate-900/80 p-2 rounded-xl border border-slate-800 text-[10px]">
          <div>
            <span className="text-slate-500">Room:</span> <span className="text-white">funaab:main</span>
          </div>
          <div>
            <span className="text-slate-500">Ping:</span>{' '}
            <span className={ping < 80 ? 'text-emerald-400' : 'text-amber-400'}>
              {ping > 0 ? `${ping}ms` : '–'}
            </span>
          </div>
          <div className="col-span-2 truncate">
            <span className="text-slate-500">My Conn:</span>{' '}
            <span className="text-emerald-300 text-[9px]">{myConnectionId || 'local'}</span>
          </div>
          <div className="col-span-2 truncate">
            <span className="text-slate-500">Pos:</span>{' '}
            <span className="text-slate-300">
              [{myPosition[0].toFixed(1)}, {myPosition[1].toFixed(1)}, {myPosition[2].toFixed(1)}]
            </span>
          </div>
        </div>
      </div>

      {/* Remote Peers */}
      <div className="space-y-1.5 mb-3">
        <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 text-emerald-400" />
            <span>Peers ({Object.keys(players).length})</span>
          </span>
          <span className="text-[9px] text-slate-500">Total: {onlineCount}</span>
        </div>

        <div className="max-h-24 overflow-y-auto space-y-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80">
          {Object.entries(players).length === 0 ? (
            <div className="text-slate-500 italic text-[10px] p-1">No other students in area</div>
          ) : (
            Object.entries(players).map(([connId, p]) => (
              <div key={connId} className="flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-800">
                <span className="font-bold text-white truncate max-w-[120px]">
                  @{p.username} <span className="text-emerald-400 font-normal">[{p.college}]</span>
                </span>
                <span className="text-[9px] text-slate-400 truncate max-w-[65px]">
                  [{p.position[0].toFixed(0)}, {p.position[2].toFixed(0)}]
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Toggles */}
      <div className="pt-2 border-t border-slate-800 space-y-1.5">
        <button
          onClick={toggleDebugPhysics}
          className={`w-full py-1.5 px-2.5 rounded-xl flex items-center justify-between text-xs transition border ${
            debugPhysics
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold">
            <Box className="w-3.5 h-3.5" />
            Physics Colliders (P / F3)
          </span>
          <span className="text-[10px] font-bold">{debugPhysics ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={toggleDebugNet}
          className={`w-full py-1.5 px-2.5 rounded-xl flex items-center justify-between text-xs transition border ${
            debugNet
              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold">
            <Radio className="w-3.5 h-3.5" />
            Net Panel (F2)
          </span>
          <span className="text-[10px] font-bold">{debugNet ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
};
