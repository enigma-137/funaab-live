import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useAuthStore } from './stores/authStore';
import { useGameStore } from './stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useWalletStore } from './stores/walletStore';
import { useSocialStore } from './stores/socialStore';
import { networkManager } from './game/multiplayer/networkManager';
import { LandingPage } from './ui/LandingPage';
const WorldScene = lazy(() => import('./game/world/WorldScene').then(m => ({ default: m.WorldScene })));
const StudentEntry = lazy(() => import('./ui/StudentEntry'));
import { HostelLife } from './ui/HostelLife';
import { useHostelStore } from './stores/hostelStore';
import { useJobStore } from './stores/jobStore';
import { StudentCampusTools } from './ui/StudentCampusTools';
import { FeedbackButton } from './ui/FeedbackPanel';
import { CAMPUS_ENTRY_POSITION } from './config/studentJourney';
import { GameHUD } from './ui/GameHUD';
import { BankModal } from './ui/BankModal';
import { FoodVendorModal } from './ui/FoodVendorModal';
import { PSPenaltyGame } from './game/minigames/PSPenaltyGame';
import { FootballPanel } from './ui/FootballPanel';
import { CourtGamePanel } from './ui/CourtGamePanel';
import { RallyPanel } from './ui/RallyPanel';
import { PlayerInteractionModal } from './ui/PlayerInteractionModal';
import { FriendsModal } from './ui/FriendsModal';
import { InventoryModal } from './ui/InventoryModal';
import { HelpModal } from './ui/HelpModal';
import { KekeDestinationModal } from './ui/KekeDestinationModal';
import { CampusJobsModal } from './ui/CampusJobsModal';
import { SendMoneyModal } from './ui/SendMoneyModal';
import { DailyRewardModal } from './ui/DailyRewardModal';
import { ActivityFeed } from './ui/ActivityFeed';
import { DevDebugPanel } from './ui/DevDebugPanel';

import { ClassroomView } from './game/world/ClassroomScene';
import { ClassroomHUD } from './ui/ClassroomHUD';
import { LectureHallModal } from './ui/LectureHallModal';
import { MyTimetable } from './ui/MyTimetable';
import { FloralWorldModal } from './ui/FloralWorldModal';
import { PrivateChatModal } from './ui/PrivateChatModal';
import { ReportUserModal } from './ui/ReportUserModal';
import { CampusMapModal } from './ui/CampusMapModal';
import { CampusTourAutoStart } from './ui/CampusTourAutoStart';
import { EarnPanel } from './ui/EarnPanel';
import { MessagesInbox } from './ui/MessagesInbox';
import { ToastStack } from './ui/ToastStack';
import { StatusStrip } from './ui/StatusStrip';
import { TodayPlan } from './ui/TodayPlan';
import { FirstDayGuide } from './ui/FirstDayGuide';
import { LevelSheet } from './ui/LevelSheet';
import { PartySheet } from './ui/PartySheet';
import { ArcadeSheet } from './ui/ArcadeSheet';
import { SugSheet } from './ui/SugSheet';
import { ControlsSheet } from './ui/ControlsSheet';
import { NoticeBanner } from './ui/NoticeBanner';
import { Joystick } from './ui/Joystick';
import { HustlesSheet } from './ui/HustlesSheet';
import { LodgeSheet, LodgeWatcher } from './ui/LodgeSheet';
import { EstateSheet, EstateWatcher } from './ui/EstateSheet';
import { CarWatcher, FuelSheet, GarageSheet } from './ui/CarSheets';
import { LeagueSheet } from './ui/LeagueSheet';
import { BackgroundGate } from './ui/BackgroundChooser';
import { useLectureStore } from './stores/lectureStore';
import { LibraryLife } from './ui/LibraryLife';
import { CampusBetModal } from './ui/CampusBetModal';
import { FoodVendorSheet } from './ui/FoodVendorSheet';
import { LIBRARY_ROOM } from './config/library';
import { identifyTraceIQUser, trackTraceIQEvent } from './lib/traceiq';

export const App: React.FC = () => {
  const [campusUserId, setCampusUserId] = useState<string | null>(null);
  const { user, isAuthenticated, isInitializingAuth, initialize } = useAuthStore();
  const lastIdentifiedUserRef = useRef<string | null>(null);
  const { activeModal, setActiveModal, selectedHallLocationId } = useGameStore(useShallow((s) => ({ activeModal: s.activeModal, setActiveModal: s.setActiveModal, selectedHallLocationId: s.selectedHallLocationId })));
  const { loadWallet } = useWalletStore();
  const { loadSocialData } = useSocialStore();
  const { isInClassroom } = useLectureStore();
  const hostelRoomId=useHostelStore(s=>s.roomId);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!user?.id) {
      lastIdentifiedUserRef.current = null;
      return;
    }

    if (lastIdentifiedUserRef.current === user.id) return;
    lastIdentifiedUserRef.current = user.id;

    identifyTraceIQUser({
      id: user.id,
      username: user.username,
      college: user.college,
      courseId: user.courseId ?? null,
      onboardingCompleted: user.onboardingCompleted,
      lastWorld: user.lastWorld ?? 'funaab',
    });

    trackTraceIQEvent('app_user_identified', {
      userId: user.id,
      college: user.college,
      onboardingCompleted: Boolean(user.onboardingCompleted),
    });
  }, [user?.id, user?.college, user?.courseId, user?.onboardingCompleted, user?.lastWorld, user?.username]);

  useEffect(() => {
    if (isAuthenticated && user && campusUserId === user.id && user.onboardingCompleted) {
      // Connect to Multiplayer network
      networkManager.connect(user);
      try{const owner=sessionStorage.getItem('funaab-room:'+user.id);if(owner&&useHostelStore.getState().roomId==='world:funaab:main')void useHostelStore.getState().travel('room',owner);}catch{/* Room restoration is optional when browser storage is disabled. */}
      // Load user's persistent balance & social data
      loadWallet(user.id);
      useJobStore.getState().load();
      loadSocialData(user.id);
      trackTraceIQEvent('campus_session_started', {
        userId: user.id,
        college: user.college,
        courseId: user.courseId ?? null,
      });
    } else {
      networkManager.disconnect();
    }

    return () => {
      networkManager.disconnect();
    };
  }, [isAuthenticated, user?.id, campusUserId, user?.onboardingCompleted]);

  useEffect(() => { if (user && campusUserId === user.id) networkManager.updateAvatar(user); }, [user?.avatarConfig]);
  useEffect(() => { if (!isAuthenticated) { setCampusUserId(null); networkManager.room='world:funaab:main'; useHostelStore.setState({roomId:'world:funaab:main',owner:null,snapshot:null,invites:[],debts:[]}); useJobStore.setState({run:null,activeJob:null}); } }, [isAuthenticated]);
  useEffect(() => { if (user) loadSocialData(user.id); }, [user?.id]);

  if (isInitializingAuth) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#070d08] text-slate-100 flex flex-col items-center justify-center font-['Plus_Jakarta_Sans']">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-3xl animate-pulse">
            🎓
          </div>
          <div className="text-center">
            <h2 className="font-['Outfit'] font-bold text-xl text-white tracking-tight">
              FUNAAB <span className="text-emerald-400">Life</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">Restoring campus session...</p>
          </div>
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div className="w-full h-full bg-emerald-400 animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LandingPage />;
  }

  if (campusUserId !== user.id || !user.onboardingCompleted) {
    return <Suspense fallback={<div className="p-8 bg-[#f8faf7] text-green-950 h-screen">Opening your campus story…</div>}><StudentEntry key={user.id} onEnter={() => {
      useGameStore.getState().setMyPosition(CAMPUS_ENTRY_POSITION);
      setCampusUserId(user.id);
    }} /></Suspense>;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070d08]">
      {/* 3D World / Classroom View */}
      {isInClassroom ? (
        <>
          <ClassroomView />
          <ClassroomHUD />
        </>
      ) : (
        <>
          <Suspense fallback={<div className="p-8">Opening campus…</div>}><WorldScene /></Suspense>
          <GameHUD />
        </>
      )}

      <StudentCampusTools />
      {!isInClassroom && <StatusStrip />}
      {!isInClassroom && <NoticeBanner />}
      {!isInClassroom && <TodayPlan />}
      <FirstDayGuide />
      <FeedbackButton />
      {hostelRoomId !== LIBRARY_ROOM && <HostelLife />}<LibraryLife />

      {/* Live Campus Activity Feed */}
      {hostelRoomId==='world:funaab:main'&&<ActivityFeed />}

      {/* Incoming Private DM Notification Toast */}
      <ToastStack />

      {/* Dynamic Interaction & Feature Modals */}
      {activeModal === 'bank' && <BankModal />}
      {activeModal === 'food' && <FoodVendorModal />}
      {activeModal === 'ps_match' && <PSPenaltyGame />}
      {activeModal === 'football' && <FootballPanel />}
      {(activeModal === 'basketball' || activeModal === 'volleyball') && <CourtGamePanel key={activeModal} game={activeModal} />}
      {activeModal === 'volleyball_rally' && <RallyPanel />}
      {activeModal === 'level' && <LevelSheet />}
      {activeModal === 'party' && <PartySheet />}
      {activeModal === 'arcade' && <ArcadeSheet />}
      {activeModal === 'sug' && <SugSheet />}
      {activeModal === 'controls' && <ControlsSheet />}
      <Joystick />
      {activeModal === 'hustles' && <HustlesSheet />}
      {activeModal === 'lodge' && <LodgeSheet />}
      {activeModal === 'estate' && <EstateSheet />}
      {activeModal === 'garage' && <GarageSheet />}
      {activeModal === 'fuel' && <FuelSheet />}
      {activeModal === 'league' && <LeagueSheet />}
      {!isInClassroom && <LodgeWatcher />}
      {!isInClassroom && <EstateWatcher />}
      <CarWatcher />
      {!isInClassroom && <BackgroundGate />}
      {activeModal === 'player_profile' && <PlayerInteractionModal />}
      {activeModal === 'friends' && <FriendsModal />}
      {activeModal === 'inventory' && <InventoryModal />}
      {activeModal === 'help' && <HelpModal />}
      {activeModal === 'keke_destination'  && <KekeDestinationModal />}
      {activeModal === 'campus_jobs' && <CampusJobsModal />}
      {activeModal === 'send_money' && <SendMoneyModal />}
      {activeModal === 'daily_reward' && <DailyRewardModal />}
      {activeModal === 'campus_bet' && <CampusBetModal />}
      {activeModal === 'food_vendor' && <FoodVendorSheet />}
      {activeModal === 'timetable' && <MyTimetable />}
      {activeModal === 'lecture_hall' && (
        <LectureHallModal
          isOpen={true}
          hallLocationId={selectedHallLocationId || 'colfhec-lecture-hall'}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'floral_world' && (
        <FloralWorldModal isOpen={true} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'private_chat' && <PrivateChatModal />}
      {activeModal === 'report_user' && <ReportUserModal />}
      {activeModal === 'campus_map' && <CampusMapModal />}
      {activeModal === 'earn' && <EarnPanel />}
      {activeModal === 'inbox' && <MessagesInbox />}

      {/* First-visit guided tour (replaces the old touch-controls popup) */}
      {!isInClassroom && <CampusTourAutoStart userId={user.id} />}

      {/* Dev Multiplayer & Physics Diagnostics HUD */}
      <DevDebugPanel />
    </div>
  );
};

export default App;
