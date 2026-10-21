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

import type { HeldItem } from '../config/heldItems';

export interface NavigationDestination {
  id: string;
  name: string;
  shortName: string;
  position: [number, number, number];
  category?: string;
  icon?: string;
}

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
  activeChallengeId: string | null;
  psViewState: 'lobby' | 'waiting' | 'active' | 'result';

  // Development & Diagnostics
  debugPhysics: boolean;
  debugNet: boolean;

  // Local player state
  myPosition: [number, number, number];
  myRotation: number;
  myAnimation: 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'pray' | 'wave' | 'cheer' | 'dance';
  seatedAt: { position: [number, number, number]; rotation: number; animation?: 'sit' | 'sleep' | 'pray'; exit?: [number, number, number] } | null;
  /** One-shot facing request (e.g. turn to face the goal); LocalPlayer applies then clears it. */
  faceRotation: number | null;
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

  // Navigation & Destination Guidance
  navigationDestination: NavigationDestination | null;
  setNavigationDestination: (dest: NavigationDestination | null) => void;
  clearNavigationDestination: () => void;
  openMap: () => void;
  closeMap: () => void;
  /** Open the campus map centred on an online student (a friend from the Friends list). */
  mapFocusPlayerId: string | null;
  findOnMap: (playerId: string) => void;

  // Active interaction prompt & Modals
  nearbyInteractable: InteractableZone | null;
  selectedPlayer: PlayerState | null;
  selectedHallLocationId: string | null;
  activeModal:
    | 'student_profile'
    | 'student_phone'
    | 'hostel'
    | 'bank'
    | 'food'
    | 'ps_match'
    | 'player_profile'
    | 'friends'
    | 'inventory'
    | 'help'
    | 'library'
    | 'keke_destination'
    | 'campus_jobs'
    | 'jobs'
    | 'send_money'
    | 'daily_reward'
    | 'lecture_hall'
    | 'timetable'
    | 'floral_world'
    | 'private_chat'
    | 'report_user'
    | 'campus_map'
    | 'campus_bet'
    | 'ad_space'
    | 'feedback'
    | 'earn'
    | 'inbox'
    | 'food_vendor'
    | 'football'
    | 'basketball'
    | 'volleyball'
    | 'volleyball_rally'
    | 'level'
    | 'party'
    | 'arcade'
    | 'sug'
    | 'controls'
    | 'background'
    | 'hustles'
    | 'lodge'
    | 'estate'
    | 'fuel'
    | 'garage'
    | 'group_chat'
    | 'new_group'
    | 'league'
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
  startPSMatch: (match: PSMatchState) => void;
  setPlayerRef: (ref: React.RefObject<any> | null) => void;

  setMyPosition: (pos: [number, number, number]) => void;
  myHeldItem: HeldItem | null;
  setMyHeldItem: (item: HeldItem | null) => void;
  setMyRotation: (rot: number) => void;
  setMyAnimation: (anim: 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'pray' | 'wave' | 'cheer' | 'dance') => void;
  sitAtPosition: (position: [number, number, number], rotation?: number, opts?: { animation?: 'sit' | 'sleep' | 'pray'; exit?: [number, number, number] }) => void;
  standUp: () => void;
  setFaceRotation: (rotation: number | null) => void;
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
      | 'student_profile'
      | 'student_phone'
    | 'hostel'
      | 'bank'
      | 'food'
      | 'ps_match'
      | 'player_profile'
      | 'friends'
      | 'inventory'
      | 'help'
      | 'library'
    | 'keke_destination'
      | 'campus_jobs'
      | 'jobs'
      | 'send_money'
      | 'daily_reward'
      | 'lecture_hall'
      | 'timetable'
      | 'floral_world'
      | 'private_chat'
      | 'report_user'
      | 'campus_map'
      | 'campus_bet'
      | 'ad_space'
    | 'feedback'
    | 'earn'
    | 'inbox'
      | 'food_vendor'
      | 'football'
      | 'basketball'
      | 'volleyball'
      | 'volleyball_rally'
    | 'volleyball_rally'
    | 'volleyball'
    | 'volleyball_rally'
    | 'basketball'
    | 'volleyball'
    | 'volleyball_rally'
      | 'level'
    | 'party'
    | 'arcade'
    | 'sug'
    | 'controls'
      | 'background'
      | 'hustles'
      | 'lodge'
      | 'estate'
      | 'fuel'
      | 'garage'
      | 'group_chat'
      | 'new_group'
      | 'league'
      | null
  ) => void;
  toggleDebugPhysics: () => void;
  toggleDebugNet: () => void;
}

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const initialDebugPhysics = urlParams?.get('debugPhysics') === 'true';
const initialDebugNet = urlParams?.get('debugNet') === 'true' || urlParams?.get('debug') === 'true';

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
  activeChallengeId: null,
  psViewState: 'lobby',

  debugPhysics: initialDebugPhysics,
  debugNet: initialDebugNet,

  myPosition: [0, 0, 8],
  myHeldItem: null,
  setMyHeldItem: (myHeldItem) => set({ myHeldItem }),
  myRotation: 0,
  myAnimation: 'idle',
  seatedAt: null,
  faceRotation: null,
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
  navigationDestination: null,

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
      const candidate = Object.values(matches)
        .filter(
          (match) =>
            (!!currentUser && (match.hostId === currentUser.id || match.guestId === currentUser.id)) ||
            match.hostId === state.myConnectionId ||
            match.guestId === state.myConnectionId ||
            match.hostConnectionId === state.myConnectionId ||
            match.guestConnectionId === state.myConnectionId
        )
        .sort((a, b) => {
          const statusPriority = { in_progress: 0, round_resolved: 0, waiting: 1, finished: 2 };
          return statusPriority[a.status] - statusPriority[b.status] || b.updatedAt - a.updatedAt;
        })[0];
      const currentMatch = candidate || state.currentMatch;
      return {
        activeMatches: matches,
        currentMatch,
        activeChallengeId: currentMatch?.id || null,
        activeModal:
          candidate && candidate.status !== 'finished'
            ? 'ps_match'
            : state.activeModal,
        psViewState: currentMatch
          ? currentMatch.status === 'waiting'
            ? 'waiting'
            : currentMatch.status === 'finished'
              ? 'result'
              : 'active'
          : 'lobby',
      };
    }),

  updateMatch: (match) =>
    set((state) => {
      const currentUser = useAuthStore.getState().user;
      const current = state.currentMatch;
      // A withdrawn challenge disappears for everyone; its host goes back to the lobby.
      if (match.cancelled) {
        const { [match.id]: _gone, ...rest } = state.activeMatches;
        const wasMine = current?.id === match.id;
        return {
          activeMatches: rest,
          currentMatch: wasMine ? null : current,
          activeChallengeId: wasMine ? null : state.activeChallengeId,
          psViewState: wasMine ? 'lobby' : state.psViewState,
        };
      }
      const isMyMatch =
        (!!currentUser && (match.hostId === currentUser.id || match.guestId === currentUser.id)) ||
        match.hostId === state.myConnectionId ||
        match.guestId === state.myConnectionId ||
        match.hostConnectionId === state.myConnectionId ||
        match.guestConnectionId === state.myConnectionId;
      const isCurrentMatch = current && current.id === match.id;
      const currentMatch = isMyMatch || isCurrentMatch ? match : current;
      return {
        activeMatches: {
          ...state.activeMatches,
          [match.id]: match,
        },
        currentMatch,
        activeChallengeId: currentMatch?.id || null,
        psViewState: currentMatch
          ? currentMatch.status === 'waiting'
            ? 'waiting'
            : currentMatch.status === 'finished'
              ? 'result'
              : 'active'
          : 'lobby',
      };
    }),

  setCurrentMatch: (match) =>
    set({
      currentMatch: match,
      activeChallengeId: match?.id || null,
      psViewState: match
        ? match.status === 'waiting'
          ? 'waiting'
          : match.status === 'finished'
            ? 'result'
            : 'active'
        : 'lobby',
    }),
  startPSMatch: (match) =>
    set((state) => {
      const currentUser = useAuthStore.getState().user;
      const isParticipant =
        (!!currentUser && (match.hostId === currentUser.id || match.guestId === currentUser.id)) ||
        match.hostId === state.myConnectionId ||
        match.guestId === state.myConnectionId ||
        match.hostConnectionId === state.myConnectionId ||
        match.guestConnectionId === state.myConnectionId;
      if (!isParticipant) return state;
      return {
        activeMatches: { ...state.activeMatches, [match.id]: match },
        currentMatch: match,
        activeChallengeId: match.id,
        psViewState: match.status === 'finished' ? 'result' : 'active',
        activeModal: 'ps_match',
      };
    }),
  setPlayerRef: (playerRef) => set({ playerRef }),

  // Called every frame by LocalPlayer: skip unchanged values so idle frames don't notify subscribers.
  setMyPosition: (myPosition) =>
    set((state) => {
      const p = state.myPosition;
      return p[0] === myPosition[0] && p[1] === myPosition[1] && p[2] === myPosition[2] ? state : { myPosition };
    }),
  setMyRotation: (myRotation) => set((state) => (state.myRotation === myRotation ? state : { myRotation })),
  setMyAnimation: (myAnimation) => set((state) => (state.myAnimation === myAnimation ? state : { myAnimation })),
  sitAtPosition: (position, rotation = 0, opts = {}) => set({ seatedAt: { position, rotation, ...opts } }),
  standUp: () => set({ seatedAt: null }),
  setFaceRotation: (faceRotation) => set({ faceRotation }),
  setRidingKeke: (isRidingKeke, currentKekeId = null, targetKekeDestinationId = null) =>
    set({ isRidingKeke, currentKekeId, targetKekeDestinationId }),
  setTargetKekeDestinationId: (targetKekeDestinationId) => set({ targetKekeDestinationId }),

  setIsOnRestrictedLawn: (isOnRestrictedLawn) =>
    set((state) => (state.isOnRestrictedLawn === isOnRestrictedLawn ? state : { isOnRestrictedLawn })),
  setCurrentTerrainType: (currentTerrainType) =>
    set((state) => (state.currentTerrainType === currentTerrainType ? state : { currentTerrainType })),
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

  setNavigationDestination: (navigationDestination) => set({ navigationDestination }),
  clearNavigationDestination: () => set({ navigationDestination: null }),
  openMap: () => set({ activeModal: 'campus_map', mapFocusPlayerId: null }),
  closeMap: () => set((state) => ({ activeModal: state.activeModal === 'campus_map' ? null : state.activeModal, mapFocusPlayerId: null })),
  mapFocusPlayerId: null,
  findOnMap: (playerId) => set({ activeModal: 'campus_map', mapFocusPlayerId: playerId }),

  // Both are re-evaluated every frame; keep the old reference when nothing meaningful changed.
  setNearbyInteractable: (nearbyInteractable) =>
    set((state) => {
      const prev = state.nearbyInteractable;
      if (prev === nearbyInteractable) return state;
      if (
        prev &&
        nearbyInteractable &&
        prev.id === nearbyInteractable.id &&
        prev.type === nearbyInteractable.type &&
        prev.targetId === nearbyInteractable.targetId &&
        prev.label === nearbyInteractable.label &&
        prev.actionText === nearbyInteractable.actionText
      ) {
        return state;
      }
      return { nearbyInteractable };
    }),
  setSelectedPlayer: (selectedPlayer) =>
    set((state) => (state.selectedPlayer === selectedPlayer ? state : { selectedPlayer })),
  setSelectedHallLocationId: (selectedHallLocationId) => set({ selectedHallLocationId }),
  setActiveModal: (activeModal) => set({ activeModal }),

  toggleDebugPhysics: () => set((s) => ({ debugPhysics: !s.debugPhysics })),
  toggleDebugNet: () => set((s) => ({ debugNet: !s.debugNet })),
}));
