import React, { useEffect, useRef, useState } from 'react';
import { ECONOMY_CONFIG, formatNaira } from '../../config/economy';
import confetti from 'canvas-confetti';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { networkManager } from '../multiplayer/networkManager';
import { X, Play, ArrowLeft, ArrowUp, ArrowRight } from 'lucide-react';
import type { PSMatchState } from '../../types/game';
import { PS_KICKS_EACH, type PSDirection, type PSLastRound } from '../../config/psPenalty';
import { gameSound } from '../audio/gameAudio';

const GAME_DEN = ECONOMY_CONFIG.GAME_DEN;

export const PSPenaltyGame: React.FC = () => {
  const { user } = useAuthStore();
  const { activeMatches, currentMatch, psViewState, setActiveModal, setCurrentMatch } = useGameStore(useShallow((s) => ({ activeMatches: s.activeMatches, currentMatch: s.currentMatch, psViewState: s.psViewState, setActiveModal: s.setActiveModal, setCurrentMatch: s.setCurrentMatch })));
  const [selectedDirection, setSelectedDirection] = useState<PSDirection | null>(null);
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

  // A fresh kick needs a fresh pick.
  useEffect(() => setSelectedDirection(null), [myActiveMatch?.id, myActiveMatch?.currentRound]);

  const handleCreate = () => {
    networkManager.createPSChallenge('ps5-station-1');
  };

  const handleJoin = (matchId: string) => {
    networkManager.joinPSChallenge(matchId);
  };

  const handleChoice = (dir: PSDirection) => {
    if (!myActiveMatch || selectedDirection) return;
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
              <h2 className="text-lg font-bold text-white font-['Outfit']">Game Den · Penalties</h2>
              <p className="text-xs text-indigo-300">{PS_KICKS_EACH} kicks each · Win {formatNaira(GAME_DEN.WINNER)} · Draw {formatNaira(GAME_DEN.DRAW)} · Loss {formatNaira(GAME_DEN.LOSER)}</p>
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
                <p className="text-[11px] text-slate-400 mt-2 max-w-xs mx-auto">
                  No wagers. Campus rewards: {GAME_DEN.COOLDOWN_MINUTES}-minute cooldown, {GAME_DEN.DAILY_REWARDED_MATCHES} rewarded matches a day (max {GAME_DEN.SAME_OPPONENT_DAILY_MATCHES} vs the same opponent). Home games are just for fun.
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
                Walking away from the Game Den cancels it.
              </p>
              <button
                onClick={() => networkManager.leavePSMatch()}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
              >
                Cancel challenge
              </button>
            </div>
          ) : (
            <MatchView
              match={myActiveMatch}
              isHost={isHost}
              isShooter={isShooter}
              selectedDirection={selectedDirection}
              onChoice={handleChoice}
              onExit={() => {
                setCurrentMatch(null);
                setActiveModal(null);
              }}
              onLeave={() => networkManager.leavePSMatch()}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Older servers only describe the kick in text; recover it so the animation still plays.
function lastRoundOf(m: PSMatchState): PSLastRound | null {
  if (m.lastRound) return m.lastRound;
  if (!m.roundResult) return null;
  const round = m.status === 'finished' ? m.currentRound : m.currentRound - 1;
  if (round < 1) return null;
  const both = /Both (?:picked|chose) (left|center|right)/.exec(m.roundResult);
  const pair = /Shot: (left|center|right) \| Dive: (left|center|right)/.exec(m.roundResult);
  const shot = (both?.[1] ?? pair?.[1]) as PSDirection | undefined;
  const dive = (both?.[1] ?? pair?.[2]) as PSDirection | undefined;
  if (!shot || !dive) return null;
  return { round, shooter: round % 2 === 1 ? 'host' : 'guest', shot, dive, goal: shot !== dive };
}

// Pitch geometry (SVG units). "left" is the shooter's left, i.e. the left of the screen.
const SPOT = { x: 160, y: 182 };
const TARGET: Record<PSDirection, { x: number; y: number }> = {
  left: { x: 98, y: 70 }, center: { x: 160, y: 60 }, right: { x: 222, y: 70 },
};
const DIVE: Record<PSDirection, string> = {
  left: 'translate(-52px,-6px) rotate(-78deg)', center: 'translate(0px,-14px)', right: 'translate(52px,-6px) rotate(78deg)',
};
type Phase = 'idle' | 'shot' | 'rebound' | 'result';

function PenaltyPitch({ kick, phase, aim }: { kick: PSLastRound | null; phase: Phase; aim: PSDirection | null }) {
  const moving = phase !== 'idle' && kick;
  const t = kick ? TARGET[kick.shot] : SPOT;
  const saved = kick && !kick.goal;
  // Saved shots stop at the keeper's gloves and drop in front of the line.
  const ball = !moving ? { x: SPOT.x, y: SPOT.y, s: 1 }
    : phase === 'shot' || !saved ? { x: t.x, y: t.y + (kick!.goal ? 0 : 8), s: 0.5 }
      : { x: t.x + (kick!.shot === 'left' ? 18 : kick!.shot === 'right' ? -18 : 0), y: 132, s: 0.6 };
  const ease = 'cubic-bezier(.2,.7,.3,1)';
  return (
    <svg viewBox="0 0 320 200" className="w-full rounded-xl" role="img" aria-label="Penalty pitch">
      <defs>
        <pattern id="ps-net" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M7 0H0V7" fill="none" stroke="#e2e8f0" strokeOpacity=".35" strokeWidth=".6" />
        </pattern>
        <linearGradient id="ps-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f7d3a" /><stop offset="1" stopColor="#3f9a48" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="#0f172a" />
      <rect y="34" width="320" height="166" fill="url(#ps-grass)" />
      {[0, 1, 2, 3].map((i) => <rect key={i} y={110 + i * 24} width="320" height="12" fill="#ffffff" opacity=".05" />)}
      {/* Box lines */}
      <path d="M20 110 H300 M48 110 L28 158 H292 L272 110 M108 110 L102 126 H218 L212 110" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" />
      <circle cx={SPOT.x} cy={SPOT.y + 7} r="1.6" fill="#fff" opacity=".8" />
      {/* Goal: net, then posts */}
      <rect x="70" y="40" width="180" height="70" fill="url(#ps-net)" />
      <path d="M70 110 V40 H250 V110" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
      {aim && !moving && (
        <rect x={TARGET[aim].x - 26} y="44" width="52" height="62" rx="4" fill="#facc15" opacity=".22" stroke="#facc15" strokeOpacity=".7" />
      )}
      {/* Keeper */}
      <g style={{ transformBox: 'view-box', transformOrigin: '160px 110px', transform: moving ? DIVE[kick!.dive] : 'none', transition: `transform ${moving ? '.42s' : '.3s'} ${ease} ${moving ? '.06s' : '0s'}` }}>
        <ellipse cx="160" cy="111" rx="10" ry="2" fill="#000" opacity=".25" />
        <rect x="155" y="98" width="4" height="12" rx="1.5" fill="#111827" />
        <rect x="161" y="98" width="4" height="12" rx="1.5" fill="#111827" />
        <rect x="153" y="81" width="14" height="19" rx="4" fill="#facc15" />
        <path d="M154 85 L143 74 M166 85 L177 74" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
        <circle cx="143" cy="73" r="2.6" fill="#f8fafc" /><circle cx="177" cy="73" r="2.6" fill="#f8fafc" />
        <circle cx="160" cy="75" r="5.5" fill="#7a4a2b" />
      </g>
      {/* Ball and its shadow */}
      {!moving && <ellipse cx={SPOT.x} cy={SPOT.y + 7} rx="7" ry="2" fill="#000" opacity=".3" />}
      <g style={{ transformBox: 'view-box', transformOrigin: `${SPOT.x}px ${SPOT.y}px`,
        transform: `translate(${ball.x - SPOT.x}px,${ball.y - SPOT.y}px) scale(${ball.s})`,
        transition: `transform ${phase === 'shot' ? '.5s' : phase === 'rebound' ? '.4s' : '0s'} ${ease}` }}>
        <circle cx={SPOT.x} cy={SPOT.y} r="7" fill="#f8fafc" stroke="#0f172a" strokeWidth=".8" />
        <path d={`M${SPOT.x} ${SPOT.y - 2.6} l2.4 1.8 -0.9 2.8 h-3 l-0.9 -2.8 z`} fill="#0f172a" />
      </g>
    </svg>
  );
}

function KickDots({ kicks, side }: { kicks: Record<number, PSLastRound>; side: 'host' | 'guest' }) {
  const mine = Object.values(kicks).filter((k) => k.shooter === side).sort((a, b) => a.round - b.round);
  const slots = Math.max(PS_KICKS_EACH, mine.length);
  return (
    <div className="flex gap-1 justify-center mt-1">
      {Array.from({ length: slots }, (_, i) => mine[i]).map((k, i) => (
        <span key={i} className={`w-2.5 h-2.5 rounded-full ${!k ? 'bg-slate-600' : k.goal ? 'bg-emerald-400' : 'bg-rose-500'}`} />
      ))}
    </div>
  );
}

function MatchView({ match, isHost, isShooter, selectedDirection, onChoice, onExit, onLeave }: {
  match: PSMatchState; isHost: boolean; isShooter: boolean; selectedDirection: PSDirection | null;
  onChoice: (d: PSDirection) => void; onExit: () => void; onLeave: () => void;
}) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const kick = lastRoundOf(match);
  const [kicks, setKicks] = useState<Record<number, PSLastRound>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [shown, setShown] = useState<PSLastRound | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => { setKicks({}); }, [match.id]);
  useEffect(() => {
    if (!kick) return;
    setKicks((k) => (k[kick.round] ? k : { ...k, [kick.round]: kick }));
    // Replay each resolved kick once: shot, (rebound), result banner, back to the spot.
    timers.current.forEach(clearTimeout);
    setShown(kick);
    setPhase('idle');
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    timers.current = [];
    at(40, () => setPhase('shot'));
    if (!kick.goal) at(560, () => setPhase('rebound'));
    at(700, () => {
      setPhase('result');
      // Good for me: I scored, or I was in goal and saved it.
      const mine = kick.shooter === (isHost ? 'host' : 'guest');
      if (mine === kick.goal) gameSound.success(); else gameSound.soft();
    });
    at(2100, () => { setPhase('idle'); setShown(null); });
    return () => timers.current.forEach(clearTimeout);
  }, [match.id, kick?.round]);

  const animating = shown !== null;
  const finished = match.status === 'finished' && !animating;
  const myScore = isHost ? match.hostScore : match.guestScore;
  const theirScore = isHost ? match.guestScore : match.hostScore;
  const iWon = finished && !match.isDraw && myScore > theirScore;
  useEffect(() => {
    if (iWon) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, [iWon]);
  const kickNo = Math.ceil(match.currentRound / 2);

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/80 text-center">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-300">@{match.hostName}</div>
          <KickDots kicks={kicks} side="host" />
        </div>
        <div className="text-2xl font-black text-white font-['Outfit'] tabular-nums">{match.hostScore} – {match.guestScore}</div>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-300">@{match.guestName || 'Player 2'}</div>
          <KickDots kicks={kicks} side="guest" />
        </div>
      </div>

      <div className="relative">
        <PenaltyPitch kick={shown} phase={phase} aim={!animating && !finished ? selectedDirection : null} />
        {shown && phase === 'result' && (
          <div className="absolute inset-x-0 top-1/3 text-center pointer-events-none">
            <span className={`inline-block px-4 py-1.5 rounded-lg text-lg font-black tracking-wide font-['Outfit'] shadow-xl ${shown.goal ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900'}`}>
              {shown.goal ? 'GOAL!' : 'SAVED!'}
            </span>
          </div>
        )}
      </div>

      {finished ? (
        <div className="text-center space-y-3">
          <div className="text-xl font-black text-white font-['Outfit']">
            {match.isDraw ? "It's a draw" : match.winnerName ? `${match.winnerName} wins` : 'Match ended'}
          </div>
          <div className="text-xs text-slate-400">
            {match.forfeit ? `${match.roundResult ?? 'A player left.'} Forfeits pay no rewards.`
              : match.isDraw ? `${match.hostScore} – ${match.guestScore} after ${PS_KICKS_EACH} kicks each.` : iWon ? 'Nice finishing.' : 'Good game.'}
          </div>
          <button onClick={onExit} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition">
            Return to Campus
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="text-center text-xs font-semibold text-slate-300">
            {animating ? '\u00a0' : selectedDirection ? 'Waiting for your opponent…'
              : isShooter ? `Kick ${kickNo} · You shoot. Pick a side.` : `Kick ${kickNo} · You're in goal. Pick a dive.`}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {([['left', ArrowLeft, 'LEFT'], ['center', ArrowUp, 'CENTER'], ['right', ArrowRight, 'RIGHT']] as const).map(([dir, Icon, label]) => (
              <button
                key={dir}
                disabled={animating || !!selectedDirection}
                onClick={() => onChoice(dir)}
                className={`flex flex-col items-center justify-center py-3 rounded-xl border transition disabled:cursor-default ${
                  selectedDirection === dir ? 'bg-amber-400 border-amber-300 text-slate-900'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-500 disabled:opacity-50'}`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="font-bold text-[11px]">{label}</span>
              </button>
            ))}
          </div>
          <div className="pt-1 text-center">
            {confirmLeave ? (
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300">
                <span>Leave and give {isHost ? match.guestName : match.hostName} the win?</span>
                <button onClick={onLeave} className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 font-bold text-white">Leave</button>
                <button onClick={() => setConfirmLeave(false)} className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-white">Stay</button>
              </div>
            ) : (
              <button onClick={() => setConfirmLeave(true)} className="text-[11px] font-semibold text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">
                Leave match
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
