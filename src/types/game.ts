export interface AvatarConfig {
  shirtColor: string;
  skinColor: string;
  hairColor?: string;
  hairStyle?: string;
  gender?: string;
}

export interface PlayerProfile {
  id: string;
  username: string;
  college: string;
  avatarConfig: AvatarConfig;
  lastWorld?: string;
}

export interface PlayerState {
  id: string;
  username: string;
  college: string;
  avatarConfig: AvatarConfig;
  position: [number, number, number];
  rotation: number;
  animation: 'idle' | 'walk' | 'run' | 'sit' | 'wave' | 'cheer';
  kekeRiding?: boolean;
  kekeId?: string;
  seatIndex?: number;
  lastUpdated: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  college: string;
  text: string;
  timestamp: number;
  position?: [number, number, number];
  isSystem?: boolean;
}

export interface KekeState {
  id: string;
  routeId: string;
  position: [number, number, number];
  rotation: number;
  speed: number;
  currentWaypointIndex: number;
  passengers: string[]; // player IDs
  currentStopName: string;
  isStopped: boolean;
}

export interface PSMatchState {
  id: string;
  stationId: string;
  hostId: string;
  hostName: string;
  guestId?: string;
  guestName?: string;
  status: 'waiting' | 'in_progress' | 'round_resolved' | 'finished';
  currentRound: number;
  totalRounds: number;
  hostScore: number;
  guestScore: number;
  hostChoice?: 'left' | 'center' | 'right';
  guestChoice?: 'left' | 'center' | 'right';
  roundResult?: string;
  winnerName?: string;
  updatedAt: number;
}

export interface WorldLocation {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  description: string;
}

export interface InteractableZone {
  id: string;
  type: 'atm' | 'food' | 'playstation' | 'keke_stop' | 'player' | 'bench';
  label: string;
  actionText: string;
  position: [number, number, number];
  radius: number;
  targetId?: string;
}

export interface FoodItem {
  id: string;
  name: string;
  price: number;
  icon: string;
  type: 'food' | 'drink';
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  quantity: number;
}
