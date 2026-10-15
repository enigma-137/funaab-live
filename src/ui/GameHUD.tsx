import {useHostelStore} from '../stores/hostelStore';
import { useCarStore } from '../stores/carStore';
import { usePartyStore } from '../stores/partyStore';
import type { ArcadeTableId } from '../config/partyHall';
import { useHustleStore } from '../stores/hustleStore';
import { FARM_STEPS } from '../config/fpyFarm';
import { ECONOMY_CONFIG, formatNaira } from '../config/economy';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
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
  Wallet,
  Plus,
  Compass,
  ChevronRight,
  Landmark,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { AvatarHeadPortrait } from './AvatarHeadPortrait';
import { getActiveLectureForTime, getNextLecture } from '../config/lectureSchedule';
import worldData from '../config/campusWorld';
import { FOOD_VENDORS, getVendorStatus, type FoodVendorId } from '../config/foodVendors';
import { openFoodVendor, vendorNow } from '../stores/foodVendorStore';
import { openFootball } from '../stores/footballStore';
import { openCourtGame } from '../stores/courtGameStore';
import { toast } from '../stores/toastStore';
import { NavigationArrow } from './NavigationArrow';
import { MiniMap } from './MiniMap';
import { locationById } from '../config/campusLocations';

const FLORAL = locationById('floral-world').position;
const atFloralTable = (p: [number, number, number]) => Math.hypot(p[0] - FLORAL[0], p[2] - FLORAL[2]) < 6;

export const GameHUD: React.FC = () => {
  const inRoom=useHostelStore(s=>!!s.owner || s.roomId === 'world:funaab:library');
  const { user, logout } = useAuthStore();
  const {
    onlineCount,
    nearbyInteractable,
    seatedAt,
    selectedPlayer,
    isRidingKeke,
    currentKekeId,
    targetKekeDestinationId,
    isOnRestrictedLawn,
    currentTerrainType,
    kekes,
    setActiveModal,
    sitAtPosition,
    standUp,
    setSelectedHallLocationId,
    setRidingKeke,
    connectionStatus,
    playerRef,
    activeModal,
    navigationDestination,
    clearNavigationDestination,
  } = useGameStore(
    useShallow((s) => ({
      onlineCount: s.onlineCount,
      nearbyInteractable: s.nearbyInteractable,
      seatedAt: s.seatedAt,
      selectedPlayer: s.selectedPlayer,
      isRidingKeke: s.isRidingKeke,
      currentKekeId: s.currentKekeId,
      targetKekeDestinationId: s.targetKekeDestinationId,
      isOnRestrictedLawn: s.isOnRestrictedLawn,
      currentTerrainType: s.currentTerrainType,
      kekes: s.kekes,
      setActiveModal: s.setActiveModal,
      sitAtPosition: s.sitAtPosition,
      standUp: s.standUp,
      setSelectedHallLocationId: s.setSelectedHallLocationId,
      setRidingKeke: s.setRidingKeke,
      connectionStatus: s.connectionStatus,
      playerRef: s.playerRef,
      activeModal: s.activeModal,
      navigationDestination: s.navigationDestination,
      clearNavigationDestination: s.clearNavigationDestination,
    }))
  );

  const { balance } = useWalletStore();
  // Classroom messages belong to the class chat only.
  const allMessages = useSocialStore((s) => s.messages);
  const messages = useMemo(() => allMessages.filter((m) => !m.lectureId), [allMessages]);
  const unreadDmCount = useSocialStore((s) => s.unreadDmCount);
  // Whole metres only, so walking re-renders the HUD at most once per metre.
  const waypointDistance = useGameStore((s) => s.navigationDestination
    ? Math.round(Math.hypot(s.myPosition[0] - s.navigationDestination.position[0], s.myPosition[2] - s.navigationDestination.position[2]))
    : 0);
  const { activeJob, error: jobError, busy: jobBusy, cancelJob, pickupDeliveryPackage, completeActiveJob, checkJobProximity } = useJobStore();
  const { isTouchDevice, triggerHaptic, setIsInputFocused } = useInputStore(
    useShallow((s) => ({ isTouchDevice: s.isTouchDevice, triggerHaptic: s.triggerHaptic, setIsInputFocused: s.setIsInputFocused }))
  );

  const [chatInput, setChatInput] = useState('');
  const [isChatExpanded, setIsChatExpanded] = useState(!isTouchDevice);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const activeKeke = currentKekeId ? kekes[currentKekeId] : undefined;
  // Food vendors open/close on the server clock; refresh the prompt while standing at a stall.
  const nearVendor = nearbyInteractable?.type === 'food_vendor' ? FOOD_VENDORS[nearbyInteractable.targetId as FoodVendorId] : undefined;
  const [, setVendorTick] = useState(0);
  useEffect(() => {
    if (!nearVendor) return;
    const timer = setInterval(() => setVendorTick((n) => n + 1), 5000);
    return () => clearInterval(timer);
  }, [nearVendor?.id]);
  const vendorStatus = nearVendor ? getVendorStatus(nearVendor.id, vendorNow()) : undefined;
  const destinationName = targetKekeDestinationId
    ? worldData.kekeDestinations.find((destination) => destination.id === targetKekeDestinationId)?.name
    : undefined;

  // Keep seat/interaction controls clear of the chat box so you can sit and talk. The height the
  // chat occupies above the bottom edge is also published as --hud-chat-clearance for other
  // overlays (e.g. the hostel's Sitting bar).
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [chatClearance, setChatClearance] = useState(0);
  const [narrowDesktop, setNarrowDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1200);
  useEffect(() => {
    const el = chatBoxRef.current;
    const measure = () => {
      setNarrowDesktop(window.innerWidth < 1200);
      const c = el ? Math.max(0, Math.round(window.innerHeight - el.getBoundingClientRect().top)) : 0;
      setChatClearance(c);
      document.documentElement.style.setProperty('--hud-chat-clearance', `${c}px`);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(measure) : null;
    if (observer && el) observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      document.documentElement.style.removeProperty('--hud-chat-clearance');
    };
  }, [isChatExpanded]);

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

    if (seatedAt) {
      standUp();
      return;
    }

    if (isRidingKeke && currentKekeId) {
      networkManager.exitKeke(currentKekeId);

      return;
    }

    if (nearbyInteractable?.type === 'car') {
      if (nearbyInteractable.targetId === 'drive') useCarStore.getState().enter();
      else if (nearbyInteractable.targetId === 'park') window.dispatchEvent(new Event('car-park'));
      else setActiveModal('fuel');
      return;
    }

    if (nearbyInteractable) {
      switch (nearbyInteractable.type) {
        case 'atm':
          setActiveModal('bank');
          break;
        case 'food':
          setActiveModal('floral_world');
          break;
        case 'restaurant_dining':
        case 'bench':
          sitAtPosition(nearbyInteractable.seat ?? nearbyInteractable.position, nearbyInteractable.rotation, { animation: nearbyInteractable.pose, exit: nearbyInteractable.exit });
          useInputStore.getState().clearTargetDestination();
          break;
        case 'lecture_hall':
          setSelectedHallLocationId(nearbyInteractable.targetId || nearbyInteractable.id || 'colfhec-lecture-hall');
          setActiveModal('lecture_hall');
          break;
        case 'playstation':
          setActiveModal('ps_match');
          break;
        case 'library':
          setActiveModal('library');
          break;
        case 'keke_stop':
          setActiveModal('keke_destination');
          break;
        case 'job_board':
          setActiveModal('campus_jobs');
          break;
        case 'campus_bet':
          setActiveModal('campus_bet');
          break;
        case 'food_vendor':
          openFoodVendor(nearbyInteractable.targetId);
          break;
        case 'football':
          openFootball();
          break;
        case 'basketball':
        case 'volleyball':
          openCourtGame(nearbyInteractable.type);
          break;
        case 'hustle':
          // Farm plots do the job right there; everything else opens Hustles.
          if (nearbyInteractable.targetId?.startsWith('farm-')) void useHustleStore.getState().farmAt(nearbyInteractable.targetId);
          else setActiveModal('hustles');
          break;
        case 'lodge':
          setActiveModal('estate');
          break;
        case 'party':
          setActiveModal('party');
          break;
        case 'arcade':
          usePartyStore.getState().openTable(nearbyInteractable.targetId as ArcadeTableId);
          break;
      }
    } else if (selectedPlayer) {
      setActiveModal('player_profile');
    }
  };

  const handlePickup = async () => {
    triggerHaptic(20);
    if (!(await pickupDeliveryPackage())) return;
    toast({ icon: '📦', text: 'Picked up! Head to the destination.', tone: 'info' });
  };

  const handleDeliver = async () => {
    if (!user) return;
    triggerHaptic(30);
    const res = await completeActiveJob(user.id);
    if (res.success) {
      toast({ icon: '🎉', text: res.bonus ? `Job complete · includes ₦${res.bonus.toLocaleString()} first-job bonus` : 'Job complete', amount: res.reward + (res.bonus || 0), tone: 'good', ms: 4000 });
    }
  };

  const [jobProx, setJobProx] = useState(() => checkJobProximity(useGameStore.getState().myPosition));

  // Live-update proximity smoothly every 250ms when a job is active
  useEffect(() => {
    if (!activeJob) return;
    const update = () => {
      const pos = useGameStore.getState().myPosition;
      setJobProx(checkJobProximity(pos));
    };
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [activeJob, checkJobProximity]);

  if (!user) return null;

  const getInteractIcon = () => {
    if (isRidingKeke) return '🛺';
    if (!nearbyInteractable) return '💬';
    if (nearbyInteractable.type === 'car') return nearbyInteractable.targetId === 'fuel' ? '⛽' : '🚗';
    switch (nearbyInteractable.type) {
      case 'library': return '📚';
      case 'keke_stop':
        return '🛺';
      case 'lecture_hall':
        return '🎓';
      case 'food':
      case 'restaurant_dining':
        return '🍲';
      case 'bench':
        return '🪑';
      case 'football':
        return '⚽';
      case 'basketball':
        return '🏀';
      case 'volleyball':
        return '🏐';
      case 'hustle':
        return nearbyInteractable.targetId === 'pos' ? '🏧' : nearbyInteractable.targetId?.startsWith('farm') ? FARM_STEPS.find((s) => `farm-${s.id}` === nearbyInteractable.targetId)?.icon ?? '🌱' : '📸';
      case 'lodge':
        return nearbyInteractable.targetId === 'estate' ? '🏡' : '🏘️';
      case 'party':
        return '🪩';
      case 'arcade':
        return nearbyInteractable.targetId === 'pool' ? '🎱' : '⭕';
      case 'atm':
        return '🏧';
      case 'job_board':
        return '💼';
      case 'playstation':
        return '🎮';
      case 'campus_bet':
        return '🔴';
      case 'food_vendor':
        return nearVendor?.icon ?? '🍲';
      default:
        return '✨';
    }
  };

  const getInteractLabel = () => {
    if (seatedAt) return seatedAt.animation === 'sleep' ? 'Get Up' : 'Stand Up';
    if (isRidingKeke) return activeKeke?.isStopped?'Exit Keke':'Exit at next stop';
    if (nearbyInteractable?.type === 'car') return nearbyInteractable.actionText;
    if (nearbyInteractable) {
      switch (nearbyInteractable.type) {
        case 'keke_stop':
          return nearbyInteractable.actionText;
        case 'lecture_hall':
          return 'View Lecture Schedule';
        case 'food':
          return 'Order Food & Drinks';
        case 'restaurant_dining':
        case 'bench':
          return nearbyInteractable.actionText;
        case 'atm':
          return 'Open ATM & Transfer';
        case 'job_board':
          return 'View Campus Jobs';
        case 'playstation':
          return '1v1 PS5 Challenge';
        case 'campus_bet':
          return 'Open Campus Bet';
        case 'football':
          return 'Practice Shot / 1v1 Challenge';
        case 'basketball':
          return 'Free Throws / 1v1 Shootout';
        case 'volleyball':
          return 'Practice Serves / 1v1 Serve-off';
        case 'hustle':
          return nearbyInteractable.actionText;
        case 'lodge':
          return nearbyInteractable.actionText;
        case 'food_vendor':
          return vendorStatus?.isOpen ? `${nearVendor!.actionLabel} · ${vendorStatus.label}` : vendorStatus?.shortLabel ?? 'Closed';
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
    if (seatedAt) return seatedAt.animation === 'sleep' ? 'Get Up' : 'Stand Up';
    if (isRidingKeke) return activeKeke?.isStopped?'Exit Keke':'In transit';
    if (nearbyInteractable?.type === 'car') return nearbyInteractable.actionText;
    switch (nearbyInteractable?.type) {
      case 'library': return 'Library';
      case 'keke_stop':
        return 'Keke';
      case 'lecture_hall':
        return 'Class';
      case 'food':
        return 'Food';
      case 'restaurant_dining':
        return 'Sit';
      case 'bench':
        return nearbyInteractable.pose === 'sleep' ? 'Lie Down' : 'Sit';
      case 'atm':
        return 'Bank';
      case 'job_board':
        return 'Jobs';
      case 'playstation':
        return 'Play';
      case 'campus_bet':
        return 'Campus Bet';
      case 'football':
        return 'Penalty';
      case 'basketball':
        return 'Hoops';
      case 'volleyball':
        return 'Serve';
      case 'hustle':
        return nearbyInteractable.targetId === 'pos' ? 'POS shift'
          : nearbyInteractable.targetId === 'farm' ? 'Farm shift'
          : nearbyInteractable.targetId?.startsWith('farm-') ? nearbyInteractable.actionText.replace(' here', '')
          : 'Photos';
      case 'lodge':
        return nearbyInteractable.targetId === 'estate' ? 'Estate' : 'Lodge';
      case 'party':
        return 'Arena';
      case 'arcade':
        return nearbyInteractable.targetId === 'pool' ? 'Pool' : 'Tic-tac-toe';
      case 'food_vendor':
        return vendorStatus?.isOpen ? nearVendor!.actionLabel : vendorStatus?.shortLabel ?? 'Closed';
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
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-3 pointer-events-auto">
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-3">
            {/* Redesigned Student Profile Badge */}
            <button
              id="btn-hud-profile-badge"
              onClick={() => setActiveModal('student_profile')}
              className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-[20px] bg-[#0c1414]/90 hover:bg-[#111f1e]/95 backdrop-blur-xl border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-left transition transform active:scale-[0.98] group pointer-events-auto"
              title="View Student Profile & Wardrobe"
            >
              {/* Character Head Portrait with Ring & Status Indicator */}
              <div className="relative shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-emerald-400/90 shadow-[0_0_12px_rgba(16,185,129,0.35)] overflow-hidden bg-[#111c19]">
                  <AvatarHeadPortrait
                    config={user.avatarConfig}
                    username={user.username}
                    className="w-full h-full"
                  />
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0c1414] ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                      : 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                  }`}
                />
              </div>
              <span className="max-w-[74px] truncate text-[11px] sm:max-w-[110px] sm:text-[13px] font-black text-white leading-tight font-['Outfit'] tracking-wide">
                {user.username}
              </span>
            </button>

            {/* Redesigned Quick ATM / Wallet Badge */}
            <div
              id="hud-wallet"
              onClick={() => setActiveModal('bank')}
              className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-[20px] bg-[#0c221b]/90 hover:bg-[#0f2a22]/95 backdrop-blur-xl border border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-left transition group pointer-events-auto cursor-pointer"
              title="Open ATM & Bank"
            >
              {/* Wallet Icon Box */}
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner group-hover:scale-105 transition shrink-0">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 stroke-[2.2]" />
              </div>

              {/* Wallet Balance Text */}
              <div className="flex flex-col items-start leading-none">
                <span className="text-[8px] sm:text-[10px] text-emerald-200/70 font-semibold tracking-wider uppercase mb-0.5">
                  Wallet
                </span>
                <span className="whitespace-nowrap text-[12px] sm:text-base font-black text-emerald-300 font-['Outfit'] tracking-tight flex items-center">
                  ₦{balance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </span>
              </div>

              {/* Plus Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveModal('bank');
                }}
                className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-800/40 hover:bg-emerald-700/60 active:scale-90 border border-emerald-500/30 text-emerald-300 flex items-center justify-center transition ml-0.5 sm:ml-1 shrink-0"
                title="Deposit / Withdraw / ATM"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300 stroke-[2.5]" />
              </button>
            </div>
            {/* Phones: a compact Earn button between the wallet and the compass (wider screens have the Jobs Board button). */}
            {!inRoom && (
              <button
                id="btn-hud-earn"
                aria-label="Earn money"
                onClick={() => setActiveModal('earn')}
                className="sm:hidden flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-2xl bg-[#0c221b]/90 backdrop-blur-xl border border-emerald-400/40 active:scale-95 transition"
              >
                <span className="text-[17px] leading-none" aria-hidden>💰</span>
                <span className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300 font-['Outfit']">Earn</span>
              </button>
            )}
          </div>

          {!inRoom&&<>{/* Campus Jobs Board Quick Button */}
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
              <div className="font-bold text-amber-300 text-xs">+{formatNaira(ECONOMY_CONFIG.DAILY_RESUMPTION_ALLOWANCE)}</div>
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
                onClick={() => setActiveModal('timetable')}
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
          })()}</>}
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
            onClick={() => setActiveModal('inbox')}
            className="relative p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Direct Messages (DMs)"
          >
            <MessageSquare className="w-4 h-4" />
            {unreadDmCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white font-extrabold text-[10px] flex items-center justify-center border-2 border-slate-950 animate-pulse shadow-md">
                {unreadDmCount}
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

          {/* Campus Map & Directory Button */}
          <button
            id="btn-hud-campus-map"
            onClick={() => setActiveModal('campus_map')}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Campus Map (M)"
          >
            <Compass className="w-4 h-4 text-emerald-400" />
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
            onClick={() => { if (window.confirm('Leave campus and sign out?')) logout(); }}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-red-950/60 text-slate-400 hover:text-red-400 backdrop-blur-md border border-slate-700/60 shadow-lg transition"
            title="Leave Campus"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        id="btn-hud-campus-map-mobile"
        type="button"
        onClick={() => setActiveModal('campus_map')}
        className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+12px)] z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-slate-900/95 text-emerald-400 shadow-lg backdrop-blur-md transition active:scale-95 sm:hidden pointer-events-auto"
        title="Open Campus Map"
        aria-label="Open Campus Map"
      >
        <Compass className="h-5 w-5" />
      </button>

      {/* Stays on screen while following a route; tap for the full map. */}
      {!inRoom && navigationDestination && <MiniMap onOpen={() => setActiveModal('campus_map')} />}
      {/* ACTIVE DESTINATION WAYPOINT BANNER */}
      {!inRoom && navigationDestination && (
        <div className="mx-auto my-0.5 pointer-events-auto max-w-xs w-full animate-in slide-in-from-top-3">
          <div className="px-2 py-1 sm:p-2 rounded-xl bg-[#091f18]/80 border border-emerald-400/60 backdrop-blur-md shadow-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">{navigationDestination.icon || '📍'}</span>
              <div className="min-w-0">
                <div className="text-xs font-black text-white font-['Outfit'] truncate flex items-center gap-1.5">
                  <span>{navigationDestination.shortName}</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    ({waypointDistance}m)
                  </span>
                </div>
              </div>
            </div>

            <NavigationArrow />

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setActiveModal('campus_map')}
                className="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition"
              >
                Map
              </button>
              <button
                onClick={clearNavigationDestination}
                className="p-1 rounded-lg bg-slate-800/80 hover:bg-red-950/80 text-slate-400 hover:text-red-300 text-xs transition"
                title="Clear Destination"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE JOB BANNER & NOTICES */}
      {!inRoom && jobError && <div role="alert" className="hostel-notice">{jobError}</div>}
      {!inRoom && activeJob && (
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
        <div className="pointer-events-none fixed left-3 top-[calc(env(safe-area-inset-top,0px)+72px)] z-40 w-[min(220px,calc(100vw-130px))] rounded-xl border border-amber-400/70 bg-amber-950/90 px-3 py-2 text-amber-100 shadow-xl backdrop-blur-md sm:left-auto sm:right-4 sm:top-36 sm:translate-x-0">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">🛺</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black leading-tight text-white">Campus Keke</div>
              <div className="truncate text-xs leading-tight text-amber-200">
                To: {destinationName || 'Campus route'}
              </div>
              <div className="truncate text-[11px] leading-tight text-amber-300">
                Next: {activeKeke?.currentStopName || 'Campus stop'}
                {activeKeke?.passengers?.length ? ` · ${activeKeke.passengers.length}/3 passengers` : ''}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 2. CONTEXTUAL ACTION BAR (DESKTOP [E] & MOBILE TOUCH PILL) */}
      <div
        className={isTouchDevice
          ? 'pointer-events-none fixed right-4 z-[60]'
          : 'pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 z-30 w-full max-w-[100vw] px-3 sm:px-4'}
        style={isTouchDevice
          ? { bottom: `calc(env(safe-area-inset-bottom, 0px) + ${Math.max(90, chatClearance + 10)}px)` }
          // On narrower desktops the centred button would sit on the chat input; lift it above.
          : narrowDesktop ? { bottom: `${chatClearance + 8}px` } : undefined}
      >
        {!activeModal && seatedAt && atFloralTable(seatedAt.position) && (
          // Seated at the Floral World terrace: order without getting up (the main button is Stand Up).
          <div className="pointer-events-auto mb-2 flex justify-center">
            <button
              onClick={() => { triggerHaptic(25); setActiveModal('floral_world'); }}
              className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-amber-300/80 bg-amber-500 px-4 py-2 text-sm font-extrabold text-slate-950 shadow-xl transition active:scale-95"
            >
              <span>🍲</span>
              <span>Order Food</span>
            </button>
          </div>
        )}
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
        <div ref={chatBoxRef} id="hud-chat" className="w-full max-w-md pointer-events-auto">
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
                <span className="text-red-400 text-[9px] ml-1.5">(Risk {formatNaira(ECONOMY_CONFIG.LAWN_FINE)} Fine)</span>
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
