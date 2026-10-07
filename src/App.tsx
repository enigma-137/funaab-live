import React, { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useGameStore } from './stores/gameStore';
import { useWalletStore } from './stores/walletStore';
import { useSocialStore } from './stores/socialStore';
import { networkManager } from './game/multiplayer/networkManager';
import { LandingPage } from './ui/LandingPage';
import { WorldScene } from './game/world/WorldScene';
import { GameHUD } from './ui/GameHUD';
import { BankModal } from './ui/BankModal';
import { FoodVendorModal } from './ui/FoodVendorModal';
import { PSPenaltyGame } from './game/minigames/PSPenaltyGame';
import { PlayerInteractionModal } from './ui/PlayerInteractionModal';
import { FriendsModal } from './ui/FriendsModal';
import { InventoryModal } from './ui/InventoryModal';
import { HelpModal } from './ui/HelpModal';

export const App: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { activeModal } = useGameStore();
  const { loadWallet } = useWalletStore();
  const { loadSocialData } = useSocialStore();

  useEffect(() => {
    if (isAuthenticated && user) {
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
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return <LandingPage />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070d08]">
      {/* 3D Canvas World */}
      <WorldScene />

      {/* Head-Up Display Overlay */}
      <GameHUD />

      {/* Dynamic Interaction & Feature Modals */}
      {activeModal === 'bank' && <BankModal />}
      {activeModal === 'food' && <FoodVendorModal />}
      {activeModal === 'ps_match' && <PSPenaltyGame />}
      {activeModal === 'player_profile' && <PlayerInteractionModal />}
      {activeModal === 'friends' && <FriendsModal />}
      {activeModal === 'inventory' && <InventoryModal />}
      {activeModal === 'help' && <HelpModal />}
    </div>
  );
};

export default App;
