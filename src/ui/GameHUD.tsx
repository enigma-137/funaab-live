import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useWalletStore } from '../stores/walletStore';
import { useSocialStore } from '../stores/socialStore';
import { networkManager } from '../game/multiplayer/networkManager';
import {
  Users,
  Backpack,
  HelpCircle,
  LogOut,
  Send,
  MessageSquare,
  Landmark,
  Wifi,
  WifiOff,
  Radio,
} from 'lucide-react';

export const GameHUD: React.FC = () => {
  const { user, logout } = useAuthStore();
  const {
    onlineCount,
    nearbyInteractable,
    selectedPlayer,
    isRidingKeke,
    currentKekeId,
    kekes,
    setActiveModal,
    setRidingKeke,
    connectionStatus,
  } = useGameStore();

  const { balance, deductFare } = useWalletStore();
  const { messages, addFriend } = useSocialStore();

  const [chatInput, setChatInput] = useState('');
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    networkManager.sendChat(chatInput.trim());
    setChatInput('');
  };

  const handleInteractButton = async () => {
    if (isRidingKeke && currentKekeId) {
      networkManager.exitKeke(currentKekeId);
      setRidingKeke(false, null);
      return;
    }

    if (nearbyInteractable) {
      switch (nearbyInteractable.type) {
        case 'atm':
          setActiveModal('bank');
          break;
        case 'food':
          setActiveModal('food');
          break;
        case 'playstation':
          setActiveModal('ps_match');
          break;
        case 'keke_stop': {
          const activeKeke = Object.values(kekes)[0];
          if (activeKeke) {
            const ok = await deductFare(user?.id || 'guest', 50, activeKeke.currentStopName || 'Next Stop');
            if (ok) {
              networkManager.enterKeke(activeKeke.id);
              setRidingKeke(true, activeKeke.id);
            }
          }
          break;
        }
      }
    } else if (selectedPlayer) {
      setActiveModal('player_profile');
    }
  };

  if (!user) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-4 sm:p-6 font-['Plus_Jakarta_Sans'] select-none">
      {/* 1. TOP BAR */}
      <div className="flex items-start justify-between w-full">
        {/* Top Left: Profile & Wallet Pill */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Student ID Badge */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-xl">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md"
              style={{ backgroundColor: user.avatarConfig.shirtColor || '#15803d' }}
            >
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight font-['Outfit'] flex items-center gap-1.5">
                <span>@{user.username}</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  {user.college}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span>{connectionStatus === 'connected' ? 'Live on Campus' : 'Connecting...'}</span>
              </div>
            </div>
          </div>

          {/* Quick ATM / Wallet Badge */}
          <button
            onClick={() => setActiveModal('bank')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/85 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 shadow-xl text-xs transition transform active:scale-95 group"
            title="Open ATM & Bank"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs group-hover:scale-110 transition">
              ₦
            </div>
            <div className="text-left">
              <div className="text-[9px] text-slate-400 font-semibold uppercase">Wallet</div>
              <div className="font-extrabold text-emerald-300 font-mono text-xs">
                ₦{balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
            </div>
          </button>
        </div>

        {/* Top Right: Actions & Stats */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Online Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-800 text-xs text-slate-300 shadow-lg">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="font-bold text-white">{onlineCount}</span>
            <span className="text-slate-400 text-[11px]">Online</span>
          </div>

          {/* Friends Modal Button */}
          <button
            onClick={() => setActiveModal('friends')}
            className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Friends List"
          >
            <Users className="w-4 h-4" />
          </button>

          {/* Inventory Modal Button */}
          <button
            onClick={() => setActiveModal('inventory')}
            className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Backpack Inventory"
          >
            <Backpack className="w-4 h-4" />
          </button>

          {/* Help Modal Button */}
          <button
            onClick={() => setActiveModal('help')}
            className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Controls & Campus Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-red-950/60 text-slate-400 hover:text-red-400 backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Leave Campus"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. CENTER CONTEXT INTERACTION PROMPT */}
      <div className="flex flex-col items-center justify-center my-auto">
        {(nearbyInteractable || selectedPlayer || isRidingKeke) && (
          <div className="pointer-events-auto animate-bounce duration-1000">
            <button
              onClick={handleInteractButton}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-950/90 hover:bg-slate-900 text-white border-2 border-emerald-400 shadow-2xl backdrop-blur-xl transition transform active:scale-95"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-black font-extrabold flex items-center justify-center font-mono text-sm shadow-md">
                E
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase font-extrabold text-emerald-400 tracking-wider">
                  {isRidingKeke
                    ? 'Riding Keke'
                    : nearbyInteractable?.label || 'Nearby Student'}
                </div>
                <div className="text-sm font-bold text-white font-['Outfit']">
                  {isRidingKeke
                    ? 'Press E to Exit Keke'
                    : nearbyInteractable
                    ? nearbyInteractable.actionText
                    : `Talk / Profile: @${selectedPlayer?.username}`}
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 3. BOTTOM BAR: PROXIMITY CHAT */}
      <div className="w-full max-w-md pointer-events-auto">
        <div className="rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-2xl overflow-hidden">
          {/* Chat Header */}
          <div
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            className="flex items-center justify-between px-4 py-2 bg-slate-950/80 cursor-pointer border-b border-slate-800"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 font-['Outfit']">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Campus Proximity Chat</span>
            </div>
            <span className="text-[10px] text-slate-500">
              {isChatExpanded ? '▾ Hide' : '▴ Show'}
            </span>
          </div>

          {/* Chat Body */}
          {isChatExpanded && (
            <>
              <div className="p-3.5 space-y-2 max-h-44 overflow-y-auto text-xs">
                {messages.map((msg) => (
                  <div key={msg.id} className="leading-snug break-words">
                    {msg.isSystem ? (
                      <div className="text-[11px] text-emerald-300/90 italic bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-500/20">
                        📢 {msg.text}
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5">
                        <span className="font-extrabold text-slate-100 shrink-0">
                          @{msg.senderName}
                          <span className="text-[9px] font-bold text-emerald-400 ml-1">
                            [{msg.college}]
                          </span>
                          :
                        </span>
                        <span className="text-slate-200">{msg.text}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="flex border-t border-slate-800 p-2 gap-2 bg-slate-950/90">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Say something to nearby students..."
                  maxLength={250}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
