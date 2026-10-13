import type { PSLastRound } from '../config/psPenalty';
export interface AvatarConfig {
  bodyType?: 'masculine' | 'feminine';
  skinTone?: string;
  hairstyle?: string;
  topStyle?: string;
  topColor?: string;
  bottomStyle?: string;
  bottomColor?: string;
  shoeStyle?: string;
  shoeColor?: string;
  shirtColor: string;
  skinColor: string;
  hairColor?: string;
  hairStyle?: string;
  gender?: string;
}

export interface PlayerProfile {
  onboardingCompleted?: boolean;
  courseId?: string | null;
  gameMatricNumber?: string | null;
  id: string;
  connectionId?: string;
  username: string;
  college: string;
  avatarConfig: AvatarConfig;
  lastWorld?: string;
}

export interface PlayerState {
  id: string;
  connectionId: string;
  username: string;
  college: string;
  avatarConfig: AvatarConfig;
  position: [number, number, number];
  rotation: number;
  animation: 'idle' | 'walk' | 'run' | 'sit' | 'sleep' | 'wave' | 'cheer';
  kekeRiding?: boolean;
  kekeId?: string;
  seatIndex?: number;
  currentZone?: string;
  currentLectureId?: string;
  seatNumber?: number;
  handRaised?: boolean;
  isDining?: boolean;
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
  lectureId?: string;
  isPrivate?: boolean;
  recipientId?: string;
  recipientUsername?: string;
  transferData?: {
    amount: number;
    note?: string;
  };
}

export type KekeState = import('../config/kekeSimulation').TransitState;

export interface PSMatchState {
  id: string;
  stationId: string;
  hostId: string;
  hostConnectionId?: string;
  hostName: string;
  guestId?: string;
  guestConnectionId?: string;
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
  isDraw?: boolean;
  lastRound?: PSLastRound;
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
  type: 'atm' | 'food' | 'playstation' | 'keke_stop' | 'player' | 'bench' | 'job_board' | 'lecture_hall' | 'restaurant_dining' | 'library' | 'campus_bet' | 'food_vendor' | 'football';
  label: string;
  actionText: string;
  position: [number, number, number];
  radius: number;
  rotation?: number;
  targetId?: string;
  // Seat pose for 'bench' zones: where the hips/feet go when it differs from the trigger spot,
  // and where to stand on getting up (a bed's collider would otherwise trap the player).
  pose?: 'sit' | 'sleep';
  seat?: [number, number, number];
  exit?: [number, number, number];
}

export interface FoodItem {
  id: string;
  name: string;
  price: number;
  icon: string;
  type: 'food' | 'drink';
  restaurant?: 'tantalizers' | 'floral_world';
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

export interface TerrainZone {
  id: string;
  name: string;
  type: 'road' | 'path' | 'lawn' | 'sports' | 'building' | 'plaza' | 'carpark';
  restricted: boolean;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface KekeDestination {
  id: string;
  name: string;
  fare: number;
  position: [number, number, number];
  stopIndex: number;
  icon: string;
  description: string;
}

export interface SecurityRoute {
  id: string;
  name: string;
  title: string;
  speed: number;
  detectionRadius: number;
  points: [number, number, number][];
}

export interface SecurityOfficerState {
  id: string;
  name: string;
  title: string;
  position: [number, number, number];
  rotation: number;
  state: 'patrol' | 'alert' | 'fining';
  alertMessage?: string;
}

export interface LawnViolationNotice {
  visible: boolean;
  officerName: string;
  fineAmount: number;
  timestamp: number;
}

export interface CampusJob {
  id: string;
  type: 'delivery' | 'errand' | 'sports' | 'grounds';
  title: string;
  reward: number;
  icon: string;
  source: string;
  sourcePos: [number, number, number];
  destination: string;
  destinationPos: [number, number, number];
  description: string;
  status: 'available' | 'accepted' | 'picked_up' | 'completed';
  progress?: number;
}

export interface ActivityFeedItem {
  id: string;
  text: string;
  type: 'delivery' | 'transfer' | 'fine' | 'ps_win' | 'presence' | 'daily' | 'job' | 'lecture';
  timestamp: number;
}

export interface P2PTransferPayload {
  senderId: string;
  senderUsername: string;
  recipientUsername: string;
  amount: number;
}

export interface LectureScriptAction {
  atSeconds: number;
  action: 'speak' | 'board' | 'gesture';
  text: string;
  boardTopic?: string;
}

export interface LectureDefinition {
  id: string;
  title: string;
  courseCode: string;
  college: string;
  locationId: string;
  locationName: string;
  lecturerName: string;
  lecturerTitle: string;
  lecturerAvatar: { shirtColor: string; skinColor: string };
  durationMinutes: number;
  maxCapacity: number;
  attendanceAllowance: number;
  description: string;
  timeline: LectureScriptAction[];
}

export interface ClassroomSeat {
  seatNumber: number;
  position: [number, number, number];
  occupiedByConnectionId?: string;
  occupiedByUsername?: string;
}

export interface ClassroomState {
  lectureId: string;
  definition: LectureDefinition;
  startedAt: number;
  elapsedSeconds: number;
  status: 'waiting' | 'in_progress' | 'ended';
  currentBoardText: string;
  currentLecturerSpeech: string;
  activeStudents: Record<string, { connectionId: string; username: string; college: string; seatNumber: number; handRaised?: boolean }>;
}
