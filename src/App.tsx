import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useAuthStore } from './stores/authStore';
import { useGameStore } from './stores/gameStore';
import { useWalletStore } from './stores/walletStore';
import { useSocialStore } from './stores/socialStore';
import { networkManager } from './game/multiplayer/networkManager';
import { LandingPage } from './ui/LandingPage';
const WorldScene = lazy(() => import('./game/world/WorldScene').then(m => ({ default: m.WorldScene })));
const StudentEntry = lazy(() => import('./ui/StudentEntry'));
import { StudentCampusTools } from './ui/StudentCampusTools';
import { CAMPUS_ENTRY_POSITION } from './config/studentJourney';
import { GameHUD } from './ui/GameHUD';
import { BankModal } from './ui/BankModal';
import { FoodVendorModal } from './ui/FoodVendorModal';
import { PSPenaltyGame } from './game/minigames/PSPenaltyGame';
import { PlayerInteractionModal } from './ui/PlayerInteractionModal';
import { FriendsModal } from './ui/FriendsModal';
import { InventoryModal } from './ui/InventoryModal';
import { HelpModal } from './ui/HelpModal';
import { KekeDestinationModal } from './ui/KekeDestinationModal';
import { LawnViolationToast } from './ui/LawnViolationToast';
import { CampusJobsModal } from './ui/CampusJobsModal';
import { SendMoneyModal } from './ui/SendMoneyModal';
import { DailyRewardModal } from './ui/DailyRewardModal';
import { ActivityFeed } from './ui/ActivityFeed';
import { DevDebugPanel } from './ui/DevDebugPanel';

import { ClassroomView } from './game/world/ClassroomScene';
import { ClassroomHUD } from './ui/ClassroomHUD';
import { LectureHallModal } from './ui/LectureHallModal';
import { FloralWorldModal } from './ui/FloralWorldModal';
import { PrivateChatModal } from './ui/PrivateChatModal';
import { ReportUserModal } from './ui/ReportUserModal';
import { DmNotificationToast } from './ui/DmNotificationToast';
import { MobileTutorialOverlay } from './ui/MobileTutorialOverlay';
import { useLectureStore } from './stores/lectureStore';

export const App: React.FC = () => {
  const [campusUserId, setCampusUserId] = useState<string | null>(null);
  const { user, isAuthenticated, isInitializingAuth, initialize } = useAuthStore();
  const { activeModal, setActiveModal, selectedHallLocationId } = useGameStore();
  const { loadWallet } = useWalletStore();
  const { loadSocialData } = useSocialStore();
  const { isInClassroom } = useLectureStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isAuthenticated && user && campusUserId === user.id && user.onboardingCompleted) {
      // Connect to Multiplayer network
      networkManager.connect(user);
      // Load user's persistent balance & social data
      loadWallet(user.id);
      loadSocialData(user.id);
    } else {
      networkManager.disconnect();
    }

    return () => {
      networkManager.disconnect();
    };
  }, [isAuthenticated, user?.id, campusUserId, user?.onboardingCompleted]);

  useEffect(() => { if (user && campusUserId === user.id) networkManager.updateAvatar(user); }, [user?.avatarConfig]);
  useEffect(() => { if (!isAuthenticated) setCampusUserId(null); }, [isAuthenticated]);
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

      {/* Live Campus Activity Feed */}
      <ActivityFeed />

      {/* Incoming Private DM Notification Toast */}
      <DmNotificationToast />

      {/* Lawn Rule Security Fine Toast */}
      <LawnViolationToast />

      {/* Dynamic Interaction & Feature Modals */}
      {activeModal === 'bank' && <BankModal />}
      {activeModal === 'food' && <FoodVendorModal />}
      {activeModal === 'ps_match' && <PSPenaltyGame />}
      {activeModal === 'player_profile' && <PlayerInteractionModal />}
      {activeModal === 'friends' && <FriendsModal />}
      {activeModal === 'inventory' && <InventoryModal />}
      {activeModal === 'help' && <HelpModal />}
      {activeModal === 'keke_destination' && <KekeDestinationModal />}
      {activeModal === 'campus_jobs' && <CampusJobsModal />}
      {activeModal === 'send_money' && <SendMoneyModal />}
      {activeModal === 'daily_reward' && <DailyRewardModal />}
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

      {/* First-time Mobile Touch Tutorial Overlay */}
      <MobileTutorialOverlay />

      {/* Dev Multiplayer & Physics Diagnostics HUD */}
      <DevDebugPanel />
    </div>
  );
};

export default App;
