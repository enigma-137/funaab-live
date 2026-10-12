import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { networkManager } from '../multiplayer/networkManager';
import { X, Play, Trophy, Shield, ArrowLeft, ArrowUp, ArrowRight } from 'lucide-react';

export const PSPenaltyGame: React.FC = () => {
  const { user } = useAuthStore();
  const { activeMatches, currentMatch, psViewState, setActiveModal, setCurrentMatch } = useGameStore();
  const [selectedDirection, setSelectedDirection] = useState<'left' | 'center' | 'right' | null>(null);
  const connectionId = useGameStore((state) => state.myConnectionId);

  const availableMatches = Object.values(activeMatches).filter(
    (m) =>
      m.status === 'waiting' &&
      m.hostId !== user?.id &&
      m.hostId !== connectionId &&
      m.hostConnectionId !== connectionId
  );

  const myActiveMatch =
    currentMatch ||
    Object.values(activeMatches).find(
      (m) =>
        (m.hostId === user?.id ||
          m.guestId === user?.id ||
          m.hostId === connectionId ||
          m.guestId === connectionId ||
          m.hostConnectionId === connectionId ||
          m.guestConnectionId === connectionId) &&
        m.status !== 'finished'
    );

  useEffect(() => {
    if (myActiveMatch?.status === 'finished') {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  }, [myActiveMatch?.id, myActiveMatch?.status]);

  const handleCreate = () => {
    networkManager.createPSChallenge('ps5-station-1');
  };

  const handleJoin = (matchId: string) => {
    networkManager.joinPSChallenge(matchId);
  };

  const handleChoice = (dir: 'left' | 'center' | 'right') => {
    if (!myActiveMatch) return;
    setSelectedDirection(dir);
    networkManager.sendPSAction(myActiveMatch.id, dir);
  };

  const isHost =
    myActiveMatch?.hostId === user?.id ||
    myActiveMatch?.hostId === connectionId ||
    myActiveMatch?.hostConnectionId === connectionId;
  const isGuest =
    myActiveMatch?.guestId === user?.id ||
    myActiveMatch?.guestId === connectionId ||
    myActiveMatch?.guestConnectionId === connectionId;
  const isShooter = myActiveMatch
    ? (myActiveMatch.currentRound % 2 === 1 && isHost) || (myActiveMatch.currentRound % 2 === 0 && isGuest)
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-indigo-500/40 rounded-2xl shadow-2xl overflow-hidden font-['Plus_Jakarta_Sans']">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
              PS
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-['Outfit']">FUNAAB Game Den: 1v1 Showdown</h2>
              <p className="text-xs text-indigo-300">No wagers · Campus: winner ₦120 / loser ₦40 · Ties go to sudden death · 2-minute cooldown, 6 rewarded matches per day · Home games: social only</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {psViewState === 'lobby' || !myActiveMatch ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-center">
                <div className="text-3xl mb-2">⚽ 🎮</div>
                <h3 className="font-bold text-white text-base font-['Outfit']">Start or Join a 2-Player Match</h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
                  Take turns shooting penalties and goalkeeping against another student online!
                </p>
              </div>

              {availableMatches.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Open Challenges ({availableMatches.length})
                  </div>
                  {availableMatches.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-indigo-500 transition"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                          {m.hostName[0]}
                        </div>
                        <span className="text-sm font-semibold text-white">@{m.hostName}</span>
                      </div>
                      <button
                        onClick={() => handleJoin(m.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition"
                      >
                        <Play className="w-3.5 h-3.5" /> Join Match
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-slate-400">
                  No one is currently waiting for a challenger.
                </div>
              )}

              <button
                onClick={handleCreate}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition transform active:scale-95"
              >
                Create New Challenge
              </button>
            </div>
          ) : psViewState === 'waiting' ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto" />
              <div className="font-bold text-white text-base">Waiting for Challenger...</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Your challenge is open in the Game Den. Another player can join it from the challenge list.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Scoreboard */}
              <div className="grid grid-cols-3 items-center p-4 rounded-xl bg-slate-800/90 border border-slate-700 text-center">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-400">@{myActiveMatch.hostName}</div>
                  <div className="text-3xl font-extrabold text-indigo-400 font-['Outfit']">
                    {myActiveMatch.hostScore}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Round {myActiveMatch.currentRound} / {myActiveMatch.totalRounds}
                  </div>
                  <div className="text-xs font-extrabold text-amber-400 mt-1">
                    {myActiveMatch.status === 'finished' ? 'GAME OVER' : isShooter ? '⚡ YOUR TURN TO SHOOT' : '🛡️ YOUR TURN TO DIVE'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-400">@{myActiveMatch.guestName || 'Player 2'}</div>
                  <div className="text-3xl font-extrabold text-blue-400 font-['Outfit']">
                    {myActiveMatch.guestScore}
                  </div>
                </div>
              </div>

              {/* Round Result Toast */}
              {myActiveMatch.roundResult && (
                <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-center text-xs font-semibold text-indigo-200 animate-pulse">
                  {myActiveMatch.roundResult}
                </div>
              )}

              {/* Match Completed Banner */}
              {myActiveMatch.status === 'finished' ? (
                <div className="text-center py-4 space-y-3">
                  <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
                  <div className="text-xl font-black text-white font-['Outfit']">
                    🎉 Winner: {myActiveMatch.winnerName}!
                  </div>
                  <button
                    onClick={() => {
                      setCurrentMatch(null);
                      setActiveModal(null);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
                  >
                    Return to Campus
                  </button>
                </div>
              ) : (
                /* Choice Action Buttons */
                <div className="space-y-3">
                  <div className="text-center text-xs font-medium text-slate-300">
                    {isShooter ? 'Pick where to place your shot:' : 'Pick where to dive:'}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleChoice('left')}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition ${
                        selectedDirection === 'left'
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-200'
                      }`}
                    >
                      <ArrowLeft className="w-6 h-6 mb-1" />
                      <span className="font-bold text-xs">LEFT</span>
                    </button>

                    <button
                      onClick={() => handleChoice('center')}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition ${
                        selectedDirection === 'center'
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-200'
                      }`}
                    >
                      <ArrowUp className="w-6 h-6 mb-1" />
                      <span className="font-bold text-xs">CENTER</span>
                    </button>

                    <button
                      onClick={() => handleChoice('right')}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition ${
                        selectedDirection === 'right'
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-200'
                      }`}
                    >
                      <ArrowRight className="w-6 h-6 mb-1" />
                      <span className="font-bold text-xs">RIGHT</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
