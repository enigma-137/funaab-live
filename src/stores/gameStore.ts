import { create } from 'zustand';
import { PlayerState, KekeState, PSMatchState, InteractableZone } from '../types/game';

interface GameState {
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  ping: number;
  onlineCount: number;
  players: Record<string, PlayerState>;
  kekes: Record<string, KekeState>;
  activeMatches: Record<string, PSMatchState>;
  currentMatch: PSMatchState | null;

  // Local player state
  myPosition: [number, number, number];
  myRotation: number;
  myAnimation: 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'cheer';
  isRidingKeke: boolean;
  currentKekeId: string | null;

  // Active interaction prompt & Modals
  nearbyInteractable: InteractableZone | null;
  selectedPlayer: PlayerState | null;
  activeModal: 'bank' | 'food' | 'ps_match' | 'player_profile' | 'friends' | 'inventory' | 'help' | null;

  // Actions
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void;
  setPlayers: (players: Record<string, PlayerState>) => void;
  updatePlayer: (id: string, update: Partial<PlayerState>) => void;
  removePlayer: (id: string) => void;
  setKekes: (kekes: Record<string, KekeState>) => void;
  updateKeke: (id: string, update: Partial<KekeState>) => void;
  setMatches: (matches: Record<string, PSMatchState>) => void;
  updateMatch: (match: PSMatchState) => void;
  setCurrentMatch: (match: PSMatchState | null) => void;

  setMyPosition: (pos: [number, number, number]) => void;
  setMyRotation: (rot: number) => void;
  setMyAnimation: (anim: 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'cheer') => void;
  setRidingKeke: (isRiding: boolean, kekeId?: string | null) => void;

  setNearbyInteractable: (zone: InteractableZone | null) => void;
  setSelectedPlayer: (player: PlayerState | null) => void;
  setActiveModal: (modal: 'bank' | 'food' | 'ps_match' | 'player_profile' | 'friends' | 'inventory' | 'help' | null) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  isConnected: false,
  connectionStatus: 'disconnected',
  ping: 0,
  onlineCount: 1,
  players: {},
  kekes: {},
  activeMatches: {},
  currentMatch: null,

  myPosition: [0, 0, 8],
  myRotation: 0,
  myAnimation: 'idle',
  isRidingKeke: false,
  currentKekeId: null,

  nearbyInteractable: null,
  selectedPlayer: null,
  activeModal: null,

  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
      isConnected: status === 'connected',
    }),

  setPlayers: (players) =>
    set({
      players,
      onlineCount: Object.keys(players).length + 1,
    }),

  updatePlayer: (id, update) =>
    set((state) => {
      const existing = state.players[id];
      if (!existing) return state;
      return {
        players: {
          ...state.players,
          [id]: { ...existing, ...update, lastUpdated: Date.now() },
        },
      };
    }),

  removePlayer: (id) =>
    set((state) => {
      const copy = { ...state.players };
      delete copy[id];
      return {
        players: copy,
        onlineCount: Object.keys(copy).length + 1,
      };
    }),

  setKekes: (kekes) => set({ kekes }),

  updateKeke: (id, update) =>
    set((state) => {
      const existing = state.kekes[id];
      if (!existing) return state;
      return {
        kekes: {
          ...state.kekes,
          [id]: { ...existing, ...update },
        },
      };
    }),

  setMatches: (matches) => set({ activeMatches: matches }),

  updateMatch: (match) =>
    set((state) => {
      const current = state.currentMatch;
      const isMyCurrent = current && current.id === match.id;
      return {
        activeMatches: {
          ...state.activeMatches,
          [match.id]: match,
        },
        currentMatch: isMyCurrent ? match : current,
      };
    }),

  setCurrentMatch: (match) => set({ currentMatch: match }),

  setMyPosition: (myPosition) => set({ myPosition }),
  setMyRotation: (myRotation) => set({ myRotation }),
  setMyAnimation: (myAnimation) => set({ myAnimation }),
  setRidingKeke: (isRidingKeke, currentKekeId = null) =>
    set({ isRidingKeke, currentKekeId }),

  setNearbyInteractable: (nearbyInteractable) => set({ nearbyInteractable }),
  setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),
  setActiveModal: (activeModal) => set({ activeModal }),
}));
