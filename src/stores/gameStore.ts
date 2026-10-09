import { create } from 'zustand';
import { useAuthStore } from './authStore';
import {
  PlayerState,
  KekeState,
  PSMatchState,
  InteractableZone,
  SecurityOfficerState,
  LawnViolationNotice,
  ActivityFeedItem,
} from '../types/game';

interface GameState {
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  ping: number;
  onlineCount: number;
  myConnectionId: string | null;
  players: Record<string, PlayerState>;
  kekes: Record<string, KekeState>;
  activeMatches: Record<string, PSMatchState>;
  currentMatch: PSMatchState | null;

  // Development & Diagnostics
  debugPhysics: boolean;
  debugNet: boolean;

  // Local player state
  myPosition: [number, number, number];
  myRotation: number;
  myAnimation: 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'cheer';
  isRidingKeke: boolean;
  currentKekeId: string | null;
  targetKekeDestinationId: string | null;
  playerRef: React.RefObject<any> | null;

  // Lawn & Security systems
  isOnRestrictedLawn: boolean;
  currentTerrainType: string;
  securityOfficers: Record<string, SecurityOfficerState>;
  lawnViolationNotice: LawnViolationNotice | null;

  // Activity & Economy
  activityEvents: ActivityFeedItem[];
  sendMoneyRecipient: { username: string; college?: string } | string | null;

  // Active interaction prompt & Modals
  nearbyInteractable: InteractableZone | null;
  selectedPlayer: PlayerState | null;
  selectedHallLocationId: string | null;
  activeModal:
    | 'bank'
    | 'food'
    | 'ps_match'
    | 'player_profile'
    | 'friends'
    | 'inventory'
    | 'help'
    | 'keke_destination'
    | 'campus_jobs'
    | 'jobs'
    | 'send_money'
    | 'daily_reward'
    | 'lecture_hall'
    | 'floral_world'
    | 'private_chat'
    | 'report_user'
    | null;

  // Actions
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting') => void;
  setMyConnectionId: (id: string | null) => void;
  setPing: (ping: number) => void;
  setPlayers: (players: Record<string, PlayerState>) => void;
  upsertPlayer: (player: PlayerState) => void;
  updatePlayer: (id: string, update: Partial<PlayerState>) => void;
  removePlayer: (id: string) => void;
  setKekes: (kekes: Record<string, KekeState>) => void;
  updateKeke: (id: string, update: Partial<KekeState>) => void;
  setMatches: (matches: Record<string, PSMatchState>) => void;
  updateMatch: (match: PSMatchState) => void;
  addActivityEvent: (event: ActivityFeedItem) => void;
  setSendMoneyRecipient: (recipient: { username: string; college?: string } | string | null) => void;
  setCurrentMatch: (match: PSMatchState | null) => void;
  setPlayerRef: (ref: React.RefObject<any> | null) => void;

  setMyPosition: (pos: [number, number, number]) => void;
  setMyRotation: (rot: number) => void;
  setMyAnimation: (anim: 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'cheer') => void;
  setRidingKeke: (isRiding: boolean, kekeId?: string | null, targetDestinationId?: string | null) => void;
  setTargetKekeDestinationId: (id: string | null) => void;

  setIsOnRestrictedLawn: (isOnLawn: boolean) => void;
  setCurrentTerrainType: (terrainType: string) => void;
  setSecurityOfficers: (officers: Record<string, SecurityOfficerState>) => void;
  updateSecurityOfficer: (id: string, update: Partial<SecurityOfficerState>) => void;
  setLawnViolationNotice: (notice: LawnViolationNotice | null) => void;

  setNearbyInteractable: (zone: InteractableZone | null) => void;
  setSelectedPlayer: (player: PlayerState | null) => void;
  setSelectedHallLocationId: (id: string | null) => void;
  setActiveModal: (
    modal:
      | 'bank'
      | 'food'
      | 'ps_match'
      | 'player_profile'
      | 'friends'
      | 'inventory'
      | 'help'
      | 'keke_destination'
      | 'campus_jobs'
      | 'jobs'
      | 'send_money'
      | 'daily_reward'
      | 'lecture_hall'
      | 'floral_world'
      | 'private_chat'
      | 'report_user'
      | null
  ) => void;
  toggleDebugPhysics: () => void;
  toggleDebugNet: () => void;
}

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const initialDebugPhysics = urlParams?.get('debugPhysics') === 'true';
const initialDebugNet = urlParams?.get('debugNet') === 'true';

export const useGameStore = create<GameState>((set, get) => ({
  isConnected: false,
  connectionStatus: 'disconnected',
  ping: 0,
  onlineCount: 1,
  myConnectionId: null,
  players: {},
  kekes: {},
  activeMatches: {},
  currentMatch: null,

  debugPhysics: initialDebugPhysics,
  debugNet: initialDebugNet,

  myPosition: [0, 0, 8],
  myRotation: 0,
  myAnimation: 'idle',
  isRidingKeke: false,
  currentKekeId: null,
  targetKekeDestinationId: null,
  playerRef: null,

  isOnRestrictedLawn: false,
  currentTerrainType: 'path',
  securityOfficers: {},
  lawnViolationNotice: null,
  activityEvents: [
    {
      id: 'init-feed-1',
      text: 'Campus jobs are now live at Car Park and Eatery boards!',
      type: 'delivery',
      timestamp: Date.now(),
    },
  ],
  sendMoneyRecipient: null,

  nearbyInteractable: null,
  selectedPlayer: null,
  selectedHallLocationId: null,
  activeModal: null,

  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
      isConnected: status === 'connected',
    }),

  setMyConnectionId: (id) => set({ myConnectionId: id }),

  setPing: (ping) => set({ ping }),

  setPlayers: (players) =>
    set({
      players,
      onlineCount: Object.keys(players).length + 1,
    }),

  upsertPlayer: (player) =>
    set((state) => {
      const key = player.connectionId || player.id;
      const isNew = !state.players[key];
      const updatedPlayers = {
        ...state.players,
        [key]: {
          ...(state.players[key] || {}),
          ...player,
          lastUpdated: Date.now(),
        },
      };
      return {
        players: updatedPlayers,
        onlineCount: Object.keys(updatedPlayers).length + 1,
      };
    }),

  updatePlayer: (id, update) =>
    set((state) => {
      const existing = state.players[id];
      if (!existing) {
        // If player does not exist yet (e.g. joined before init or batch arrived first), construct new player state
        if (update.position && (update.username || (update as any).id)) {
          const newPlayer: PlayerState = {
            id: update.id || id,
            connectionId: id,
            username: update.username || 'Student',
            college: update.college || 'COLENG',
            avatarConfig: update.avatarConfig || {
              shirtColor: '#15803d',
              skinColor: '#8d5524',
              hairColor: '#1e1b18',
              hairStyle: 'short',
              gender: 'male',
            },
            position: update.position,
            rotation: update.rotation || 0,
            animation: update.animation || 'idle',
            kekeRiding: update.kekeRiding,
            kekeId: update.kekeId,
            lastUpdated: Date.now(),
          };
          const updatedPlayers = { ...state.players, [id]: newPlayer };
          return {
            players: updatedPlayers,
            onlineCount: Object.keys(updatedPlayers).length + 1,
          };
        }
        return state;
      }
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

  setMatches: (matches) =>
    set((state) => {
      const currentUser = useAuthStore.getState().user;
      const candidate = Object.values(matches).find(
        (match) =>
          !!currentUser &&
          (match.hostId === currentUser.id || match.guestId === currentUser.id) &&
          match.status !== 'finished'
      );
      return {
        activeMatches: matches,
        currentMatch: candidate || state.currentMatch,
      };
    }),

  updateMatch: (match) =>
    set((state) => {
      const currentUser = useAuthStore.getState().user;
      const current = state.currentMatch;
      const isMyMatch = !!currentUser && (match.hostId === currentUser.id || match.guestId === currentUser.id);
      const isCurrentMatch = current && current.id === match.id;
      return {
        activeMatches: {
          ...state.activeMatches,
          [match.id]: match,
        },
        currentMatch: isMyMatch || isCurrentMatch ? match : current,
      };
    }),

  setCurrentMatch: (match) => set({ currentMatch: match }),
  setPlayerRef: (playerRef) => set({ playerRef }),

  setMyPosition: (myPosition) => set({ myPosition }),
  setMyRotation: (myRotation) => set({ myRotation }),
  setMyAnimation: (myAnimation) => set({ myAnimation }),
  setRidingKeke: (isRidingKeke, currentKekeId = null, targetKekeDestinationId = null) =>
    set({ isRidingKeke, currentKekeId, targetKekeDestinationId }),
  setTargetKekeDestinationId: (targetKekeDestinationId) => set({ targetKekeDestinationId }),

  setIsOnRestrictedLawn: (isOnRestrictedLawn) => set({ isOnRestrictedLawn }),
  setCurrentTerrainType: (currentTerrainType) => set({ currentTerrainType }),
  setSecurityOfficers: (securityOfficers) => set({ securityOfficers }),
  updateSecurityOfficer: (id, update) =>
    set((state) => {
      const existing = state.securityOfficers[id];
      if (!existing) return state;
      return {
        securityOfficers: {
          ...state.securityOfficers,
          [id]: { ...existing, ...update },
        },
      };
    }),
  setLawnViolationNotice: (lawnViolationNotice) => set({ lawnViolationNotice }),

  addActivityEvent: (event) =>
    set((state) => ({
      activityEvents: [...state.activityEvents.slice(-7), event],
    })),

  setSendMoneyRecipient: (sendMoneyRecipient) => set({ sendMoneyRecipient }),

  setNearbyInteractable: (nearbyInteractable) => set({ nearbyInteractable }),
  setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),
  setSelectedHallLocationId: (selectedHallLocationId) => set({ selectedHallLocationId }),
  setActiveModal: (activeModal) => set({ activeModal }),

  toggleDebugPhysics: () => set((s) => ({ debugPhysics: !s.debugPhysics })),
  toggleDebugNet: () => set((s) => ({ debugNet: !s.debugNet })),
}));
