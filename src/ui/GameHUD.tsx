import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useWalletStore } from '../stores/walletStore';
import { useSocialStore } from '../stores/socialStore';
import { useJobStore } from '../stores/jobStore';
import { useInputStore } from '../stores/inputStore';
import { networkManager } from '../game/multiplayer/networkManager';
import {
  Users,
  Backpack,
  HelpCircle,
  LogOut,
  Send,
  MessageSquare,
  Briefcase,
  Gift,
  Radio,
  MapPin,
  CheckCircle2,
  XCircle,
  GraduationCap,

  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { getActiveLectureForTime, getNextLecture } from '../config/lectureSchedule';
import worldData from '../worlds/funaab/world.json';

export const GameHUD: React.FC = () => {
  const { user, logout } = useAuthStore();
  const {
    onlineCount,
    nearbyInteractable,
    selectedPlayer,
    isRidingKeke,
    currentKekeId,
    targetKekeDestinationId,
    isOnRestrictedLawn,
    currentTerrainType,
    kekes,
    setActiveModal,
    setSelectedHallLocationId,
    setRidingKeke,
    connectionStatus,
    playerRef,
    activeModal,
  } = useGameStore();

  const { balance } = useWalletStore();
  const { messages } = useSocialStore();
  const { activeJob, error: jobError, busy: jobBusy, cancelJob, pickupDeliveryPackage, completeActiveJob, checkJobProximity } = useJobStore();
  const { isTouchDevice, triggerHaptic, setIsInputFocused } = useInputStore();

  const [chatInput, setChatInput] = useState('');
  const [isChatExpanded, setIsChatExpanded] = useState(!isTouchDevice);
  const [jobNotice, setJobNotice] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const activeKeke = Object.values(kekes)[0];
  const destinationName = targetKekeDestinationId
    ? worldData.kekeDestinations.find((destination) => destination.id === targetKekeDestinationId)?.name
    : undefined;

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
    triggerHaptic(25);

    if (isRidingKeke && currentKekeId) {
      networkManager.exitKeke(currentKekeId);
      setRidingKeke(false, null, null);
      return;
    }

    if (nearbyInteractable) {
      switch (nearbyInteractable.type) {
        case 'atm':
          setActiveModal('bank');
          break;
        case 'food':
        case 'restaurant_dining':
          setActiveModal('floral_world');
          break;
        case 'lecture_hall':
          setSelectedHallLocationId(nearbyInteractable.targetId || nearbyInteractable.id || 'colfhec-lecture-hall');
          setActiveModal('lecture_hall');
          break;
        case 'playstation':
          setActiveModal('ps_match');
          break;
        case 'keke_stop':
          setActiveModal('keke_destination');
          break;
        case 'job_board':
          setActiveModal('campus_jobs');
          break;
      }
    } else if (selectedPlayer) {
      setActiveModal('player_profile');
    }
  };

  const handlePickup = async () => {
    triggerHaptic(20);
    if (!(await pickupDeliveryPackage())) return;
    setJobNotice('📦 Package/Document picked up! Head to destination.');
    setTimeout(() => setJobNotice(null), 3500);
  };

  const handleDeliver = async () => {
    if (!user) return;
    triggerHaptic(30);
    const res = await completeActiveJob(user.id);
    if (res.success) {
      setJobNotice(`🎉 Job Complete! +₦${res.reward.toLocaleString()}`);
      setTimeout(() => setJobNotice(null), 4000);
    }
  };

  if (!user) return null;

  const playerPos = useGameStore.getState().myPosition;
  const jobProx = checkJobProximity(playerPos);

  const getInteractIcon = () => {
    if (isRidingKeke) return '🛺';
    if (!nearbyInteractable) return '💬';
    switch (nearbyInteractable.type) {
      case 'keke_stop':
        return '🛺';
      case 'lecture_hall':
        return '🎓';
      case 'food':
      case 'restaurant_dining':
        return '🍲';
      case 'atm':
        return '🏧';
      case 'job_board':
        return '💼';
      case 'playstation':
        return '🎮';
      default:
        return '✨';
    }
  };

  const getInteractLabel = () => {
    if (isRidingKeke) return 'Exit Campus Keke';
    if (nearbyInteractable) {
      switch (nearbyInteractable.type) {
        case 'keke_stop':
          return 'Enter Keke (from ₦50)';
        case 'lecture_hall':
          return 'View Lecture Schedule';
        case 'food':
        case 'restaurant_dining':
          return 'Order Food & Drinks';
        case 'atm':
          return 'Open ATM & Transfer';
        case 'job_board':
          return 'View Campus Jobs';
        case 'playstation':
          return '1v1 PS5 Challenge';
        default:
          return nearbyInteractable.actionText || 'Interact';
      }
    }
    if (selectedPlayer) {
      return `Talk with @${selectedPlayer.username}`;
    }
    return 'Interact';
  };

  const getTouchInteractLabel = () => {
    if (isRidingKeke) return 'Exit Keke';
    switch (nearbyInteractable?.type) {
      case 'keke_stop':
        return 'Keke';
      case 'lecture_hall':
        return 'Class';
      case 'food':
      case 'restaurant_dining':
        return 'Food';
      case 'atm':
        return 'Bank';
      case 'job_board':
        return 'Jobs';
      case 'playstation':
        return 'Play';
      default:
        return selectedPlayer ? 'Talk' : 'Interact';
    }
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 sm:p-6 font-['Plus_Jakarta_Sans'] select-none"
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* 1. TOP BAR */}
      <div className="flex items-start justify-between w-full gap-2">
        {/* Top Left: Profile & Wallet Pill & Job Shortcut */}
        <div className="flex items-center gap-1.5 sm:gap-3 pointer-events-auto flex-wrap">
          {/* Student ID Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-xl">
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0"
              style={{ backgroundColor: user.avatarConfig.shirtColor || '#15803d' }}
            >
              {user.username[0].toUpperCase()}
            </div>
            <div>
              <div className="text-[11px] sm:text-xs font-bold text-white leading-tight font-['Outfit'] flex items-center gap-1.5">
                <span>@{user.username}</span>
                <span className="text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  {user.college}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                />
                <span className="hidden sm:inline">{connectionStatus === 'connected' ? 'Live on Campus' : 'Connecting...'}</span>
              </div>
            </div>
          </div>

          {/* Quick ATM / Wallet Badge */}
          <button
            onClick={() => setActiveModal('bank')}
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 shadow-xl text-xs transition transform active:scale-95 group"
            title="Open ATM & Bank"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs group-hover:scale-110 transition">
              ₦
            </div>
            <div className="text-left">
              <div className="text-[8px] sm:text-[9px] text-slate-400 font-semibold uppercase">Wallet</div>
              <div className="font-extrabold text-emerald-300 font-mono text-[11px] sm:text-xs">
                ₦{balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
            </div>
          </button>

          {/* Campus Jobs Board Quick Button */}
          <button
            onClick={() => setActiveModal('campus_jobs')}
            className="hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-slate-900/90 hover:bg-indigo-950/80 hover:border-indigo-500/50 backdrop-blur-md border border-slate-700/60 shadow-xl text-xs transition group"
            title="Campus Jobs Board"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <div className="text-left hidden md:block">
              <div className="text-[9px] text-slate-400 font-semibold uppercase">Earn ₦</div>
              <div className="font-bold text-indigo-300 text-xs">Jobs Board</div>
            </div>
          </button>

          {/* Daily Reward Quick Button */}
          <button
            onClick={() => setActiveModal('daily_reward')}
            className="hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-slate-900/90 hover:bg-amber-950/80 hover:border-amber-500/50 backdrop-blur-md border border-slate-700/60 shadow-xl text-xs transition group"
            title="Claim Daily Allowance"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-600/30 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
              <Gift className="w-3.5 h-3.5" />
            </div>
            <div className="text-left hidden md:block">
              <div className="text-[9px] text-slate-400 font-semibold uppercase">Daily</div>
              <div className="font-bold text-amber-300 text-xs">+₦200</div>
            </div>
          </button>

          {/* Lecture Halls & Timetable Quick Button */}
          {(() => {
            const info = getActiveLectureForTime(Date.now());
            const liveLecture = info.activeLecture;
            const nextLec = info.nextLecture || getNextLecture(Date.now());
            return (
              <button
                id="btn-hud-lecture-timetable"
                onClick={() => setActiveModal('lecture_hall')}
                className={`hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-slate-900/90 hover:bg-emerald-950/80 hover:border-emerald-500/50 backdrop-blur-md border ${liveLecture ? 'border-emerald-400' : 'border-slate-700/60'
                  } shadow-xl text-xs transition group`}
                title={liveLecture ? `Live Class: ${liveLecture.courseCode}` : 'Lecture Timetable'}
              >
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg ${liveLecture ? 'bg-emerald-500/30 border border-emerald-400/60 text-emerald-300' : 'bg-slate-700/40 text-slate-300'} flex items-center justify-center group-hover:scale-110 transition`}>
                  <GraduationCap className="w-3.5 h-3.5" />
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-[9px] text-slate-400 font-semibold uppercase">
                    {liveLecture ? '● Live Class' : 'Timetable'}
                  </div>
                  <div className="font-bold text-emerald-300 text-xs">
                    {liveLecture ? liveLecture.courseCode : nextLec?.courseCode || 'Lectures'}
                  </div>
                </div>
              </button>
            );
          })()}
        </div>

        {/* Top Center: Keke Transit Active Indicator */}
        {/* Top Right: Actions & Stats */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          {/* Online Counter */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-xs text-slate-300 shadow-lg">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="font-bold text-white">{onlineCount}</span>
            <span className="text-slate-400 text-[11px]">Online</span>
          </div>

          {/* Direct Messages (DMs) Modal Button with Red Unread Badge */}
          <button
            id="btn-hud-dms"
            onClick={() => {
              const { directMessages, openDm, activeDmPartner, friends } = useSocialStore.getState();
              const partners = Object.keys(directMessages);
              if (activeDmPartner) {
                setActiveModal('private_chat');
              } else if (partners.length > 0) {
                const latestPartner = partners[0];
                openDm({
                  id: latestPartner,
                  username: latestPartner,
                  college: 'STUDENT',
                });
              } else if (friends.length > 0) {
                openDm({
                  id: friends[0].id,
                  username: friends[0].username,
                  college: friends[0].college,
                });
              } else {
                setActiveModal('friends');
              }
            }}
            className="relative p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Direct Messages (DMs)"
          >
            <MessageSquare className="w-4 h-4" />
            {useSocialStore.getState().unreadDmCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white font-extrabold text-[10px] flex items-center justify-center border-2 border-slate-950 animate-pulse shadow-md">
                {useSocialStore.getState().unreadDmCount}
              </span>
            )}
          </button>

          {/* Friends Modal Button */}
          <button
            onClick={() => setActiveModal('friends')}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Friends List"
          >
            <Users className="w-4 h-4" />
          </button>

          {/* Inventory Modal Button */}
          <button
            onClick={() => setActiveModal('inventory')}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Backpack Inventory"
          >
            <Backpack className="w-4 h-4" />
          </button>

          {/* Help Modal Button */}
          <button
            onClick={() => setActiveModal('help')}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Controls & Campus Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-red-950/60 text-slate-400 hover:text-red-400 backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Leave Campus"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ACTIVE JOB BANNER & NOTICES */}
      {jobError && <div role="alert" className="hostel-notice">{jobError}</div>}
      {activeJob && (
        <div className="mx-auto my-1 pointer-events-auto max-w-md w-full animate-in slide-in-from-top-4">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/90 border-2 border-indigo-500/60 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">{activeJob.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs font-black text-white font-['Outfit']">{activeJob.title}</span>
                  <span className="text-[10px] font-bold text-emerald-400 font-mono">+₦{activeJob.reward}</span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                  {activeJob.status === 'accepted' ? (
                    <span className="truncate">Pick up: <strong className="text-white">{activeJob.source}</strong> ({jobProx.distance}m)</span>
                  ) : (
                    <span className="truncate">Deliver: <strong className="text-white">{activeJob.destination}</strong> ({jobProx.distance}m)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {jobProx.canPickup && (
                <button
                  disabled={jobBusy} onClick={handlePickup}
                  className="px-2.5 py-1.5 sm:px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg animate-pulse flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pick Up
                </button>
              )}
              {jobProx.canDeliver && (
                <button
                  disabled={jobBusy} onClick={handleDeliver}
                  className="px-2.5 py-1.5 sm:px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg animate-pulse flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Deliver (+₦{activeJob.reward})
                </button>
              )}
              <button
                onClick={cancelJob}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 text-xs"
                title="Cancel Job"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {isRidingKeke && (
        <div className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+72px)] z-40 w-[min(220px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-amber-400/70 bg-amber-950/90 px-3 py-2 text-amber-100 shadow-xl backdrop-blur-md sm:left-auto sm:right-4 sm:top-24 sm:translate-x-0">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🛺</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black leading-tight text-white">Campus Keke</div>
              <div className="truncate text-xs leading-tight text-amber-200">
                To: {destinationName || 'Campus route'}
              </div>
              <div className="truncate text-[11px] leading-tight text-amber-300">
                Next: {activeKeke?.currentStopName || 'Campus stop'}
                {activeKeke?.passengers?.length ? ` · ${activeKeke.passengers.length} aboard` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {jobNotice && (
        <div className="mx-auto my-1 pointer-events-auto max-w-sm w-full animate-bounce">
          <div className="p-2.5 rounded-2xl bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-bold text-center shadow-2xl backdrop-blur-md">
            {jobNotice}
          </div>
        </div>
      )}

      {/* 2. CONTEXTUAL ACTION BAR (DESKTOP [E] & MOBILE TOUCH PILL) */}
      <div
        className={isTouchDevice
          ? 'pointer-events-none fixed right-4 z-[60]'
          : 'pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 z-30 w-full max-w-[100vw] px-3 sm:px-4'}
        style={isTouchDevice ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)' } : undefined}
      >
        {!activeModal && (nearbyInteractable || selectedPlayer || isRidingKeke) && (
          <div className="pointer-events-auto flex justify-center">
            <button
              onClick={handleInteractButton}
              aria-label={isTouchDevice ? getTouchInteractLabel() : getInteractLabel()}
              title={isTouchDevice ? getTouchInteractLabel() : getInteractLabel()}
              className={isTouchDevice
                ? 'flex min-h-[52px] max-w-[260px] items-center gap-2 rounded-2xl border border-emerald-400/80 bg-slate-950/95 px-3 py-2 text-white shadow-xl backdrop-blur-xl transition active:scale-95 max-[430px]:max-w-[160px] max-[360px]:min-h-12 max-[360px]:w-12 max-[360px]:justify-center max-[360px]:px-1'
                : 'flex min-h-[50px] items-center gap-3 rounded-3xl border-2 border-emerald-400 bg-slate-950/95 px-5 py-3 text-white shadow-2xl backdrop-blur-2xl transition transform active:scale-95 sm:px-6 sm:py-3.5'}
            >
              {isTouchDevice ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-sm text-white shadow-lg sm:h-9 sm:w-9">
                  {getInteractIcon()}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-black font-extrabold flex items-center justify-center font-mono text-sm shadow-md shrink-0">
                  E
                </div>
              )}
              <div className="min-w-0 flex-1 text-left max-[360px]:hidden">
                {!isTouchDevice && (
                  <div className="truncate text-[9px] font-black uppercase tracking-wider text-emerald-400 sm:text-[10px]">
                  {isRidingKeke
                    ? 'In Transit'
                    : nearbyInteractable?.label || 'Student Interaction'}
                  </div>
                )}
                <div className="truncate font-['Outfit'] text-xs font-extrabold text-white sm:text-sm">
                  {isTouchDevice ? getTouchInteractLabel() : getInteractLabel()}
                </div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 3. BOTTOM BAR: PROXIMITY CHAT & LAWN STATUS */}
      <div className="flex items-end justify-between w-full gap-2 sm:gap-4 pointer-events-none">
        {/* Proximity Chat Window (Responsive & Touch-Friendly) */}
        <div className="w-full max-w-md pointer-events-auto">
          {/* If on mobile and collapsed, show sleek floating chat toggle */}
          {isTouchDevice && !isChatExpanded ? (
            <button
              onClick={() => setIsChatExpanded(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/60 shadow-2xl backdrop-blur-md transition active:scale-95"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold font-['Outfit']">Chat ({messages.length})</span>
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            </button>
          ) : (
            <div className="rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              {/* Chat Header */}
              <div
                onClick={() => setIsChatExpanded(!isChatExpanded)}
                className="flex items-center justify-between px-3.5 py-2 bg-slate-950/90 cursor-pointer border-b border-slate-800"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200 font-['Outfit']">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Campus Proximity Chat</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span>{isChatExpanded ? '▾ Minimize' : '▴ Expand'}</span>
                </div>
              </div>

              {/* Chat Body */}
              {isChatExpanded && (
                <>
                  <div className="p-3 space-y-1.5 max-h-36 sm:max-h-44 overflow-y-auto text-xs">
                    {messages.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic text-center py-2">
                        No messages yet. Say hello to nearby students!
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div key={msg.id} className="leading-snug break-words">
                          {msg.isSystem ? (
                            <div className="text-[10px] sm:text-[11px] text-emerald-300/90 italic bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-500/20">
                              📢 {msg.text}
                            </div>
                          ) : (
                            <div className="flex items-start gap-1.5">
                              <span className="font-extrabold text-slate-100 shrink-0">
                                @{msg.senderName}
                                <span className="text-[8px] sm:text-[9px] font-bold text-emerald-400 ml-1">
                                  [{msg.college}]
                                </span>
                                :
                              </span>
                              <span className="text-slate-200">{msg.text}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Chat Input with Touch Focus Isolation */}
                  <form onSubmit={handleSendChat} className="flex border-t border-slate-800 p-2 gap-2 bg-slate-950/95">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      placeholder="Say something to nearby students..."
                      maxLength={250}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom Right: Live Terrain & Lawn Rule Status Pill */}
        <div className="pointer-events-auto hidden sm:flex items-center gap-2">
          {isOnRestrictedLawn ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-red-950/90 border border-red-500/60 shadow-xl backdrop-blur-md animate-pulse">
              <span className="text-xs">⚠️</span>
              <div className="text-[10px]">
                <span className="font-extrabold text-red-300 uppercase">Restricted Lawn</span>
                <span className="text-red-400 text-[9px] ml-1.5">(Risk ₦500 Fine)</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/80 border border-slate-700/50 shadow-lg backdrop-blur-md text-[10px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Zone: <strong className="text-white capitalize">{currentTerrainType}</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
