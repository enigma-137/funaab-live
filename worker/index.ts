import { LIBRARY_ROOM, isLibraryOpen } from '../src/config/library';
import { PS_DIRECTIONS, PS_TOTAL_ROUNDS, resolvePSRound, type PSLastRound } from '../src/config/psPenalty';
import { CAMPUS_SPAWN, campusZoneName, locationById } from '../src/config/campusLocations';
import { fareFor, isParkedKeke, kekeDestinations, KOROPE, KOROPE_ID, PARKED_KEKES, ROUTE_FARE, routeStops, STOP_DWELL } from '../src/config/kekeRoutes';
import { createKeke, createKorope, createParkedKeke, departNow, bookRide, tickKeke, advanceKekeElapsed, seatPosition, seatsOf, exitPosition, type TransitState } from '../src/config/kekeSimulation';
import { normalizeAvatar } from '../src/config/avatar';
import { HELD_ITEM_KINDS, HELD_ITEM_MS, TABLE_ITEM_MS } from '../src/config/heldItems';
import { summarizeCampus } from '../src/config/campusSummary';
import { CAMPUS_BET_PICKS, CAMPUS_BET_SHOP, isValidCampusBetStake } from '../src/config/campusBet';
import { generateMatchday } from '../src/config/campusBetModel';
import { ECONOMY_CONFIG } from '../src/config/economy';
import { isCarId, isPaintId } from '../src/config/cars';
import { RACE, finishPlace, minLapMs, stepRace } from '../src/config/carRace';
import { publicCampusBetTeams } from '../src/config/campusBetTeams';
import { FEEDBACK_LIMITS, formatFeedbackMessage, parseFeedback } from '../src/config/feedback';

// Game Den: the campus PS station, how far you can wander before your match ends, and timeouts.
const PS_DEN = locationById('ps-room').entrance;
const PS_LEAVE_RADIUS = 20;
const PS_SWEEP_MS = 15_000;
const PS_WAITING_TTL_MS = 5 * 60_000;
const PS_IDLE_TTL_MS = 2 * 60_000;
const PS_FINISHED_TTL_MS = 60_000;
import {
  FOOTBALL_PITCH, FOOTBALL_RULES, createLobby, createChallenge, joinChallenge, cancelChallenge, takeMatchShot,
  takePracticeShot, expireTurn, leaveMatch, voteRematch, isFootballError, type FootballMatchState,
} from '../src/config/football';
import { BASKETBALL, BASKETBALL_COURT } from '../src/config/basketball';
import { VOLLEYBALL, VOLLEYBALL_COURT } from '../src/config/volleyball';
import { isShootoutError, type Shootout } from '../src/config/shootout';
import {
  RALLY_RULES, createRally, isRallyError, joinTeam, leaveRally, rallyAgain, rallyBusy, rallyServe, rallyTick, rallyTouch, type RallyState,
} from '../src/config/volleyRally';

// Sports Centre court games: same shootout machine, different shot model and spot.
type CourtGameId = 'basketball' | 'volleyball';
const COURT_GAMES: Record<CourtGameId, { game: Shootout<any, any>; spot: number[]; radius: number; where: string; walk: string; device: string }> = {
  basketball: {
    game: BASKETBALL, spot: BASKETBALL_COURT.shooterSpot, radius: BASKETBALL_COURT.serverRadius,
    where: 'The basketball court is at the Sports Centre.', walk: 'Walk up to the free-throw line on the basketball court.', device: 'Shoot from the device you joined with.',
  },
  volleyball: {
    game: VOLLEYBALL, spot: VOLLEYBALL_COURT.serveSpot, radius: VOLLEYBALL_COURT.serverRadius,
    where: 'The volleyball court is at the Sports Centre.', walk: 'Walk up to the serving line on the volleyball court.', device: 'Serve from the device you joined with.',
  },
};
const COURT_GAME_IDS = Object.keys(COURT_GAMES) as CourtGameId[];
import { dailyGoal, isCampusNight, lagosDay } from '../src/config/dailyPlan';
import { isInLoveGarden } from '../src/config/loveGarden';
import { POS_KIOSK, PHOTO_SPOTS, PHOTO_RULES, ERRAND_RULES } from '../src/config/hustles';
import { FARM_SHIFT, FARM_STEPS, inFarm } from '../src/config/fpyFarm';
import { BOT_HELP, BROADCAST, announcementActive, cleanAnnouncement, isBotAdmin, parseBotCommand, type Announcement } from '../src/config/broadcast';
import { ARCADE_TABLES, PARTY_HALL, TTT_TABLES, inPartyHall, partyNight, partyOpen } from '../src/config/partyHall';
import { createTtt, tttCreate, tttJoin, tttLeave, tttMove, tttRematch, tttExpire, isTttError, type TttState } from '../src/config/ticTacToe';
import { createPool, poolCreate, poolJoin, poolLeave, poolRematch, poolShoot, poolExpire, isPoolError, poolPlayers, type PoolState } from '../src/config/pool';
// Cloudflare Worker + Durable Objects Multiplayer Engine for FUNAAB Life (Production Public Beta)

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WORLD_ROOM: DurableObjectNamespace;
  SUPABASE_JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  ENABLE_GUEST_MODE?: string;
  ENVIRONMENT?: string;
  /** In-game feedback goes to this Telegram bot/chat (Cloudflare secrets). */
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  /** Telegram → campus announcements: the webhook secret, and who may send (Telegram user ids, comma separated). */
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_ADMIN_IDS?: string;
}

interface SessionData {
  connectionId: string;
  id: string; // Authoritative Supabase User UUID
  username: string;
  college: string;
  avatarConfig: any;
  room: string;
  currentLectureId?: string;
  seatNumber?: number;
  lastPacketTime: number;
  packetCount: number;
  token?: string;
  accessCheckedAt?: number;
  trustedPosition?: [number,number,number];
  /** Last position the client reported; trustedPosition chases it at the max legal speed. */
  claimedPosition?: [number,number,number];
  trustedAt?: number;
  movementBudget?: number;
  movementClock?: number;
  campusBetAt?: number;
  /** Last time this session showed a held item (rate limit). */
  heldItemAt?: number;
  footballAt?: number;
  /** Last practice shot per court game (cooldown). */
  courtAt?: Partial<Record<CourtGameId, number>>;
  /** Today's Plan progress already reported this session, keyed `${day}:${goal}`. */
  goalSent?: Record<string, number>;
  /** Open POS kiosk shift (Worker-timed; cancelled if the student walks away). */
  posShift?: { ref: string; startedAt: number };
  /** FPY farm shift: steps done in order, each at its plot and not faster than minStepSeconds. */
  farmShift?: { ref: string; startedAt: number; step: number; lastAt: number };
  /** The Arena: the night (Lagos date) this student holds a ticket for. */
  partyNight?: string;
  /** Campus Grand Prix: the lap this Worker is watching (its own clock, the trusted position, the car). */
  race?: { goAt: number; gate: number; car: string; x: number; z: number };
}

interface PlayerState {
  id: string;
  connectionId: string;
  username: string;
  college: string;
  avatarConfig: any;
  position: [number, number, number];
  rotation: number;
  animation: string;
  kekeRiding?: boolean;
  kekeId?: string;
  seatIndex?: number;
  currentZone?: string;
  currentLectureId?: string;
  seatNumber?: number;
  handRaised?: boolean;
  isDining?: boolean;
  /** The car they're driving (config/cars id), if any. */
  car?: string | null;
  /** Its respray colour id (config/cars CAR_PAINTS), or null for the model colour. Purely visual. */
  carPaint?: string | null;
  /** Getting a lift: the driver's connection id and which passenger seat (0 front, 1 back). */
  rideWith?: string | null;
  rideSeat?: number;
  lastUpdated: number;
}

type KekeState = TransitState;

interface PSMatchState {
  id: string;
  stationId: string;
  hostId: string;
  hostConnectionId: string;
  hostName: string;
  guestId?: string;
  guestConnectionId?: string;
  guestName?: string;
  status: 'waiting' | 'in_progress' | 'finished';
  currentRound: number;
  totalRounds: number;
  hostScore: number;
  guestScore: number;
  hostChoice?: string;
  guestChoice?: string;
  roundResult?: string;
  winnerName?: string;
  isDraw?: boolean;
  lastRound?: PSLastRound;
  /** Ended because a player left, disconnected, walked away or went idle. No rewards. */
  forfeit?: boolean;
  /** A waiting challenge withdrawn before anyone joined. */
  cancelled?: boolean;
  room?: string;
  updatedAt: number;
  startedAt?: number;
}

interface LectureRoomState {
  lectureId: string;
  activeStudents: Record<string, {
    connectionId: string;
    studentId: string;
    username: string;
    college: string;
    seatNumber: number;
    isHandRaised: boolean;
    joinedAt: number;
    pos?: [number, number, number]; // standing spot inside the hall (x, z, facing)
    moving?: boolean;
  }>;
  lecturerSpeech: string;
  boardText: string;
  startedAt: number;
}



function getZoneName(x: number, z: number, currentLectureId?: string): string {
  if (currentLectureId) {
    if (currentLectureId.includes('fst')) return 'In Class — Food Chemistry';
    if (currentLectureId.includes('eng')) return 'In Class — Thermodynamics';
    if (currentLectureId.includes('bio')) return 'In Class — Genetics';
    return 'In Class';
  }
  return campusZoneName(x,z);
}

interface JwksKey {
  kid: string;
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}

interface CachedKey {
  key: CryptoKey;
  alg: string;
}

// In-memory key cache keyed by kid across Durable Object requests
const keyCache = new Map<string, CachedKey>();
let jwksLastFetched = 0;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function base64UrlToUint8Array(b64Url: string): Uint8Array {
  const b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function fetchAndCacheJwks(supabaseUrl: string): Promise<void> {
  try {
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    const jwksUrl = `${cleanUrl}/auth/v1/.well-known/jwks.json`;
    const res = await fetch(jwksUrl, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[JWKS] Failed to fetch JWKS: ${res.status} ${res.statusText}`);
      return;
    }
    const data = (await res.json()) as { keys?: JwksKey[] };
    if (!data.keys || !Array.isArray(data.keys)) return;

    for (const jwk of data.keys) {
      if (!jwk.kid) continue;
      try {
        let cryptoKey: CryptoKey | null = null;
        if (jwk.kty === 'EC' && (jwk.crv === 'P-256' || !jwk.crv)) {
          cryptoKey = await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify']
          );
        } else if (jwk.kty === 'RSA') {
          cryptoKey = await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
          );
        }
        if (cryptoKey) {
          keyCache.set(jwk.kid, {
            key: cryptoKey,
            alg: jwk.alg || (jwk.kty === 'EC' ? 'ES256' : 'RS256'),
          });
        }
      } catch (err) {
        console.warn(`[JWKS] Could not import key ${jwk.kid}:`, err);
      }
    }
    jwksLastFetched = Date.now();
  } catch (err) {
    console.error('[JWKS] Network error fetching JWKS:', err);
  }
}

/**
 * Verifies Supabase JWT using Asymmetric JWKS (ES256 / P-256 or RS256).
 * Derives authoritative user identity UUID from the verified `sub` claim.
 */
export async function verifySupabaseJwt(
  token: string,
  env?: { SUPABASE_URL?: string; SUPABASE_JWT_SECRET?: string }
): Promise<{ sub: string; email?: string; role?: string } | null> {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    // 1. Verify expiration timestamp
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      console.warn('[JWT] Token expired');
      return null;
    }

    // 2. Resolve Supabase URL from environment or token issuer
    const supabaseUrl =
      env?.SUPABASE_URL ||
      (payload.iss && typeof payload.iss === 'string' && payload.iss.startsWith('http')
        ? payload.iss.replace(/\/auth\/v1\/?$/, '')
        : undefined);

    const kid = header.kid;
    const alg = header.alg || 'ES256';
    const dataToVerify = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlToUint8Array(signatureB64);

    let verified = false;

    // 3. Asymmetric verification via JWKS (ES256 / RS256)
    if (kid || alg.startsWith('ES') || alg.startsWith('RS')) {
      if (kid && !keyCache.has(kid) && supabaseUrl) {
        await fetchAndCacheJwks(supabaseUrl);
      } else if (Date.now() - jwksLastFetched > JWKS_CACHE_TTL_MS && supabaseUrl) {
        await fetchAndCacheJwks(supabaseUrl);
      }

      let cached = kid ? keyCache.get(kid) : undefined;
      if (!cached && supabaseUrl && kid) {
        await fetchAndCacheJwks(supabaseUrl);
        cached = keyCache.get(kid);
      }

      if (cached) {
        if (cached.alg.startsWith('ES') || cached.key.algorithm.name === 'ECDSA') {
          verified = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            cached.key,
            signatureBytes,
            dataToVerify
          );
        } else if (cached.alg.startsWith('RS') || cached.key.algorithm.name === 'RSASSA-PKCS1-v1_5') {
          verified = await crypto.subtle.verify(
            { name: 'RSASSA-PKCS1-v1_5' },
            cached.key,
            signatureBytes,
            dataToVerify
          );
        }
      }
    }

    // 4. Fallback to legacy HMAC SHA-256 only if alg === 'HS256' and secret is provided
    if (!verified && alg === 'HS256' && env?.SUPABASE_JWT_SECRET) {
      const keyData = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );
      verified = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, dataToVerify);
    }

    // If Supabase URL or secret is configured, require cryptographic verification
    if (!verified) {
      if (supabaseUrl || env?.SUPABASE_JWT_SECRET) {
        console.warn('[JWT] Asymmetric / Symmetric signature verification failed');
        return null;
      }
    }

    if (!payload.sub || typeof payload.sub !== 'string') return null;

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch (err) {
    console.error('[JWT] Verification error:', err);
    return null;
  }
}

export class WorldRoomDO {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<WebSocket, SessionData>;
  private players: Map<string, PlayerState>; // Keyed by connectionId
  private kekes: Map<string, KekeState>;
  private psMatches: Map<string, PSMatchState>;
  private lectureRooms: Map<string, LectureRoomState>;
  private kekeWaypointTimer: number = 0;
  private simulationTimer: ReturnType<typeof setInterval> | null = null;
  private batchBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private dirtyPlayerIds = new Set<string>();
  private kekesDirty = false;
  private restoreKekePromise: Promise<void> | null = null;
  private persistKekePromise: Promise<void> | null = null;
  // Sports Centre penalty challenge: one shared pitch, one ball, one match at a time.
  private football: FootballMatchState = createLobby(Date.now());
  private footballTimer: ReturnType<typeof setTimeout> | null = null;
  private rally: RallyState = createRally(Date.now());
  private rallyTimer: ReturnType<typeof setTimeout> | null = null;
  /** The Arena arcade: tic-tac-toe tables and the pool table. */
  private ttt: Record<string, TttState> = Object.fromEntries(TTT_TABLES.map((id) => [id, createTtt(id, Date.now())]));
  private tttTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};
  private pool: PoolState = createPool(Date.now());
  private poolTimer: ReturnType<typeof setTimeout> | null = null;
  private courts = Object.fromEntries(COURT_GAME_IDS.map((id) => [id, { state: COURT_GAMES[id].game.create(Date.now()), timer: null as ReturnType<typeof setTimeout> | null }])) as
    Record<CourtGameId, { state: any; timer: ReturnType<typeof setTimeout> | null }>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.players = new Map();
    this.kekes = new Map();
    this.psMatches = new Map();
    this.lectureRooms = new Map();

    this.kekes.set('keke-1',createKeke(false));
    for(const {id} of PARKED_KEKES)this.kekes.set(id,createParkedKeke(id));
    this.kekes.set(KOROPE_ID,createKorope());
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const attachment = typeof ws.deserializeAttachment === 'function'
      ? (ws.deserializeAttachment() as {
          initialToken?: string | null;
          boundRoom?: string;
          session?: SessionData | null;
          player?: PlayerState | null;
        } | null)
      : null;

    if (!this.sessions.has(ws) && attachment?.session && attachment?.player) {
      const { session, player } = attachment;
      this.sessions.set(ws, session);
      this.players.set(session.connectionId, player);
      this.dirtyPlayerIds.add(session.connectionId);
      this.refreshSimulationLoop();
      this.scheduleBatchBroadcast();
    }

    const handler = (ws as any).__messageHandler as ((event: { data: string }) => Promise<void>) | undefined;
    if (handler) {
      await handler({ data: raw });
      return;
    }

    if (!this.sessions.has(ws)) {
      await this.handleSession(ws, attachment?.initialToken ?? null, attachment?.boundRoom ?? 'world:funaab:main');
      const fallbackHandler = (ws as any).__messageHandler as ((event: { data: string }) => Promise<void>) | undefined;
      if (fallbackHandler) await fallbackHandler({ data: raw });
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    const cleanup = (ws as any).__cleanupHandler as (() => void) | undefined;
    if (cleanup) cleanup();
    else this.cleanupSocket(ws);
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    console.warn('[DO] WebSocket error:', error);
    const cleanup = (ws as any).__cleanupHandler as (() => void) | undefined;
    if (cleanup) cleanup();
    else this.cleanupSocket(ws);
  }

  private cleanupSocket(webSocket: WebSocket) {
    const sessionConnId = [...this.sessions.entries()].find(([ws]) => ws === webSocket)?.[1]?.connectionId ?? null;
    const matchingSession = this.sessions.get(webSocket);
    if (sessionConnId) {
      const session = this.sessions.get(webSocket);

      if (session && session.currentLectureId) {
        const roomState = this.lectureRooms.get(session.currentLectureId);
        if (roomState) {
          delete roomState.activeStudents[sessionConnId];
          this.broadcastToRoom(
            session.room,
            JSON.stringify({
              type: 'lecture_student_left',
              connectionId: sessionConnId,
            })
          );
        }
      }

      this.kekes.forEach((keke) => {
        if (keke.passengers.includes(sessionConnId)) void this.dropPassenger(keke, sessionConnId, 'refund');
      });
      this.footballDisconnect(sessionConnId, session?.id);
      this.courtsDisconnect(sessionConnId, session?.id);
      this.arcadeDisconnect(sessionConnId, session?.id);
      // A Game Den match can't wait for someone who has gone; a second open tab keeps it alive.
      if (session?.id && ![...this.sessions.entries()].some(([ws, s]) => ws !== webSocket && s.id === session.id)) this.endPSMatchesFor(session.id, 'disconnected');

      this.releaseCarRiders(sessionConnId, 'driver_left');
      this.players.delete(sessionConnId);
      this.broadcastToRoom(
        matchingSession?.room || 'world:funaab:main',
        JSON.stringify({
          type: 'player_left',
          connectionId: sessionConnId,
          id: session?.id,
        })
      );
    }
    this.sessions.delete(webSocket);
    this.refreshSimulationLoop();
    if (this.sessions.size === 0) {
      if (this.batchBroadcastTimer !== null) clearTimeout(this.batchBroadcastTimer);
      this.batchBroadcastTimer = null;
      this.dirtyPlayerIds.clear();
      this.kekesDirty = false;
    }
    if (![...this.sessions.values()].some((session) => session.room === 'world:funaab:main')) {
      this.restoreKekePromise = null;
      void this.persistAutonomousKeke().catch((error) => {
        console.error('[DO] Failed to persist autonomous Keke state:', error);
      });
    }
  }

  private startSimulationLoop() {
    if (this.simulationTimer !== null || !this.hasActiveKekeSimulation()) return;
    this.simulationTimer = setInterval(() => {
      this.tickKekeSimulation();
      this.broadcastBatchPlayers();
      if (!this.hasActiveKekeSimulation()) this.stopSimulationLoop();
    }, 100);
  }

  private hasActiveKekeSimulation() {
    return [...this.sessions.values()].some((session) => session.room === 'world:funaab:main')
      && [...this.kekes.values()].some((keke) => keke.phase !== 'IDLE' && keke.phase !== 'BLOCKED');
  }

  private refreshSimulationLoop() {
    if (this.hasActiveKekeSimulation()) this.startSimulationLoop();
    else this.stopSimulationLoop();
  }

  private stopSimulationLoop() {
    if (this.simulationTimer === null) return;
    clearInterval(this.simulationTimer);
    this.simulationTimer = null;
  }

  private scheduleBatchBroadcast() {
    if (this.batchBroadcastTimer !== null) return;
    this.batchBroadcastTimer = setTimeout(() => {
      this.batchBroadcastTimer = null;
      this.broadcastBatchPlayers();
    }, 50);
  }

  private async restoreAutonomousKeke() {
    if (this.restoreKekePromise) return this.restoreKekePromise;
    const storage = this.state?.storage;
    if (!storage || typeof storage.get !== 'function') return;

    this.restoreKekePromise = (async () => {
      await this.persistKekePromise;
      const saved = await storage.get<{ transit: TransitState; updatedAt: number }>('keke-autonomous-state');
      if (!saved) return;
      const keke = this.kekes.get('keke-1');
      if (!keke) throw new Error('Autonomous Keke state is unavailable');
      Object.assign(keke, saved.transit);

      advanceKekeElapsed(keke, saved.updatedAt, Date.now());
      this.kekesDirty = true;
    })();
    return this.restoreKekePromise;
  }

  private async persistAutonomousKeke() {
    const keke = this.kekes.get('keke-1');
    const storage = this.state?.storage;
    if (!keke || !storage || typeof storage.put !== 'function') return;
    const persist = storage.put('keke-autonomous-state', { transit: keke, updatedAt: Date.now() });
    this.persistKekePromise = persist;
    await persist;
  }

  private transitBusy=false;
  /** Students with the booking sheet open at a stop: kekeId → connectionId → { since, until }. */
  private kekeHolds=new Map<string,Map<string,{since:number;until:number}>>();
  private holdActive(kekeId:string,now:number){
    const holds=this.kekeHolds.get(kekeId);if(!holds)return false;
    let active=false;
    for(const [id,h] of [...holds]){
      if(!this.players.has(id)||h.until<=now||now-h.since>STOP_DWELL.holdMaxMs){holds.delete(id);continue;}
      active=true;
    }
    return active;
  }
  /** A student opened (or closed) the booking sheet: the vehicle waits while they choose. */
  private holdKeke(session:SessionData,data:any){
    const k=this.kekes.get(String(data.kekeId)),id=session.connectionId;
    if(!k||isParkedKeke(k.id)||!id)return;
    const holds=this.kekeHolds.get(k.id)??new Map();this.kekeHolds.set(k.id,holds);
    if(!data.holding){holds.delete(id);return;}
    this.advanceTrustedPosition(session);
    const pos=session.trustedPosition;
    if(!pos||Math.hypot(pos[0]-k.position[0],pos[2]-k.position[2])>STOP_DWELL.hailRadius||k.passengers.includes(id))return;
    const now=Date.now(),existing=holds.get(id);
    // Heartbeats renew the hold, but one student can't keep a vehicle forever.
    if(existing&&now-existing.since>STOP_DWELL.holdMaxMs)return;
    holds.set(id,{since:existing?.since??now,until:now+STOP_DWELL.holdTtlMs});
  }
  private tickKekeSimulation() {
    if(this.transitBusy)return;
    for(const k of this.kekes.values()) {
      const previousPosition = [...k.position] as [number, number, number];
      const previousRotation = k.rotation;
      const previousPhase = k.phase;
      const previousWaypoint = k.currentWaypointIndex;
      const previousDeadline = k.deadline;
      const previousStopped = k.isStopped;
      // Someone close by opened the booking sheet: a passing vehicle pulls over, and waits until
      // they pay or close the sheet. Otherwise route vehicles drive straight through.
      if(!isParkedKeke(k.id)&&this.holdActive(k.id,Date.now())){
        if(k.phase==='MOVING'){k.phase='BOARDING';k.isStopped=true;k.deadline=Date.now()+1000;}
        else if(k.phase==='BOARDING'&&k.deadline<Date.now()+1000)k.deadline=Date.now()+1000;
      }
      const arrived=tickKeke(k,Date.now(),.1);
      if (previousPosition.some((value, index) => value !== k.position[index])
        || previousRotation !== k.rotation
        || previousPhase !== k.phase
        || previousWaypoint !== k.currentWaypointIndex
        || previousDeadline !== k.deadline
        || previousStopped !== k.isStopped) this.kekesDirty = true;
      for(const id of [...k.passengers]){
        const p=this.players.get(id);if(!p)continue;
        const position=seatPosition(k,id);
        if (p.position.some((value, index) => value !== position[index]) || p.rotation !== k.rotation || p.animation !== 'sit') {
          this.dirtyPlayerIds.add(id);
        }
        p.position=position;p.rotation=k.rotation;p.animation='sit';
        for(const session of this.sessions.values())if(session.connectionId===id){session.trustedPosition=p.position;session.claimedPosition=p.position;session.trustedAt=Date.now();}
        if(arrived && k.isStopped && (isParkedKeke(k.id) || k.exitNext?.includes(id) || (k.targets[id] && Math.hypot(k.position[0]-locationById(k.targets[id]).kekeStop[0],k.position[2]-locationById(k.targets[id]).kekeStop[2])<.1))) void this.dropPassenger(k,id,'complete');
      }
      if(arrived&&k.isStopped)k.exitNext=undefined;
      if(k.phase==='BLOCKED')for(const id of [...k.passengers])void this.dropPassenger(k,id,'refund','The road ahead was blocked. Your fare was refunded.');
      if(k.id===KOROPE_ID){
        // Riders who waited too long for a full load get their fare back and the bus starts over.
        if(k.phase==='WAITING'&&k.passengers.length&&k.waitUntil&&Date.now()>=k.waitUntil){for(const id of [...k.passengers])void this.dropPassenger(k,id,'refund','The Korope did not fill up, so your fare was refunded. Try again when more students are around.');k.waitUntil=0;this.kekesDirty=true;}
        if(k.phase==='BLOCKED'&&!k.passengers.length){Object.assign(k,createKorope());this.kekesDirty=true;}
      }
    }
  }
  private async settleTicket(ticket:string,action:'complete'|'refund') {
    const key='keke-settle:'+ticket,body={p_ticket:ticket,p_action:action};
    const storage:any=this.state.storage,previous=typeof storage.get==='function'?await storage.get(key):undefined;
    await this.state.storage.put(key,{body,due:Date.now(),user:previous?.user});
    await this.state.storage.setAlarm(Date.now()+60000);
    try{await this.dbRpc('keke_settle_trusted',body);await this.state.storage.delete(key);}catch{/* Durable alarm retries idempotently. */}
  }
  private async dropPassenger(k:TransitState,id:string,action:'complete'|'refund',message?:string) {
    const ticket=k.paid[id];delete k.paid[id];delete k.targets[id];
    k.passengers=k.passengers.filter(p=>p!==id);
    const p=this.players.get(id),position=exitPosition(k);
    if(p){p.kekeRiding=false;p.kekeId=undefined;p.position=position;p.animation='idle';this.dirtyPlayerIds.add(id);}
    this.kekesDirty = true;
    for(const [socket,session] of this.sessions)if(session.connectionId===id){
      session.trustedPosition=position;session.claimedPosition=position;session.trustedAt=Date.now();session.movementBudget=4;
      socket.send(JSON.stringify({type:'keke_dropoff',position,reason:message??(action==='complete'?'Arrived':'Ride ended')}));
    }
    if(action==='refund'&&isParkedKeke(k.id)&&k.phase==='BOARDING'&&k.passengers.length===0)Object.assign(k,createParkedKeke(k.id));
    if(ticket)await this.settleTicket(ticket,action);
    this.sendToConnections([id],JSON.stringify({type:'wallet_refresh'}));
  }
  private async settleStaleTickets(userId:string) {
    const left=await this.state.storage.list<any>({prefix:'keke-settle:'});
    for(const [key,entry] of left){
      if(entry?.user!==userId)continue;
      try{await this.dbRpc('keke_settle_trusted',entry.body);await this.state.storage.delete(key);}catch{/* The durable alarm retries. */}
    }
  }
  private async boardKeke(socket:WebSocket,session:SessionData,data:any) {
    if(this.transitBusy)throw new Error('Another student is boarding. Try again.');
    if(session.room!=='world:funaab:main')throw new Error('Return to campus to ride');
    const k=this.kekes.get(data.kekeId),p=this.players.get(session.connectionId);
    if(!k||!p)throw new Error('Keke unavailable');
    if(p.kekeRiding)return {kekeId:p.kekeId};
    this.advanceTrustedPosition(session);
    // A route vehicle you hailed pulls up a few metres on, so it allows a little more room.
    const reach=isParkedKeke(k.id)?8:STOP_DWELL.hailRadius;
    if(!session.trustedPosition||Date.now()-(session.trustedAt||0)>5000||Math.hypot(session.trustedPosition[0]-k.position[0],session.trustedPosition[2]-k.position[2])>reach)throw new Error('Walk closer to the Keke');
    const korope=k.id===KOROPE_ID;
    if(k.passengers.length>=seatsOf(k))throw new Error(korope?'The Korope is full':'This Keke is full');
    if(!['IDLE','BOARDING',...(korope?['WAITING']:[])].includes(k.phase))throw new Error(korope?'The Korope is on its way. Wait at a stop.':'Wait for the Keke to stop');
    const destinationId=isParkedKeke(k.id)&&k.phase==='BOARDING'?k.destinationId:data.destinationId;
    if(!kekeDestinations.some(d=>d.id===destinationId)||destinationId==='car-park')throw new Error('Choose a campus destination');
    // Route vehicles only stop at route stops; a rider asking for anywhere else would never get off.
    if(!isParkedKeke(k.id)&&!routeStops.includes(destinationId))throw new Error('This ride does not stop there. Choose a stop on the route.');
    const fare=korope?KOROPE.fare:isParkedKeke(k.id)?fareFor(destinationId):ROUTE_FARE;
    const ticket=String(data.requestId||'');if(!/^[0-9a-f-]{36}$/i.test(ticket))throw new Error('Invalid ride request');
    this.transitBusy=true;
    try{
      // Write recovery intent before charging. A Worker restart refunds interrupted rides.
      // Rides lost to a restart leave a reserved ticket behind, and the database allows one reserved
      // ticket per student. This student isn't riding (checked above), so settle any they left behind.
      await this.settleStaleTickets(session.id);
      await this.state.storage.put('keke-settle:'+ticket,{body:{p_ticket:ticket,p_action:'refund'},due:Date.now()+600000,user:session.id});
      await this.state.storage.setAlarm(Date.now()+60000);
      let receipt:any;
      try{receipt=await this.dbRpc('keke_reserve_trusted',{p_ticket:ticket,p_user:session.id,p_destination:destinationId,p_fare:fare});}
      catch(e){
        if(/one_reserved_keke_ticket/.test(String((e as Error).message)))throw new Error('Your last ride is still being settled. Try again in a minute.');
        throw e;
      }
      if(socket.readyState!==WebSocket.OPEN||!this.players.has(session.connectionId)){
        await this.settleTicket(ticket,'refund');throw new Error('Ride cancelled after disconnect');
      }
      if(k.phase==='IDLE')bookRide(k,destinationId,Date.now(),crypto.randomUUID());
      if(korope&&k.phase==='WAITING'&&!k.passengers.length)k.waitUntil=Date.now()+KOROPE.waitMs;
      this.kekeHolds.get(k.id)?.delete(session.connectionId);
      // Time to sit down: a route vehicle doesn't pull away the instant someone pays.
      if(k.phase==='BOARDING'&&!isParkedKeke(k.id))k.deadline=Math.max(k.deadline,Date.now()+STOP_DWELL.boardedGraceMs);
      k.passengers.push(session.connectionId);k.paid[session.connectionId]=ticket;k.targets[session.connectionId]=destinationId;
      p.kekeRiding=true;p.kekeId=k.id;p.animation='sit';p.position=seatPosition(k,session.connectionId);
      this.dirtyPlayerIds.add(session.connectionId);
      this.kekesDirty = true;
      this.refreshSimulationLoop();
      this.broadcastBatchPlayers();
      return {kekeId:k.id,destinationId,fare,balance:receipt.balance};
    }finally{this.transitBusy=false;}
  }

  private broadcastBatchPlayers() {
    if (this.sessions.size === 0) return;
    if (this.dirtyPlayerIds.size === 0 && !this.kekesDirty) return;
    const updates: Record<string, any> = {};
    for (const connId of this.dirtyPlayerIds) {
      const player = this.players.get(connId);
      if (!player) continue;
      updates[connId] = {
        id: player.id,
        connectionId: connId,
        username: player.username,
        college: player.college,
        position: player.position,
        rotation: player.rotation,
        animation: player.animation,
        kekeRiding: player.kekeRiding,
        kekeId: player.kekeId,
        car: player.car ?? null,
        carPaint: player.carPaint ?? null,
        rideWith: player.rideWith ?? null,
        rideSeat: player.rideSeat ?? null,
        // null (not undefined) so clients clear it when a student walks out of a hall.
        currentLectureId: player.currentLectureId ?? null,
        currentZone: player.currentLectureId
          ? getZoneName(0, 0, player.currentLectureId)
          : (player.currentZone || getZoneName(player.position?.[0] || 0, player.position?.[2] || 0)),
      };
    }

    const batch: Record<string, unknown> = {
      type: 'players_batch',
      updates,
    };
    if (this.kekesDirty) batch.kekes = Object.fromEntries(this.kekes);
    const payload = JSON.stringify(batch);

    let sendFailed = false;
    for (const [ws, session] of this.sessions) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (e) {
          sendFailed = true;
        }
      }
    }
    if (!sendFailed) {
      this.dirtyPlayerIds.clear();
      this.kekesDirty = false;
    }
  }

  private async dbRpc(name: string, body: object, token?: string): Promise<any> {
    const key = this.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('Hostel/jobs backend setup is not ready');
    const res = await fetch(`${this.env.SUPABASE_URL || 'https://gtaobbqkwcigsnbovbjo.supabase.co'}/rest/v1/rpc/${name}`, {
      method:'POST', signal:AbortSignal.timeout(10000), headers:{apikey:key,Authorization:`Bearer ${token || key}`,'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    const result: any = await res.json();
    if (!res.ok) throw new Error(result.message || 'Student service unavailable');
    return result;
  }
  private async checkRoom(room: string, user: string) {
    if (!room.startsWith('world:funaab:hostel-room:')) return true;
    return this.dbRpc('hostel_can_enter',{p_owner:room.split(':')[3],p_guest:user});
  }
  /**
   * Speed-limited anti-teleport: the trusted position moves toward the client's last claim at
   * most 35 m/s. Leftover budget is capped at 8 m so idling can't bank a burst, but a lagging
   * trusted position keeps catching up over time. Previously a reconnect (trusted reset to spawn
   * while the client stayed put) froze the trusted position forever, breaking jobs, keke and bets.
   */
  /** Everyone getting a lift from this driver gets out (driver parked, left or disconnected). */
  private releaseCarRiders(driverConn: string, reason: string) {
    const out: string[] = [];
    for (const [id, p] of this.players) if (p.rideWith === driverConn) { p.rideWith = null; p.rideSeat = undefined; this.dirtyPlayerIds.add(id); out.push(id); }
    if (out.length) { this.sendToConnections(out, JSON.stringify({ type: 'car_ride_end', reason })); this.scheduleBatchBroadcast(); }
  }

  /**
   * Follows a Grand Prix lap on the trusted position: stay on the grid until the lights go green,
   * keep to the same car, pass every checkpoint in order, then the database pays the prize for the
   * place this clock gives (never faster than the car can go).
   */
  private raceMove(session: SessionData, webSocket: WebSocket, car: string | null) {
    const race = session.race, pos = session.trustedPosition;
    if (!race || !pos) return;
    const now = Date.now();
    const fail = (reason: string) => { session.race = undefined; webSocket.send(JSON.stringify({ type: 'race_result', ok: false, reason })); };
    if (car !== race.car) return fail('you got out of your car.');
    if (now < race.goAt) {
      const grid = RACE.track[0];
      if (Math.hypot(pos[0] - grid[0], pos[2] - grid[2]) > RACE.startRadius + 3) fail('you jumped the start.');
      return;
    }
    const step = stepRace(race.gate, race.x, race.z, pos[0], pos[2]);
    Object.assign(race, { gate: step.gate, x: pos[0], z: pos[2] });
    if (step.finished) {
      session.race = undefined;
      // A little grace for the trip from your phone to here, which this clock can't see.
      const ms = Math.max(0, now - race.goAt - 250);
      if (ms < minLapMs(race.car)) return fail('that lap was faster than your car can go.');
      const place = finishPlace(ms);
      void this.dbRpc('race_reward_trusted', { p_user: session.id, p_car: race.car, p_place: place, p_ms: ms })
        .then((r: any) => webSocket.send(JSON.stringify({ type: 'race_result', ok: true, place, ms, prize: Number(r.prize) || 0, paidToday: Number(r.paid_today) || 0, balance: r.balance == null ? undefined : Number(r.balance) })))
        .catch((e: Error) => webSocket.send(JSON.stringify({ type: 'race_result', ok: false, reason: /not your car/i.test(e.message) ? 'prizes are for cars you own.' : 'the prize service is busy. Try another lap later.' })));
      return;
    }
    if (step.off) fail('you left the race route.');
  }

  private advanceTrustedPosition(session: SessionData, now = Date.now()) {
    const claimed = session.claimedPosition;
    if (!claimed) return;
    const previous = session.trustedPosition || CAMPUS_SPAWN;
    const elapsed = Math.max(0, (now - (session.movementClock || now)) / 1000);
    const budget = (session.movementBudget ?? 4) + elapsed * 35;
    const distance = Math.hypot(claimed[0] - previous[0], claimed[2] - previous[2]);
    session.movementClock = now;
    session.trustedAt = now;
    if (distance <= budget) {
      session.trustedPosition = claimed;
      session.movementBudget = Math.min(8, budget - distance);
    } else {
      const f = budget / distance;
      session.trustedPosition = [previous[0] + (claimed[0] - previous[0]) * f, claimed[1], previous[2] + (claimed[2] - previous[2]) * f];
      session.movementBudget = 0;
    }
  }
  // Campus Bet: the database owns the lifecycle; this DO only supplies freshly generated
  // fixtures (secure randomness, hidden strengths) and relays a player's ticket.
  private async campusBetSync(user: string | null) {
    let state = await this.dbRpc('campus_bet_sync_trusted', { p_user: user, p_candidate: null });
    if (state.needs_round) {
      state = await this.dbRpc('campus_bet_sync_trusted', { p_user: user, p_candidate: generateMatchday(state.recent_pairs || []) });
    }
    if (state.settled > 0) this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'campus_bet_settled' }));
    if (state.current?.status === 'OPEN') await this.scheduleCampusBetSettlement(Date.parse(state.current.closes_at));
    const { needs_round, recent_pairs, settled, ...view } = state;
    return { ...view, teams: publicCampusBetTeams() };
  }
  private async scheduleCampusBetSettlement(closesAt: number) {
    const storage = this.state?.storage;
    if (!storage || typeof storage.get !== 'function' || !Number.isFinite(closesAt)) return;
    const due = closesAt + 1000;
    if ((await storage.get<number>('campus-bet-settle-at')) === due) return;
    await storage.put('campus-bet-settle-at', due);
    await this.ensureAlarmBy(due);
  }
  /** Other features overwrite the single DO alarm; never push an earlier alarm later. */
  private async ensureAlarmBy(at: number) {
    const storage = this.state.storage;
    const existing = typeof storage.getAlarm === 'function' ? await storage.getAlarm() : null;
    if (existing == null || existing > at) await storage.setAlarm(at);
  }
  private async campusBetCommand(session: SessionData, data: any) {
    if (session.room !== 'world:funaab:main') throw new Error('Campus Bet is just outside the main gate.');
    const now = Date.now();
    if (now - (session.campusBetAt || 0) < 1000) throw new Error('One moment — the attendant is still printing.');
    session.campusBetAt = now;
    if (data.op !== 'place') return this.campusBetSync(session.id);
    // Only the round, stake and picks come from the client; results and payouts never do.
    this.advanceTrustedPosition(session);
    const pos = session.trustedPosition;
    if (!pos || Math.hypot(pos[0] - CAMPUS_BET_SHOP.counter[0], pos[2] - CAMPUS_BET_SHOP.counter[2]) > CAMPUS_BET_SHOP.serverRadius) {
      throw new Error('Walk up to the Campus Bet counter to place a ticket.');
    }
    const stake = data.stake;
    if (!isValidCampusBetStake(stake)) throw new Error('Stake must be ₦500–₦5,000 in ₦100 steps.');
    const picks = data.picks;
    if (!Array.isArray(picks) || picks.length !== 5 || !picks.every((p) => CAMPUS_BET_PICKS.includes(p))) throw new Error('Pick a result for all 5 matches.');
    const roundId = String(data.roundId || '');
    if (!/^[0-9a-f-]{36}$/i.test(roundId)) throw new Error('Matchday not found.');
    const receipt = await this.dbRpc('campus_bet_place_trusted', { p_user: session.id, p_round: roundId, p_stake: stake, p_picks: picks });
    return { ...(await this.campusBetSync(session.id)), balance: Number(receipt.balance) };
  }
  private setFootball(next: FootballMatchState) {
    const prev = this.football;
    this.football = next;
    // College League: a played-out win (not a forfeit) earns the winner's college points, once per match.
    if (prev.status === 'ACTIVE' && next.status === 'RESULT' && next.endReason === 'complete' && next.winnerUserId && this.env.SUPABASE_SERVICE_ROLE_KEY)
      void this.dbRpc('league_event_trusted', { p_user: next.winnerUserId, p_kind: 'football_win', p_ref: next.id }).catch(() => {});
    if (this.footballTimer !== null) clearTimeout(this.footballTimer);
    this.footballTimer = null;
    if (next.status === 'ACTIVE' && next.turnDeadline) {
      this.footballTimer = setTimeout(() => {
        this.footballTimer = null;
        const expired = expireTurn(this.football, Date.now());
        if (expired) this.setFootball(expired);
      }, Math.max(0, next.turnDeadline - Date.now()) + 50);
    }
    this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'football_state', football: next }));
  }
  /** Penalty challenge: the client supplies only aim + power; turns, results and score are decided here. */
  private footballCommand(session: SessionData, data: any) {
    if (session.room !== 'world:funaab:main') throw new Error('The penalty challenge is at the Sports Centre.');
    const now = Date.now();
    const op = String(data.op || 'state');
    if (op === 'state') return this.football;
    const me = { userId: session.id, connectionId: session.connectionId, name: session.username };
    if (['practice', 'create', 'join', 'shoot'].includes(op)) {
      this.advanceTrustedPosition(session);
      const pos = session.trustedPosition, spot = FOOTBALL_PITCH.penaltySpot;
      if (!pos || Math.hypot(pos[0] - spot[0], pos[2] - spot[2]) > FOOTBALL_PITCH.serverRadius) throw new Error('Walk up to the penalty spot at the Sports Centre.');
    }
    const shot = { aim: data.aim, power: data.power };
    let next: FootballMatchState | { error: string } | null;
    switch (op) {
      case 'practice':
        if (now - (session.footballAt || 0) < FOOTBALL_RULES.PRACTICE_COOLDOWN_MS) throw new Error('Wait for the ball to come back.');
        next = takePracticeShot(this.football, me, shot, Math.random, now);
        if (!isFootballError(next)) session.footballAt = now;
        break;
      case 'create': next = createChallenge(this.football, me, crypto.randomUUID(), now); break;
      case 'join': next = joinChallenge(this.football, me, String(data.matchId || ''), now); break;
      case 'cancel': next = cancelChallenge(this.football, me.userId, now); break;
      case 'shoot':
        // Only the shooter's own socket may kick (a second tab cannot shoot for them).
        if (this.football.status === 'ACTIVE' && this.football.turnUserId === me.userId
          && ![this.football.player1, this.football.player2].some((p) => p?.connectionId === me.connectionId)) throw new Error('Shoot from the device you joined with.');
        next = takeMatchShot(this.football, me.userId, shot, Math.random, now);
        break;
      case 'rematch': next = voteRematch(this.football, me.userId, now, crypto.randomUUID()); break;
      case 'leave': next = leaveMatch(this.football, me.userId, now) ?? this.football; break;
      default: throw new Error('Unknown football action.');
    }
    if (isFootballError(next)) throw new Error(next.error);
    if (next !== this.football) this.setFootball(next);
    if (op === 'practice' || op === 'shoot') this.dailyGoalEvent(session, 'take_penalties');
    return this.football;
  }
  /** XP for results only the Worker knows (migration 031); the database caps and dedupes. */
  private awardXp(userId: string, source: 'court_match' | 'court_win' | 'rally_match' | 'rally_win' | 'arcade_match' | 'arcade_win', ref: string) {
    if (!this.env.SUPABASE_SERVICE_ROLE_KEY) return;
    void this.dbRpc('xp_event_trusted', { p_user: userId, p_source: source, p_ref: ref }).then((xp) => {
      if (!xp) return;
      const ids = [...this.sessions.values()].filter((s) => s.id === userId).map((s) => s.connectionId);
      this.sendToConnections(ids, JSON.stringify({ type: 'level_refresh' }));
    }).catch(() => {});
  }
  private setCourt(id: CourtGameId, next: any) {
    const court = this.courts[id];
    // A played-out 1v1 earns both players XP and the winner a little more; forfeits earn nothing.
    if (court.state?.status === 'ACTIVE' && next.status === 'RESULT' && next.endReason === 'complete' && next.id) {
      for (const p of [next.player1, next.player2]) if (p?.userId) this.awardXp(p.userId, 'court_match', `${id}:${next.id}`);
      if (next.winnerUserId) this.awardXp(next.winnerUserId, 'court_win', `${id}:${next.id}`);
    }
    court.state = next;
    if (court.timer !== null) clearTimeout(court.timer);
    court.timer = null;
    if (next.status === 'ACTIVE' && next.turnDeadline) {
      court.timer = setTimeout(() => {
        court.timer = null;
        const expired = COURT_GAMES[id].game.expire(court.state, Date.now());
        if (expired) this.setCourt(id, expired);
      }, Math.max(0, next.turnDeadline - Date.now()) + 50);
    }
    this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: `${id}_state`, [id]: next }));
  }
  /** Court games (free throws, serves): the client supplies only aim + power; turns, results and score are decided here. */
  private courtCommand(id: CourtGameId, session: SessionData, data: any) {
    const { game, spot, radius, where, walk, device } = COURT_GAMES[id];
    if (session.room !== 'world:funaab:main') throw new Error(where);
    const now = Date.now();
    const op = String(data.op || 'state');
    const current = this.courts[id].state;
    if (op === 'state') return current;
    const me = { userId: session.id, connectionId: session.connectionId, name: session.username };
    if (['practice', 'create', 'join', 'shoot'].includes(op)) {
      this.advanceTrustedPosition(session);
      const pos = session.trustedPosition;
      if (!pos || Math.hypot(pos[0] - spot[0], pos[2] - spot[2]) > radius) throw new Error(walk);
      // One volleyball court: the serve challenge waits while a 2v2 rally is on.
      if (id === 'volleyball' && op !== 'shoot' && rallyBusy(this.rally)) throw new Error('A 2v2 rally is on the court. Serve after it finishes.');
    }
    const shot = { aim: data.aim, power: data.power };
    let next: any;
    switch (op) {
      case 'practice':
        if (now - (session.courtAt?.[id] || 0) < game.rules.PRACTICE_COOLDOWN_MS) throw new Error('Wait for the ball to come back.');
        next = game.practice(current, me, shot, Math.random, now);
        if (!isShootoutError(next)) session.courtAt = { ...session.courtAt, [id]: now };
        break;
      case 'create': next = game.createChallenge(current, me, crypto.randomUUID(), now); break;
      case 'join': next = game.join(current, me, String(data.matchId || ''), now); break;
      case 'cancel': next = game.cancel(current, me.userId, now); break;
      case 'shoot':
        // Only the player's own socket may shoot (a second tab cannot play for them).
        if (current.status === 'ACTIVE' && current.turnUserId === me.userId
          && ![current.player1, current.player2].some((p: any) => p?.connectionId === me.connectionId)) throw new Error(device);
        next = game.take(current, me.userId, shot, Math.random, now);
        break;
      case 'rematch': next = game.rematch(current, me.userId, now, crypto.randomUUID()); break;
      case 'leave': next = game.leave(current, me.userId, now) ?? current; break;
      default: throw new Error(`Unknown ${id} action.`);
    }
    if (isShootoutError(next)) throw new Error(next.error);
    if (next !== current) this.setCourt(id, next);
    return this.courts[id].state;
  }
  /**
   * Today's Plan: report progress the database cannot see (positions, shots, visits). Each
   * session reports a goal at most up to its target per Lagos day; the database caps it again.
   */
  private dailyGoalEvent(session: SessionData, kind: string) {
    const goal = dailyGoal(kind);
    if (!goal || goal.source !== 'worker' || !this.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const key = `${lagosDay(Date.now())}:${kind}`;
    const sent = (session.goalSent ??= {})[key] ?? 0;
    if (sent >= goal.target) return;
    session.goalSent[key] = sent + 1;
    void this.dbRpc('daily_goal_event_trusted', { p_user: session.id, p_kind: kind, p_amount: 1 })
      .then(() => this.sendToConnections([session.connectionId], JSON.stringify({ type: 'daily_plan_refresh' })))
      .catch(() => { if (session.goalSent) session.goalSent[key] = sent; });
  }
  /**
   * Hustles that need proof of place or time. Amounts are fixed here or derived from the world;
   * the database applies caps, cooldowns and idempotency again.
   */
  private async hustleCommand(session: SessionData, data: any) {
    const op = String(data.op || '');
    const now = Date.now();
    const near = (p: readonly number[] | undefined, q: readonly number[], r: number) => !!p && Math.hypot(p[0] - q[0], p[2] - q[2]) <= r;
    if (op === 'tutor_start' || op === 'tutor_submit') {
      if (session.room !== LIBRARY_ROOM) throw new Error('Tutoring happens in the Library.');
      if (op === 'tutor_start') return this.dbRpc('tutoring_start_trusted', { p_user: session.id });
      const answers: Record<string, number> = {};
      for (const [k, v] of Object.entries(data.answers ?? {})) if (/^[a-z0-9-]{1,32}$/.test(k) && Number.isInteger(v)) answers[k] = Number(v);
      if (!/^[0-9a-f-]{36}$/i.test(String(data.session))) throw new Error('No tutoring session');
      const r = await this.dbRpc('tutoring_submit_trusted', { p_user: session.id, p_session: data.session, p_answers: answers });
      this.sendToConnections([session.connectionId], JSON.stringify({ type: 'wallet_refresh' }));
      return r;
    }
    if (session.room !== 'world:funaab:main') throw new Error('Return to campus for this hustle.');
    this.advanceTrustedPosition(session);
    const pos = session.trustedPosition;
    switch (op) {
      case 'pos_start':
        if (!near(pos, POS_KIOSK.serviceSpot, POS_KIOSK.radius)) throw new Error('Stand at the POS kiosk outside the Microfinance Bank.');
        session.posShift ??= { ref: crypto.randomUUID(), startedAt: now };
        return { endsAt: session.posShift.startedAt + POS_KIOSK.shiftSeconds * 1000 };
      case 'pos_finish': {
        const shift = session.posShift;
        if (!shift) throw new Error('Start a shift first.');
        if (!near(pos, POS_KIOSK.serviceSpot, POS_KIOSK.radius)) { session.posShift = undefined; throw new Error('You left the kiosk, so the shift was cancelled.'); }
        if (now - shift.startedAt < POS_KIOSK.shiftSeconds * 1000) throw new Error('Finish serving customers first.');
        session.posShift = undefined;
        const paid = await this.dbRpc('hustle_pay_trusted', { p_user: session.id, p_hustle: 'pos', p_ref: shift.ref, p_amount: POS_KIOSK.pay });
        this.sendToConnections([session.connectionId], JSON.stringify({ type: 'wallet_refresh' }));
        return { paid };
      }
      case 'farm_start': {
        if (!inFarm(pos)) throw new Error('Go to the FPY farm to start a shift.');
        const s = session.farmShift;
        if (!s || now - s.startedAt > FARM_SHIFT.expireMinutes * 60000) session.farmShift = { ref: crypto.randomUUID(), startedAt: now, step: 0, lastAt: now };
        return { step: session.farmShift!.step };
      }
      case 'farm_step': {
        const s = session.farmShift;
        if (!s || now - s.startedAt > FARM_SHIFT.expireMinutes * 60000) { session.farmShift = undefined; throw new Error('Start a farm shift first.'); }
        const step = FARM_STEPS[s.step];
        if (!near(pos, step.spot, FARM_SHIFT.stepRadius)) throw new Error(`Go to the ${step.icon} plot to ${step.label.toLowerCase()}.`);
        if (now - s.lastAt < FARM_SHIFT.minStepSeconds * 1000) throw new Error('Take your time — finish the job properly.');
        s.step++; s.lastAt = now;
        if (s.step < FARM_STEPS.length) return { step: s.step };
        session.farmShift = undefined;
        const paid = await this.dbRpc('hustle_pay_trusted', { p_user: session.id, p_hustle: 'farm', p_ref: s.ref, p_amount: FARM_SHIFT.pay });
        this.sendToConnections([session.connectionId], JSON.stringify({ type: 'wallet_refresh' }));
        return { step: s.step, paid };
      }
      case 'photo': {
        const spot = PHOTO_SPOTS.find((p) => p.id === data.spot);
        if (!spot || !near(pos, spot.position, spot.radius)) throw new Error('Go to a photo spot (Love Garden or Sports Centre).');
        // Clients: other real students standing near the spot (their trusted positions).
        const clients = new Set<string>();
        for (const peer of this.sessions.values())
          if (peer.id !== session.id && peer.room === session.room && near(peer.trustedPosition, spot.position, PHOTO_RULES.clientRadius)) clients.add(peer.id);
        const n = Math.min(PHOTO_RULES.maxClients, clients.size);
        const paid = await this.dbRpc('hustle_pay_trusted', { p_user: session.id, p_hustle: 'photo', p_ref: crypto.randomUUID(), p_amount: PHOTO_RULES.base + PHOTO_RULES.perClient * n });
        this.sendToConnections([session.connectionId], JSON.stringify({ type: 'wallet_refresh' }));
        return { paid, clients: n };
      }
      case 'errand_handover': {
        const id = String(data.errand || '');
        if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Unknown errand');
        const e = await this.dbRpc('errand_for_trusted', { p_errand: id });
        if (!e || e.status !== 'accepted' || e.runner !== session.id) throw new Error('This errand is not yours to hand over.');
        const poster = [...this.sessions.values()].find((p) => p.id === e.poster && p.room === session.room);
        if (!poster) throw new Error('The student who posted it is not on campus right now.');
        this.advanceTrustedPosition(poster);
        if (!pos || !near(poster.trustedPosition, pos, ERRAND_RULES.handoverRadius)) throw new Error('Walk up to them to hand it over.');
        const r = await this.dbRpc('errand_complete_trusted', { p_errand: id, p_runner: session.id });
        this.sendToConnections([session.connectionId, poster.connectionId], JSON.stringify({ type: 'wallet_refresh' }));
        this.sendToConnections([poster.connectionId], JSON.stringify({ type: 'hustle_notice', icon: '✅', text: `@${session.username} finished your errand` }));
        return r;
      }
      default: throw new Error('Unknown hustle.');
    }
  }
  /** Love Garden goals, from the trusted (speed-limited) position, never the client's claim. */
  private loveGardenGoals(session: SessionData, animation: string) {
    const pos = session.trustedPosition;
    if (session.room !== 'world:funaab:main' || !pos || !isInLoveGarden(pos[0], pos[2])) return;
    this.dailyGoalEvent(session, 'visit_love_garden');
    if (isCampusNight(Date.now())) this.dailyGoalEvent(session, 'campus_night');
    if (animation === 'sit' && [...this.players.values()].some((p) => p.connectionId !== session.connectionId && p.id !== session.id
      && p.animation === 'sit' && !p.kekeRiding && isInLoveGarden(p.position[0], p.position[2]))) this.dailyGoalEvent(session, 'garden_hangout');
  }
  /** In-game feedback → the team's Telegram chat. Identity and place come from the session, not the client. */
  private async feedbackCommand(session: SessionData, data: any) {
    const token = this.env.TELEGRAM_BOT_TOKEN, chat = this.env.TELEGRAM_CHAT_ID;
    if (!token || !chat) throw new Error('Feedback is not switched on yet. Please try again later.');
    const input = parseFeedback(data);
    if ('error' in input) throw new Error(input.error);
    const now = Date.now(), key = 'feedback-rate:' + session.id;
    const recent = ((await this.state.storage.get<number[]>(key)) || []).filter((t) => now - t < 3600_000);
    if (recent.length && now - recent[recent.length - 1] < FEEDBACK_LIMITS.gapMs) throw new Error('Thanks! Give it a few seconds before sending another.');
    if (recent.length >= FEEDBACK_LIMITS.perHour) throw new Error('You have sent a lot this hour. Please try again a bit later.');
    this.advanceTrustedPosition(session);
    const pos = session.trustedPosition;
    const place = session.room === 'world:funaab:main' ? (pos ? campusZoneName(pos[0], pos[2]) : 'Campus')
      : session.room === LIBRARY_ROOM ? 'Library' : session.room.includes('hostel') ? 'Hostel'
      : session.room.startsWith('world:funaab:lecture:') ? 'Lecture hall' : 'Off campus';
    const text = formatFeedbackMessage(input, { username: session.username, college: session.college, place }, new Date(now));
    let ok = false;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      ok = res.ok;
      if (!ok) console.error('[FEEDBACK] Telegram rejected the message', res.status, (await res.text()).slice(0, 200));
    } catch (e) { console.error('[FEEDBACK] Telegram unreachable', e); }
    // Failed sends don't count against the player's limit.
    if (!ok) throw new Error("Couldn't send right now. Please try again in a minute.");
    await this.state.storage.put(key, [...recent, now]);
    return { sent: true };
  }
  // ── Game Den match lifecycle: leaving, disconnects, walking away, idle and stale matches ──
  private psSweepTimer: ReturnType<typeof setInterval> | null = null;
  private ensurePSSweep() {
    if (this.psSweepTimer !== null) return;
    this.psSweepTimer = setInterval(() => this.sweepPSMatches(), PS_SWEEP_MS);
  }
  private sweepPSMatches(now = Date.now()) {
    for (const m of [...this.psMatches.values()]) {
      const idle = now - m.updatedAt;
      if (m.status === 'waiting' && idle > PS_WAITING_TTL_MS) this.endPSMatch(m, null, 'expired');
      else if (m.status === 'in_progress' && idle > PS_IDLE_TTL_MS) {
        // Whoever has not picked is the one who went quiet; if neither did, nobody wins.
        const idlePlayer = m.hostChoice && !m.guestChoice ? 'guest' : m.guestChoice && !m.hostChoice ? 'host' : null;
        this.endPSMatch(m, idlePlayer, 'idle');
      } else if (m.status === 'finished' && idle > PS_FINISHED_TTL_MS) this.psMatches.delete(m.id);
    }
    if (this.psMatches.size === 0 && this.psSweepTimer !== null) {
      clearInterval(this.psSweepTimer);
      this.psSweepTimer = null;
    }
  }
  /** End every unfinished match this user is in (they left, disconnected or walked away). */
  private endPSMatchesFor(userId: string, reason: 'left' | 'disconnected' | 'walked_away') {
    for (const m of [...this.psMatches.values()]) {
      if (m.status === 'finished' || (m.hostId !== userId && m.guestId !== userId)) continue;
      this.endPSMatch(m, m.hostId === userId ? 'host' : 'guest', reason);
    }
  }
  /** Waiting challenges are withdrawn; running matches go to the other player by forfeit. No rewards either way. */
  private endPSMatch(m: PSMatchState, leaver: 'host' | 'guest' | null, reason: 'left' | 'disconnected' | 'walked_away' | 'idle' | 'expired') {
    const room = m.room || 'world:funaab:main';
    m.status = 'finished';
    m.updatedAt = Date.now();
    if (!m.guestId) {
      m.cancelled = true;
      m.roundResult = reason === 'expired' ? 'Challenge expired: nobody joined.' : 'Challenge cancelled.';
      this.broadcastToRoom(room, JSON.stringify({ type: 'ps_match_update', match: m }));
      this.psMatches.delete(m.id);
      return;
    }
    m.forfeit = true;
    m.isDraw = false;
    const leaverName = leaver === 'host' ? m.hostName : leaver === 'guest' ? m.guestName : null;
    m.winnerName = leaver === 'host' ? m.guestName : leaver === 'guest' ? m.hostName : undefined;
    m.roundResult = !leaverName ? 'Match ended: nobody played for 2 minutes.'
      : reason === 'walked_away' ? `${leaverName} walked away from the Game Den.`
        : reason === 'idle' ? `${leaverName} stopped playing.`
          : `${leaverName} left the match.`;
    this.broadcastToRoom(room, JSON.stringify({ type: 'ps_match_update', match: m }));
  }
  private setRally(next: RallyState) {
    if (this.rally?.status === 'ACTIVE' && next.status === 'RESULT' && next.endReason === 'complete' && next.id) {
      for (const [team, players] of Object.entries(next.teams))
        for (const p of players) if (!p.bot && p.userId) {
          this.awardXp(p.userId, 'rally_match', next.id);
          if (next.winner === team) this.awardXp(p.userId, 'rally_win', next.id);
        }
    }
    this.rally = next;
    this.armRally();
    this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'volleyball_rally_state', rally: next }));
  }
  /** One timer for the rally clock: point pauses, CPU moves, time running out, result clearing. */
  private armRally() {
    if (this.rallyTimer !== null) clearTimeout(this.rallyTimer);
    this.rallyTimer = null;
    const wakeAt = this.rally.wakeAt;
    if (wakeAt === null) return;
    this.rallyTimer = setTimeout(() => {
      this.rallyTimer = null;
      const next = rallyTick(this.rally, Date.now(), Math.random);
      if (next) this.setRally(next);
      else if (Date.now() < (this.rally.wakeAt ?? 0)) this.armRally(); // woke a little early
    }, Math.max(0, wakeAt - Date.now()) + 30);
  }
  /** 2v2 volleyball: clients send a serve (aim + power) or a touch (action + timing); the rally is decided here. */
  private rallyCommand(session: SessionData, data: any) {
    if (session.room !== 'world:funaab:main') throw new Error('The volleyball court is at the Sports Centre.');
    const now = Date.now();
    const op = String(data.op || 'state');
    if (op === 'state') return this.rally;
    const me = { userId: session.id, connectionId: session.connectionId, name: session.username };
    let next: RallyState | { error: string } | null;
    switch (op) {
      case 'join': {
        this.advanceTrustedPosition(session);
        const pos = session.trustedPosition, c = VOLLEYBALL_COURT.centre;
        if (!pos || Math.hypot(pos[0] - c[0], pos[2] - c[2]) > RALLY_RULES.JOIN_RADIUS) throw new Error('Walk over to the volleyball court to join a team.');
        if (this.courts.volleyball.state.status === 'ACTIVE') throw new Error('A serve-off is on the court. Join after it finishes.');
        next = joinTeam(this.rally, me, data.team, crypto.randomUUID(), now);
        break;
      }
      case 'leave': next = leaveRally(this.rally, me.userId, now) ?? this.rally; break;
      case 'again': next = rallyAgain(this.rally, me.userId, crypto.randomUUID(), now); break;
      case 'serve':
      case 'touch': {
        // Only the player's own socket may play (a second tab cannot play for them).
        const mine = [...this.rally.teams.A, ...this.rally.teams.B].find((p) => p.userId === me.userId);
        if (mine && mine.connectionId !== me.connectionId) throw new Error('Play from the device you joined with.');
        const input = op === 'serve' ? { aim: data.aim, power: data.power } : { action: data.action, timing: data.timing };
        next = op === 'serve' ? rallyServe(this.rally, me.userId, input, Math.random, now) : rallyTouch(this.rally, me.userId, input, Math.random, now);
        break;
      }
      default: throw new Error('Unknown rally action.');
    }
    if (isRallyError(next)) throw new Error(next.error);
    if (next !== this.rally) this.setRally(next);
    return this.rally;
  }
  /** The Arena door: sell (or re-check) tonight's ticket. The database charges once per night. */
  private async partyCommand(session: SessionData, data: any) {
    if (String(data.op) !== 'enter') throw new Error('Unknown party action');
    if (session.room !== 'world:funaab:main') throw new Error('The Arena is on campus.');
    if (!partyOpen(Date.now())) throw new Error('The Arena opens at 7 PM.');
    this.advanceTrustedPosition(session);
    const pos = session.trustedPosition;
    const atDoor = !!pos && Math.hypot(pos[0] - PARTY_HALL.entrance[0], pos[2] - PARTY_HALL.entrance[2]) <= 6;
    if (!atDoor && !inPartyHall(pos)) throw new Error('Go to The Arena door to get in.');
    const r = await this.dbRpc('party_entry_trusted', { p_user: session.id });
    session.partyNight = String(r?.night ?? partyNight(Date.now()));
    if (r?.charged) this.sendToConnections([session.connectionId], JSON.stringify({ type: 'wallet_refresh' }));
    return { night: session.partyNight, charged: !!r?.charged };
  }
  /** Tic-tac-toe and pool: only ticket holders inside The Arena, at the table, while it is open. */
  private arcadeCommand(session: SessionData, data: any) {
    const table = ARCADE_TABLES.find((t) => t.id === data.table);
    if (!table) throw new Error('Unknown table');
    const op = String(data.op || 'state');
    const now = Date.now();
    if (op === 'state') return table.game === 'pool' ? this.pool : this.ttt[table.id];
    if (op !== 'leave') {
      if (session.room !== 'world:funaab:main' || !partyOpen(now)) throw new Error('The Arena is closed. It opens at 7 PM.');
      if (session.partyNight !== partyNight(now)) throw new Error('Show your ticket at the door first.');
      this.advanceTrustedPosition(session);
      const pos = session.trustedPosition;
      if (!inPartyHall(pos) || !pos || Math.hypot(pos[0] - table.at[0], pos[2] - table.at[2]) > 4.5) throw new Error(`Walk up to the ${table.label.toLowerCase()}.`);
    }
    const me = { userId: session.id, connectionId: session.connectionId, name: session.username };
    if (table.game === 'ttt') {
      const s = this.ttt[table.id];
      const next = op === 'create' ? tttCreate(s, me, crypto.randomUUID(), now)
        : op === 'join' ? tttJoin(s, me, String(data.id), now)
        : op === 'move' ? tttMove(s, me.userId, Number(data.cell), now)
        : op === 'rematch' ? tttRematch(s, me.userId, now)
        : op === 'leave' ? (tttLeave(s, me.userId, now) ?? s)
        : { error: 'Unknown move' };
      if (isTttError(next)) throw new Error(next.error);
      if (next !== s) this.setTtt(table.id, next);
      return this.ttt[table.id];
    }
    const s = this.pool;
    const next = op === 'create' ? poolCreate(s, me, crypto.randomUUID(), now)
      : op === 'join' ? poolJoin(s, me, String(data.id), now)
      : op === 'shoot' ? poolShoot(s, me.userId, Number(data.dx), Number(data.dz), Number(data.power), now)
      : op === 'rematch' ? poolRematch(s, me.userId, now)
      : op === 'leave' ? (poolLeave(s, me.userId, now) ?? s)
      : { error: 'Unknown move' };
    if (isPoolError(next)) throw new Error(next.error);
    if (next !== s) this.setPool(next);
    return this.pool;
  }
  private setTtt(id: string, next: TttState) {
    const prev = this.ttt[id];
    if (prev.status === 'ACTIVE' && next.status === 'RESULT' && (next.endReason === 'complete' || next.endReason === 'draw') && next.id) {
      for (const p of [next.x, next.o]) if (p) this.awardXp(p.userId, 'arcade_match', `${id}:${next.id}`);
      const winner = next.winner === 'X' ? next.x : next.winner === 'O' ? next.o : null;
      if (winner) this.awardXp(winner.userId, 'arcade_win', `${id}:${next.id}`);
    }
    this.ttt[id] = next;
    if (this.tttTimers[id]) clearTimeout(this.tttTimers[id]!);
    this.tttTimers[id] = next.status === 'ACTIVE' && next.turnDeadline ? setTimeout(() => {
      this.tttTimers[id] = null;
      const expired = tttExpire(this.ttt[id], Date.now());
      if (expired) this.setTtt(id, expired);
    }, Math.max(0, next.turnDeadline - Date.now()) + 50) : null;
    this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'arcade_state', ttt: { [id]: next } }));
  }
  private setPool(next: PoolState) {
    const prev = this.pool;
    if (prev.status === 'ACTIVE' && next.status === 'RESULT' && next.endReason === 'complete' && next.id) {
      for (const p of poolPlayers(next)) this.awardXp(p.userId, 'arcade_match', `pool:${next.id}`);
      if (next.winnerUserId) this.awardXp(next.winnerUserId, 'arcade_win', `pool:${next.id}`);
    }
    this.pool = next;
    if (this.poolTimer) clearTimeout(this.poolTimer);
    this.poolTimer = next.status === 'ACTIVE' && next.turnDeadline ? setTimeout(() => {
      this.poolTimer = null;
      const expired = poolExpire(this.pool, Date.now());
      if (expired) this.setPool(expired);
    }, Math.max(0, next.turnDeadline - Date.now()) + 50) : null;
    this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'arcade_state', pool: next }));
  }
  private arcadeDisconnect(connectionId: string, userId?: string) {
    if (!userId) return;
    for (const id of TTT_TABLES) {
      const s = this.ttt[id];
      if (![s.x, s.o].some((p) => p?.connectionId === connectionId)) continue;
      const next = tttLeave(s, userId, Date.now());
      if (next) this.setTtt(id, next);
    }
    if (poolPlayers(this.pool).some((p) => p.connectionId === connectionId)) {
      const next = poolLeave(this.pool, userId, Date.now());
      if (next) this.setPool(next);
    }
  }
  private courtsDisconnect(connectionId: string, userId?: string) {
    const mine = [...this.rally.teams.A, ...this.rally.teams.B].some((p) => p.connectionId === connectionId);
    if (userId && mine) {
      const next = leaveRally(this.rally, userId, Date.now());
      if (next) this.setRally(next);
    }
    for (const id of COURT_GAME_IDS) {
      const c = this.courts[id].state;
      if (!userId || ![c.player1, c.player2].some((p: any) => p?.connectionId === connectionId)) continue;
      const next = COURT_GAMES[id].game.leave(c, userId, Date.now());
      if (next) this.setCourt(id, next);
    }
  }
  private footballDisconnect(connectionId: string, userId?: string) {
    const f = this.football;
    if (!userId || ![f.player1, f.player2].some((p) => p?.connectionId === connectionId)) return;
    const next = leaveMatch(f, userId, Date.now());
    if (next) this.setFootball(next);
  }
  async alarm() {
    const settlements=await this.state.storage.list<any>({prefix:'keke-settle:',limit:100});
    for(const [key,entry] of settlements){
      if(entry.due>Date.now())continue;
      try{await this.dbRpc('keke_settle_trusted',entry.body);await this.state.storage.delete(key);this.broadcastToRoom('world:funaab:main',JSON.stringify({type:'wallet_refresh'}));}catch{}
    }
    if((await this.state.storage.list({prefix:'keke-settle:',limit:1})).size)await this.state.storage.setAlarm(Date.now()+60000);

    const pending = await this.state.storage.list<object>({prefix:'ps-reward:',limit:50});
    for (const [key,body] of pending) {
      try { await this.dbRpc('ps_reward_trusted',body); await this.state.storage.delete(key); }
      catch { /* A later alarm safely retries the same idempotent match receipt. */ }
    }
    if ((await this.state.storage.list({prefix:'ps-reward:',limit:1})).size) await this.state.storage.setAlarm(Date.now()+60000);

    // Backstop settlement for Campus Bet when nobody opens the shop after betting closes.
    const storage = this.state.storage;
    const betDue = typeof storage.get === 'function' ? await storage.get<number>('campus-bet-settle-at') : undefined;
    if (betDue) {
      if (betDue <= Date.now()) {
        await storage.delete('campus-bet-settle-at');
        try { await this.campusBetSync(null); }
        catch { await storage.put('campus-bet-settle-at', Date.now() + 60000); await this.ensureAlarmBy(Date.now() + 60000); }
      } else await this.ensureAlarmBy(betDue);
    }
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/campus-summary') {
      return Response.json(summarizeCampus(this.players.values(), getZoneName));
    }
    // The current campus announcement (public, read-only). Everyone polls this on load.
    if (url.pathname === '/announcement') {
      return Response.json({ announcement: await this.currentAnnouncement() }, { headers: { 'Cache-Control': 'no-store' } });
    }
    // Set or clear it. Only the Worker's Telegram handler can call this: it carries the shared secret.
    if (url.pathname === '/__announce' && request.method === 'POST') {
      const secret = this.env.TELEGRAM_WEBHOOK_SECRET;
      if (!secret || request.headers.get('X-Internal') !== secret) return new Response('Forbidden', { status: 403 });
      return Response.json({ announcement: await this.publishAnnouncement(await request.json().catch(() => ({}))) });
    }
    const isWebSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    if (isWebSocket) {
      const token = url.searchParams.get('token');
      const boundRoom = url.searchParams.get('room') || 'world:funaab:main';
      console.log('[WS] WebSocket upgrade received at path:', url.pathname, token ? '(token present)' : '(no token)');
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      if (typeof server.serializeAttachment === 'function') {
        server.serializeAttachment({
          initialToken: token,
          boundRoom,
          session: null,
          player: null,
        });
      }
      // Hibernation (state.acceptWebSocket) is disabled until webSocketMessage has a real handler:
      // nothing sets ws.__messageHandler, so hibernatable sockets silently dropped every message
      // (join, ping, chat, keke, Campus Bet). Standard sockets deliver to handleSession's listeners.
      server.accept();
      await this.handleSession(server, token, boundRoom);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === '/health' || url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          playersOnline: this.players.size,
          activeSessions: this.sessions.size,
          activeMatches: this.psMatches.size,
          activeLectureRooms: this.lectureRooms.size,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('FUNAAB Life Realtime World Engine Ready', { status: 200 });
  }

  private async handleSession(webSocket: WebSocket, initialToken: string | null, boundRoom: string) {
    const attachment = typeof webSocket.deserializeAttachment === 'function'
      ? (webSocket.deserializeAttachment() as {
          initialToken?: string | null;
          boundRoom?: string;
          session?: SessionData | null;
          player?: PlayerState | null;
        } | null)
      : null;

    const hydratedToken = attachment?.initialToken ?? initialToken ?? null;
    const hydratedBoundRoom = attachment?.boundRoom ?? boundRoom;

    if (attachment?.session && attachment?.player) {
      const existingSession = attachment.session;
      const existingPlayer = attachment.player;
      this.sessions.set(webSocket, existingSession);
      this.players.set(existingSession.connectionId, existingPlayer);
      this.dirtyPlayerIds.add(existingSession.connectionId);
      this.kekesDirty = true;
      this.refreshSimulationLoop();
      this.scheduleBatchBroadcast();
      return;
    }

    let sessionConnId: string | null = null;
    let joining = false;
    let authenticatedUserId: string | null = null;
    let sessionRoom: string = 'world:funaab:main';

    // Pre-verify token from URL handshake if present
    if (initialToken) {
      const verified = await verifySupabaseJwt(initialToken, this.env);
      if (verified) {
        authenticatedUserId = verified.sub;
      }
    }

    webSocket.addEventListener('message', async (event: MessageEvent) => {
      try {
        const raw = event.data;
        if (typeof raw !== 'string') return;
        const data = JSON.parse(raw);

        // Lightweight abuse/rate limiting per connection
        const session = this.sessions.get(webSocket);
        const now = Date.now();
        if (session?.room === LIBRARY_ROOM && !isLibraryOpen()) {
          webSocket.close(1008, 'The library is closed. Open Monday–Friday, 8am–5pm Lagos time.');
          return;
        }
        if (session) {
          if (now - session.lastPacketTime < 1000) {
            session.packetCount++;
            if (session.packetCount > 60) {
              // Too many packets in 1 sec
              return;
            }
          } else {
            session.lastPacketTime = now;
            session.packetCount = 1;
          }
        }

        if (session && session.room.startsWith('world:funaab:hostel-room:') && now - (session.accessCheckedAt || 0) > 5000) {
          session.accessCheckedAt = now;
          if (!(await this.checkRoom(session.room,session.id))) { webSocket.close(1008,'Room access ended'); return; }
        }
        switch (data.type) {
          case 'join': {
            if (sessionConnId || joining) return;
            joining = true;
            const { player, room = 'world:funaab:main', token } = data;
            if (room !== boundRoom) { webSocket.close(1008, 'Room mismatch'); return; }
            if (room === LIBRARY_ROOM && !isLibraryOpen()) { webSocket.close(1008, 'The library is closed. Open Monday–Friday, 8am–5pm Lagos time.'); return; }
            const effectiveToken = token || initialToken;

            // Strict Authenticated User ID derivation
            if (effectiveToken) {
              const verified = await verifySupabaseJwt(effectiveToken, this.env);
              if (verified) {
                authenticatedUserId = verified.sub;
              }
            }

            const guestEnabled = this.env.ENABLE_GUEST_MODE === 'true';
            if (!authenticatedUserId) {
              if (guestEnabled) {
                // Allow guest development identifier
                authenticatedUserId = player.id || `guest_${Math.random().toString(36).substring(2, 9)}`;
              } else {
                console.warn('[AUTH] Connection rejected: No valid Supabase JWT and guest mode is disabled');
                webSocket.send(JSON.stringify({ type: 'error', message: 'Unauthorized session. Please sign in.' }));
                webSocket.close(4001, 'Unauthorized');
                return;
              }
            }
            const verifiedUserId = authenticatedUserId;
            if (!verifiedUserId) {
              webSocket.send(JSON.stringify({ type: 'error', message: 'Unauthorized session. Please sign in.' }));
              webSocket.close(4001, 'Unauthorized');
              return;
            }

            if (!(await this.checkRoom(room, verifiedUserId))) { webSocket.close(1008,'Room is private or invite expired'); return; }
            const visitingFriend = room.startsWith('world:funaab:hostel-room:') && room.split(':')[3] !== verifiedUserId;
            if (room === 'world:funaab:main') await this.restoreAutonomousKeke();
            if (room.startsWith('world:funaab:hostel-room:')) {
              const owner = room.split(':')[3];
              const guests = [...this.sessions.values()].filter(s => s.id !== owner).length;
              // Hostel rooms hold the owner + 4; an off-campus lodge holds the owner + 7.
              const reported = await this.dbRpc('room_capacity_trusted', { p_owner: owner }).catch(() => null);
              const capacity = Number.isInteger(reported) && reported >= 5 && reported <= 8 ? reported : 5;
              if (this.sessions.size >= capacity || (verifiedUserId !== owner && guests >= capacity - 1)) { webSocket.close(1008,`Room full: owner + ${capacity - 1} guests`); return; }
            }
            sessionRoom = room;
            // Preserve existing clients' connection IDs, but never let a second
            // socket overwrite a live player by choosing the same ID.
            const assignedConnId: string = typeof player.connectionId==='string'
              && /^[a-zA-Z0-9_-]{1,100}$/.test(player.connectionId)
              && !this.players.has(player.connectionId) ? player.connectionId : crypto.randomUUID();
            sessionConnId = assignedConnId;

            const sessionData: SessionData = {
              connectionId: assignedConnId,
              id: verifiedUserId,
              username: String(player.username || 'Student').slice(0, 24),
              college: String(player.college || 'COLENG').slice(0, 16),
              avatarConfig: normalizeAvatar(player.avatarConfig),
              room: sessionRoom,
              lastPacketTime: Date.now(),
              packetCount: 1,
              token: effectiveToken, accessCheckedAt: Date.now(),
              trustedPosition: sessionRoom==='world:funaab:main'?CAMPUS_SPAWN:[0,0,2], trustedAt: Date.now(),
            };

            this.sessions.set(webSocket, sessionData);
            if (visitingFriend) this.dailyGoalEvent(sessionData, 'visit_friend_room');

            const playerState: PlayerState = {
              id: verifiedUserId,
              connectionId: assignedConnId,
              username: sessionData.username,
              college: sessionData.college,
              avatarConfig: sessionData.avatarConfig,
              position: Array.isArray(player.position) ? player.position : [0, 0, 8],
              rotation: Number(player.rotation) || 0,
              animation: String(player.animation || 'idle'),
              kekeRiding: false,
              lastUpdated: Date.now(),
            };

            this.players.set(assignedConnId, playerState);
            this.refreshSimulationLoop();

            // Send full initial snapshot
            const roomPlayers: Record<string, any> = {};
            for (const [cId, p] of this.players) {
              roomPlayers[cId] = p;
            }

            webSocket.send(
              JSON.stringify({
                type: 'snapshot',
                yourConnectionId: assignedConnId,
                yourId: authenticatedUserId,
                players: roomPlayers,
                kekes: Object.fromEntries(this.kekes),
                activeMatches: Object.fromEntries(this.psMatches),
                ...(sessionRoom === 'world:funaab:main' ? { football: this.football, basketball: this.courts.basketball.state, volleyball: this.courts.volleyball.state, rally: this.rally, arcade: { ttt: this.ttt, pool: this.pool } } : {}),
              })
            );

            // Broadcast player_joined to peers in the main room
            this.broadcastToRoom(
              sessionRoom,
              JSON.stringify({
                type: 'player_joined',
                player: playerState,
              }),
              webSocket
            );
            break;
          }

          case 'job_action': {
            const current = this.sessions.get(webSocket);
            if (!current) return;
            if (current.room !== 'world:funaab:main') { webSocket.send(JSON.stringify({type:'action_result',requestId:data.requestId,error:'Return to campus to work this job.'})); return; }
            try {
              this.advanceTrustedPosition(current);
              const pos=current.trustedPosition;
              if (!pos || Date.now()-(current.trustedAt || 0)>3000) throw new Error('Walk to the objective and reconnect if needed');
              const result=await this.dbRpc('job_action_trusted',{p_user:current.id,p_action:data.action,p_job:data.jobId || null,p_run:data.runId || null,p_x:pos[0],p_z:pos[2]});
              webSocket.send(JSON.stringify({type:'action_result',requestId:data.requestId,result}));
            } catch(e) { webSocket.send(JSON.stringify({type:'action_result',requestId:data.requestId,error:(e as Error).message})); }
            break;
          }
          case 'campus_bet': {
            const current = this.sessions.get(webSocket);
            if (!current) return;
            try { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, result: await this.campusBetCommand(current, data) })); }
            catch (e) { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, error: (e as Error).message })); }
            break;
          }
          case 'feedback': {
            const current = this.sessions.get(webSocket);
            if (!current) return;
            try { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, result: await this.feedbackCommand(current, data) })); }
            catch (e) { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, error: (e as Error).message })); }
            break;
          }
          case 'hustle': {
            const current = this.sessions.get(webSocket);
            if (!current) return;
            try { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, result: await this.hustleCommand(current, data) })); }
            catch (e) { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, error: (e as Error).message })); }
            break;
          }
          case 'football': {
            const current = this.sessions.get(webSocket);
            if (!current) return;
            try { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, result: this.footballCommand(current, data) })); }
            catch (e) { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, error: (e as Error).message })); }
            break;
          }
          case 'volleyball_rally': {
            const current = this.sessions.get(webSocket);
            if (!current) return;
            try { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, result: this.rallyCommand(current, data) })); }
            catch (e) { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, error: (e as Error).message })); }
            break;
          }
          case 'party':
          case 'arcade': {
            const current = this.sessions.get(webSocket);
            if (!current) return;
            try { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, result: data.type === 'party' ? await this.partyCommand(current, data) : this.arcadeCommand(current, data) })); }
            catch (e) { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, error: (e as Error).message })); }
            break;
          }
          case 'basketball':
          case 'volleyball': {
            const current = this.sessions.get(webSocket);
            if (!current) return;
            try { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, result: this.courtCommand(data.type, current, data) })); }
            catch (e) { webSocket.send(JSON.stringify({ type: 'action_result', requestId: data.requestId, error: (e as Error).message })); }
            break;
          }
          case 'room_changed': {
            if (!session || !session.room.startsWith('world:funaab:hostel-room:') || session.room.split(':')[3]!==session.id) return;
            // Never trust client furniture; peers refetch the RLS-protected snapshot.
            for (const [socket, peer] of this.sessions) {
              if(peer.room!==session.room)continue;
              if (!(await this.checkRoom(peer.room,peer.id))) socket.close(1008,'Room access ended');
              else socket.send(JSON.stringify({type:'room_changed'}));
            }
            break;
          }
          case 'held_item': {
            // Purely visual: the student bought food or a drink and carries it for a minute.
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session || !HELD_ITEM_KINDS.includes(data.kind)) return;
            const now = Date.now();
            if (session.heldItemAt && now - session.heldItemAt < 1000) return;
            session.heldItemAt = now;
            // In hand for a minute, on a restaurant table for up to 10, or 0 to put it away.
            const ms = data.ms === undefined ? HELD_ITEM_MS : Math.min(Math.max(Math.round(Number(data.ms)) || 0, 0), TABLE_ITEM_MS);
            this.broadcastToRoom(session.room, JSON.stringify({ type: 'held_item', connectionId: sessionConnId, kind: data.kind, ms }));
            break;
          }
          case 'avatar_update': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            const player = this.players.get(sessionConnId);
            if (!session || !player) return;
            const avatarConfig = normalizeAvatar(data.avatarConfig);
            session.avatarConfig = avatarConfig;
            player.avatarConfig = avatarConfig;
            this.broadcastToRoom(session.room, JSON.stringify({ type: 'avatar_updated', connectionId: sessionConnId, avatarConfig }));
            break;
          }

          case 'move': {
            if (!sessionConnId) return;
            const player = this.players.get(sessionConnId);
            if (player) {
              if(player.kekeRiding)return;
              if (!Array.isArray(data.position) || data.position.length!==3 || !data.position.every((n: unknown)=>typeof n==='number' && Number.isFinite(n) && Math.abs(n)<200)) return;
              const current=this.sessions.get(webSocket)!;
              current.claimedPosition=[data.position[0],data.position[1],data.position[2]];
              this.advanceTrustedPosition(current);
              // Walking away from the campus Game Den ends your challenge or match.
              if (current.room === 'world:funaab:main' && current.trustedPosition
                && Math.hypot(current.trustedPosition[0] - PS_DEN[0], current.trustedPosition[2] - PS_DEN[2]) > PS_LEAVE_RADIUS
                && [...this.psMatches.values()].some((m) => m.status !== 'finished' && m.stationId === 'ps5-station-1' && (m.hostId === current.id || m.guestId === current.id)))
                this.endPSMatchesFor(current.id, 'walked_away');
              const rotation = typeof data.rotation === 'number' && Number.isFinite(data.rotation) ? data.rotation : player.rotation;
              const animation = ['idle','walk','run','sit','sleep','pray','wave','cheer','dance'].includes(data.animation)?data.animation:'idle';
              const car = isCarId(data.car) ? data.car : null;
              const carPaint = car && isPaintId(data.carPaint) ? data.carPaint : null;
              if (player.position.some((value, index) => value !== data.position[index])
                || player.rotation !== rotation
                || player.animation !== animation
                || (player.car ?? null) !== car
                || (player.carPaint ?? null) !== carPaint) this.dirtyPlayerIds.add(sessionConnId);
              player.position = data.position;
              player.rotation = rotation;
              player.animation = animation;
              if (player.car && !car) this.releaseCarRiders(sessionConnId, 'parked');
              player.car = car;
              player.carPaint = carPaint;
              if (current.race) this.raceMove(current, webSocket, car);
              this.loveGardenGoals(current, animation);
              if (current.posShift && current.trustedPosition && Math.hypot(current.trustedPosition[0] - POS_KIOSK.serviceSpot[0], current.trustedPosition[2] - POS_KIOSK.serviceSpot[2]) > POS_KIOSK.radius + 1) {
                current.posShift = undefined;
                webSocket.send(JSON.stringify({ type: 'hustle_notice', icon: '🏧', text: 'You left the POS kiosk, so the shift ended unpaid.' }));
              }

              player.lastUpdated = Date.now();
              if (this.dirtyPlayerIds.has(sessionConnId)) this.scheduleBatchBroadcast();
            }
            break;
          }

          case 'ping': {
            webSocket.send(JSON.stringify({ type: 'pong', t: data.t }));
            // Standing still sends no moves: check the Love Garden goals on the heartbeat too, so
            // someone already in the garden when Campus Night starts at 8pm still gets it.
            const pinger = this.sessions.get(webSocket), still = sessionConnId ? this.players.get(sessionConnId) : undefined;
            if (pinger && still && !still.kekeRiding) { this.advanceTrustedPosition(pinger); this.loveGardenGoals(pinger, still.animation); }
            break;
          }

          case 'chat': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            const player = this.players.get(sessionConnId);
            if (!session || !player) return;

            const chatText = String(data.text || '').trim().slice(0, 300);
            if (!chatText) return;

            const chatMsg = {
              type: 'chat_message',
              id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              senderId: session.id,
              senderConnectionId: sessionConnId,
              senderName: session.username,
              college: session.college,
              text: chatText,
              timestamp: Date.now(),
              position: player.position,
            };

            this.broadcastToRoom(session.room, JSON.stringify(chatMsg));
            break;
          }

          case 'private_chat':
          case 'private_chat_message': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session) return;

            const recipientId = String(data.recipientId || '').trim();
            const recipientUsername = String(data.recipientUsername || '').trim();
            const recipientConnId = String(data.recipientConnectionId || '').trim();
            const text = String(data.text || '').trim().slice(0, 500);
            if (!text) return;

            const msgObj = {
              id: `dm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              senderId: session.id, // Server-Authoritative sender UUID
              senderConnectionId: sessionConnId,
              senderName: session.username,
              college: session.college || 'CAMPUS',
              recipientId,
              recipientUsername,
              text,
              transferData: data.transferData || null,
              timestamp: Date.now(),
              isPrivate: true,
            };

            const dmPayload = JSON.stringify({
              type: 'private_chat_message',
              message: msgObj,
              ...msgObj,
            });

            // Route directly to recipient socket(s)
            let delivered = false;
            for (const [targetWs, targetSession] of this.sessions) {
              if (targetWs === webSocket) continue; // Skip sender in target loop
              if (
                (recipientConnId && targetSession.connectionId === recipientConnId) ||
                (recipientId && targetSession.id === recipientId) ||
                (recipientUsername && targetSession.username.toLowerCase() === recipientUsername.toLowerCase())
              ) {
                try {
                  targetWs.send(dmPayload);
                  delivered = true;
                } catch (e) {}
              }
            }

            // Echo back confirmation to sender so sender's client displays the sent message in thread
            try {
              webSocket.send(dmPayload);
            } catch (e) {}
            break;
          }

          case 'p2p_transfer': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session) return;

            const recipientName = String(data.recipientUsername || '').trim();
            const amount = Number(data.amount) || 0;
            if (amount <= 0 || !recipientName) return;

            // Authoritative notification to recipient if connected
            for (const [targetWs, targetSession] of this.sessions) {
              if (targetSession.username.toLowerCase() === recipientName.toLowerCase()) {
                try {
                  targetWs.send(
                    JSON.stringify({
                      type: 'p2p_transfer_received',
                      senderUsername: session.username,
                      amount,
                      timestamp: Date.now(),
                    })
                  );
                } catch (e) {}
              }
            }
            break;
          }

          case 'keke_enter':
          case 'keke_book': {
            const current=this.sessions.get(webSocket);if(!current)return;
            try{const result=await this.boardKeke(webSocket,current,data);webSocket.send(JSON.stringify({type:'action_result',requestId:data.requestId,result}));}
            catch(e){webSocket.send(JSON.stringify({type:'action_result',requestId:data.requestId,error:(e as Error).message}));}
            break;
          }
          // Korope riders: leave now with whoever is aboard instead of waiting for a full load.
          case 'korope_go': {
            if(!sessionConnId)return;
            const k=this.kekes.get(KOROPE_ID);
            if(!k||!k.passengers.includes(sessionConnId)){webSocket.send(JSON.stringify({type:'hustle_notice',icon:'🚐',text:'Board the Korope first.'}));return;}
            if(departNow(k,Date.now())){
              this.kekesDirty=true;this.refreshSimulationLoop();this.broadcastBatchPlayers();
              const me=this.players.get(sessionConnId)?.username||'A rider';
              this.sendToConnections(k.passengers.filter((id)=>id!==sessionConnId),JSON.stringify({type:'hustle_notice',icon:'🚐',text:`${me} asked the Korope to move. Doors closing!`}));
            }
            break;
          }
          case 'keke_hold': {
            const current=this.sessions.get(webSocket);if(!current||current.room!=='world:funaab:main')return;
            this.holdKeke(current,data);
            break;
          }
          // Lifts: hop into a stopped car (two passengers at most), or get out.
          case 'car_ride': {
            if (!sessionConnId) return;
            const me = this.players.get(sessionConnId), session = this.sessions.get(webSocket);
            const driverId = String(data.driver || ''), driver = this.players.get(driverId);
            const fail = (error: string) => webSocket.send(JSON.stringify({ type: 'car_ride_result', ok: false, error }));
            if (!me || !session || !driver || driverId === sessionConnId) return fail('That car is not here.');
            if (!driver.car) return fail('They are not driving.');
            if (me.car || me.kekeRiding) return fail('Get out of your own ride first.');
            const driverSession = [...this.sessions.values()].find((x) => x.connectionId === driverId);
            if (!driverSession || driverSession.room !== session.room) return fail('That car is not here.');
            if (Math.hypot(me.position[0] - driver.position[0], me.position[2] - driver.position[2]) > 6) return fail('Walk up to the car first.');
            const taken = [...this.players.values()].filter((p) => p.rideWith === driverId).map((p) => p.rideSeat);
            const seat = [0, 1].find((n) => !taken.includes(n));
            if (seat === undefined) return fail('The car is full (two passengers).');
            me.rideWith = driverId; me.rideSeat = seat; me.animation = 'sit';
            this.dirtyPlayerIds.add(sessionConnId); this.scheduleBatchBroadcast();
            webSocket.send(JSON.stringify({ type: 'car_ride_result', ok: true, driver: driverId, seat }));
            this.sendToConnections([driverId], JSON.stringify({ type: 'car_rider_joined', username: me.username }));
            break;
          }
          // Group chats: the sender tells online members to fetch the new message from the database
          // (only members can read it there), so this carries no message text.
          case 'group_ping': {
            const session = this.sessions.get(webSocket);
            if (!session) return;
            const groupId = String(data.groupId || '').slice(0, 64);
            const to = new Set((Array.isArray(data.to) ? data.to : []).slice(0, 20).map((x: unknown) => String(x)));
            if (!groupId || to.size === 0) return;
            const ping = JSON.stringify({ type: 'group_ping', groupId, from: session.username });
            for (const [ws, s] of this.sessions) {
              if (ws === webSocket || !to.has(s.id)) continue;
              try { ws.send(ping); } catch { /* closed */ }
            }
            break;
          }
          // Campus Grand Prix: start watching this student's lap from the grid, or stop.
          case 'race_start': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket), me = this.players.get(sessionConnId);
            if (!session || !me) return;
            this.advanceTrustedPosition(session);
            const pos = session.trustedPosition, grid = RACE.track[0];
            const fail = (reason: string) => { session.race = undefined; webSocket.send(JSON.stringify({ type: 'race_result', ok: false, reason })); };
            if (session.room !== 'world:funaab:main' || !me.car) return fail('drive your own car to the start line first.');
            if (!pos || Math.hypot(pos[0] - grid[0], pos[2] - grid[2]) > RACE.startRadius + 3) return fail('start from the START arch beside COLENG.');
            session.race = { goAt: Date.now() + RACE.countdownMs, gate: 0, car: me.car, x: pos[0], z: pos[2] };
            break;
          }
          case 'race_quit': {
            const session = this.sessions.get(webSocket);
            if (session) session.race = undefined;
            break;
          }

          case 'car_ride_leave': {
            if (!sessionConnId) return;
            const me = this.players.get(sessionConnId);
            if (!me || !me.rideWith) return;
            me.rideWith = null; me.rideSeat = undefined;
            this.dirtyPlayerIds.add(sessionConnId); this.scheduleBatchBroadcast();
            break;
          }

          case 'keke_exit': {
            if(!sessionConnId)return;
            const k=[...this.kekes.values()].find(k=>k.passengers.includes(sessionConnId!));
            if(k && k.isStopped)await this.dropPassenger(k,sessionConnId,k.phase==='BOARDING'&&isParkedKeke(k.id)?'refund':'complete');
            // Moving on a route: it pulls over at the next junction or stop to let you off.
            else if(k && !isParkedKeke(k.id) && k.phase==='MOVING'){
              k.exitNext=[...new Set([...(k.exitNext??[]),sessionConnId])];
              webSocket.send(JSON.stringify({type:'hustle_notice',icon:'🛺',text:'The driver will stop at the next junction for you.'}));
            }
            break;
          }

          case 'ps_challenge_create': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session) return;
            if (sessionRoom.startsWith('world:funaab:hostel-room:')) {
              const snap=await this.dbRpc('hostel_snapshot',{p_owner:sessionRoom.split(':')[3]},session.token);
              const ids=snap.placements.map((p: any)=>p.item_id);
              if (!ids.includes('hostel_tv_basic') || !ids.includes('hostel_ps_console')) return;
            }
            if ([...this.psMatches.values()].some(m=>m.status!=='finished' && (m.hostId===session.id || m.guestId===session.id))) return;
            const matchId = crypto.randomUUID();
            const match: PSMatchState = {
              id: matchId,
              stationId: data.stationId || 'ps5-station-1',
              hostId: session.id,
              hostConnectionId: sessionConnId,
              hostName: session?.username || 'Player 1',
              status: 'waiting',
              currentRound: 1,
              totalRounds: PS_TOTAL_ROUNDS,
              hostScore: 0,
              guestScore: 0,
              room: sessionRoom,
              updatedAt: Date.now(),
            };
            this.psMatches.set(matchId, match);
            this.ensurePSSweep();
            this.broadcastToRoom(sessionRoom, JSON.stringify({ type: 'ps_match_update', match }));
            break;
          }

          case 'ps_challenge_join': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session) return;
            const match = this.psMatches.get(data.matchId);
            if (match && match.status === 'waiting' && match.hostId !== session.id) {
              match.guestId = session.id;
              match.guestConnectionId = sessionConnId;
              match.guestName = session?.username || 'Player 2';
              match.status = 'in_progress';
              match.startedAt=Date.now();
              match.updatedAt = Date.now();
              this.sendToConnections(
                [match.hostConnectionId, match.guestConnectionId],
                JSON.stringify({ type: 'ps_match_started', match })
              );
              this.broadcastToRoom(sessionRoom, JSON.stringify({ type: 'ps_match_update', match }));
            }
            break;
          }

          case 'ps_leave': {
            const current = this.sessions.get(webSocket);
            if (current) this.endPSMatchesFor(current.id, 'left');
            break;
          }

          case 'ps_action': {
            if (!sessionConnId) return;
            const match = this.psMatches.get(data.matchId);
            if (!match || match.status !== 'in_progress' || !PS_DIRECTIONS.includes(data.choice)) return;

            if (sessionConnId === match.hostConnectionId) {
              if (match.hostChoice) return;
              match.hostChoice = data.choice;
            } else if (sessionConnId === match.guestConnectionId) {
              if (match.guestChoice) return;
              match.guestChoice = data.choice;
            } else {
              return;
            }

            if (match.hostChoice && match.guestChoice) {
              // Equal kicks each, early finish once a side can't catch up, level = draw.
              const outcome = resolvePSRound(match);
              if (outcome) {
                  // Fixed campus rewards only; home matches never mint passive income.
                  if (sessionRoom==='world:funaab:main') {
                    const rewardBody={p_match:match.id,p_host:match.hostId,p_guest:match.guestId,
                      p_winner:outcome==='draw'?null:outcome==='host'?match.hostId:match.guestId};
                    await this.state.storage.put('ps-reward:'+match.id,rewardBody);
                    await this.state.storage.setAlarm(Date.now()+60000);
                    try {
                      await this.dbRpc('ps_reward_trusted',rewardBody);
                      await this.state.storage.delete('ps-reward:'+match.id);
                      this.sendToConnections([match.hostConnectionId,match.guestConnectionId!],JSON.stringify({type:'wallet_refresh'}));
                    } catch(e) { this.sendToConnections([match.hostConnectionId,match.guestConnectionId!],JSON.stringify({type:'reward_error',message:'Match finished. Your reward is queued for a safe retry; reopen your wallet shortly.'})); }
                  }
              }
              match.updatedAt = Date.now();
              this.broadcastToRoom(sessionRoom, JSON.stringify({ type: 'ps_match_update', match }));
            }
            break;
          }

          // LECTURE & CLASSROOM SYSTEM
          case 'lecture_enter': {
              if (sessionRoom === LIBRARY_ROOM) return;
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session) return;

            const lectureId = String(data.lectureId || '');
            // 0 = standing inside the hall (not seated yet).
            const seatNumber = Math.max(0, Math.min(99, Math.floor(Number(data.seatNumber) || 0)));

            session.room = `world:funaab:lecture:${lectureId}`;
            session.currentLectureId = lectureId;
            session.seatNumber = seatNumber;

            const player = this.players.get(sessionConnId);
            if (player) {
              player.currentLectureId = lectureId;
              player.seatNumber = seatNumber;
              player.currentZone = getZoneName(0, 0, lectureId);
              // Campus clients hide students who are inside a hall and count them at its door.
              this.dirtyPlayerIds.add(sessionConnId);
              this.broadcastBatchPlayers();
            }

            let roomState = this.lectureRooms.get(lectureId);
            if (!roomState) {
              roomState = {
                lectureId,
                activeStudents: {},
                lecturerSpeech: 'Welcome to class. Please take your seats.',
                boardText: 'Lecture In Session',
                startedAt: Date.now(),
              };
              this.lectureRooms.set(lectureId, roomState);
            }

            roomState.activeStudents[sessionConnId] = {
              connectionId: sessionConnId,
              studentId: session.id,
              username: session.username,
              college: session.college,
              seatNumber,
              isHandRaised: false,
              joinedAt: Date.now(),
              pos: roomState.activeStudents[sessionConnId]?.pos,
            };

            // Send classroom state to entering student
            webSocket.send(
              JSON.stringify({
                type: 'lecture_room_snapshot',
                lectureId,
                roomState,
                yourSeatNumber: seatNumber,
              })
            );

            // Broadcast to other students in the lecture room
            this.broadcastToRoom(
              session.room,
              JSON.stringify({
                type: 'lecture_student_joined',
                student: roomState.activeStudents[sessionConnId],
              }),
              webSocket
            );
            break;
          }

          case 'lecture_leave': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session || !session.currentLectureId) return;

            const prevLectureId = session.currentLectureId;
            const roomState = this.lectureRooms.get(prevLectureId);
            if (roomState) {
              delete roomState.activeStudents[sessionConnId];
              this.broadcastToRoom(
                session.room,
                JSON.stringify({
                  type: 'lecture_student_left',
                  connectionId: sessionConnId,
                })
              );
            }

            session.room = 'world:funaab:main';
            session.currentLectureId = undefined;
            session.seatNumber = undefined;

            const player = this.players.get(sessionConnId);
            if (player) {
              player.currentLectureId = undefined;
              player.seatNumber = undefined;
              player.currentZone = getZoneName(player.position[0], player.position[2]);
              this.dirtyPlayerIds.add(sessionConnId);
              this.broadcastBatchPlayers();
            }
            break;
          }

          case 'lecture_chat': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session || !session.currentLectureId) return;

            const text = String(data.text || '').trim().slice(0, 200);
            if (!text) return;

            const lectureMsg = {
              type: 'lecture_chat_message',
              id: `lec-msg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              senderId: session.id,
              senderConnectionId: sessionConnId,
              senderName: session.username,
              college: session.college,
              text,
              seatNumber: session.seatNumber || 1,
              timestamp: Date.now(),
            };

            this.broadcastToRoom(session.room, JSON.stringify(lectureMsg));
            break;
          }

          case 'lecture_move': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session || !session.currentLectureId) return;
            const student = this.lectureRooms.get(session.currentLectureId)?.activeStudents[sessionConnId];
            if (!student) return;
            const n = (v: unknown, lim: number) => Math.max(-lim, Math.min(lim, Number(v) || 0));
            student.pos = [n(data.x, 8), n(data.z, 8), n(data.ry, 7)];
            student.moving = Boolean(data.moving);
            this.broadcastToRoom(
              session.room,
              JSON.stringify({ type: 'lecture_student_moved', connectionId: sessionConnId, pos: student.pos, moving: student.moving }),
              webSocket
            );
            break;
          }

          case 'lecture_hand_raise': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session || !session.currentLectureId) return;

            const isRaised = Boolean(data.isHandRaised);
            const roomState = this.lectureRooms.get(session.currentLectureId);
            if (roomState && roomState.activeStudents[sessionConnId]) {
              roomState.activeStudents[sessionConnId].isHandRaised = isRaised;
              this.broadcastToRoom(
                session.room,
                JSON.stringify({
                  type: 'lecture_hand_raise_sync',
                  connectionId: sessionConnId,
                  isHandRaised: isRaised,
                })
              );
            }
            break;
          }

          case 'lawn_fine_issued': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session) return;

            this.broadcastToRoom(
              'world:funaab:main',
              JSON.stringify({
                type: 'activity_event',
                eventType: 'lawn_fine',
                username: session.username,
                amount: ECONOMY_CONFIG.LAWN_FINE,
                timestamp: Date.now(),
              })
            );
            break;
          }

          case 'job_completed': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session) return;

            this.broadcastToRoom(
              'world:funaab:main',
              JSON.stringify({
                type: 'activity_event',
                eventType: 'campus_job',
                username: session.username,
                jobTitle: String(data.jobTitle || 'Errand').slice(0, 50),
                reward: Number(data.reward) || 3000,
                timestamp: Date.now(),
              })
            );
            break;
          }

          case 'report_user': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            console.log(
              `[MODERATION] User report filed by @${session?.username} (${session?.id}) against ${data.reportedUserId}: ${data.reason}`
            );
            webSocket.send(
              JSON.stringify({
                type: 'report_confirmed',
                message: 'Your report has been submitted to Campus Security for review.',
              })
            );
            break;
          }
        }
      } catch (err) {
        console.error('[DO] Message processing error:', err);
        if(!sessionConnId) webSocket.close(1008,'Room service unavailable or access denied');
      }
    });

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (sessionConnId) {
        const session = this.sessions.get(webSocket);

        // Remove from lecture room if inside one
        if (session && session.currentLectureId) {
          const roomState = this.lectureRooms.get(session.currentLectureId);
          if (roomState) {
            delete roomState.activeStudents[sessionConnId];
            this.broadcastToRoom(
              session.room,
              JSON.stringify({
                type: 'lecture_student_left',
                connectionId: sessionConnId,
              })
            );
          }
        }

        // Remove from keke passengers
        this.kekes.forEach((keke) => {
          if(keke.passengers.includes(sessionConnId!))void this.dropPassenger(keke,sessionConnId!,'refund');
        });
        this.footballDisconnect(sessionConnId, session?.id);
        this.courtsDisconnect(sessionConnId, session?.id);
        this.arcadeDisconnect(sessionConnId, session?.id);
        if (session?.id && ![...this.sessions.entries()].some(([ws, s]) => ws !== webSocket && s.id === session.id)) this.endPSMatchesFor(session.id, 'disconnected');
      // A Game Den match can't wait for someone who has gone; a second open tab keeps it alive.
      if (session?.id && ![...this.sessions.entries()].some(([ws, s]) => ws !== webSocket && s.id === session.id)) this.endPSMatchesFor(session.id, 'disconnected');

        this.releaseCarRiders(sessionConnId, 'driver_left');
        this.players.delete(sessionConnId);

        // Broadcast player_left to main world
        this.broadcastToRoom(
          sessionRoom,
          JSON.stringify({
            type: 'player_left',
            connectionId: sessionConnId,
            id: session?.id,
          })
        );
      }
      this.sessions.delete(webSocket);
      this.refreshSimulationLoop();
      if (this.sessions.size === 0) {
        if (this.batchBroadcastTimer !== null) clearTimeout(this.batchBroadcastTimer);
        this.batchBroadcastTimer = null;
        this.dirtyPlayerIds.clear();
        this.kekesDirty = false;
      }
      if (![...this.sessions.values()].some((session) => session.room === 'world:funaab:main')) {
        this.restoreKekePromise = null;
        void this.persistAutonomousKeke().catch((error) => {
          console.error('[DO] Failed to persist autonomous Keke state:', error);
        });
      }
    };

    webSocket.addEventListener('close', cleanup);
    webSocket.addEventListener('error', cleanup);
  }

  private async currentAnnouncement(): Promise<Announcement | null> {
    const storage = this.state.storage;
    if (!storage || typeof storage.get !== 'function') return null;
    const a = await storage.get<Announcement>('announcement');
    return announcementActive(a) ? a! : null;
  }
  /** { text, hours } sets a new announcement; { clear: true } takes it down. Everyone online sees it at once. */
  private async publishAnnouncement(body: any): Promise<Announcement | null> {
    const storage = this.state.storage;
    let next: Announcement | null = null;
    if (!body?.clear) {
      const text = cleanAnnouncement(String(body?.text ?? '')).slice(0, BROADCAST.MAX_TEXT);
      const hours = Math.min(BROADCAST.MAX_HOURS, Math.max(0.05, Number(body?.hours) || BROADCAST.DEFAULT_HOURS));
      if (!text) throw new Error('Empty announcement');
      const now = Date.now();
      next = { id: crypto.randomUUID(), text, createdAt: now, expiresAt: now + Math.round(hours * 3600000) };
    }
    if (storage && typeof storage.put === 'function') {
      if (next) await storage.put('announcement', next);
      else await storage.delete('announcement');
    }
    this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'announcement', announcement: next }));
    return next;
  }
  private broadcastToRoom(room: string, message: string, skipSocket?: WebSocket) {
    for (const [ws, session] of this.sessions) {
      if (session.room === room && ws !== skipSocket && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (e) {}
      }
    }
  }

  private sendToConnections(connectionIds: string[], message: string) {
    const targetConnections = new Set(connectionIds);
    for (const [ws, session] of this.sessions) {
      if (targetConnections.has(session.connectionId) && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (e) {}
      }
    }
  }
}

const sayOnTelegram = (env: Env, chatId: unknown, text: string) =>
  env.TELEGRAM_BOT_TOKEN
    ? fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }),
      }).catch(() => undefined)
    : Promise.resolve(undefined);

/** Always answers 200 so Telegram doesn't retry; only the secret-bearing, allow-listed owner can publish. */
async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const ok = () => Response.json({ ok: true });
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (request.method !== 'POST' || !secret || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== secret) return new Response('Forbidden', { status: 403 });
  const update: any = await request.json().catch(() => null);
  const message = update?.message ?? update?.channel_post;
  const chatId = message?.chat?.id, from = message?.from?.id;
  const command = parseBotCommand(message?.text);
  if (command.kind === 'ignore' || chatId === undefined) return ok();
  const reply = (text: string) => sayOnTelegram(env, chatId, text);
  // Anyone may ask for their own id (needed once to set the allow-list); nothing else is open.
  if (command.kind === 'myid') { await reply(`Your Telegram id: ${from}`); return ok(); }
  if (!isBotAdmin(env.TELEGRAM_ADMIN_IDS, from)) return ok();
  const main = env.WORLD_ROOM.get(env.WORLD_ROOM.idFromName('world:funaab:main'));
  const call = (body: object) => main.fetch('https://room/__announce', { method: 'POST', headers: { 'X-Internal': secret, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    if (command.kind === 'help') await reply(BOT_HELP);
    else if (command.kind === 'error') await reply(`⚠️ ${command.message}`);
    else if (command.kind === 'status') {
      const r: any = await (await main.fetch('https://room/announcement')).json();
      await reply(r.announcement ? `📣 Showing now (until ${new Date(r.announcement.expiresAt).toISOString()}):\n${r.announcement.text}` : 'Nothing is showing right now.');
    } else if (command.kind === 'clear') { await call({ clear: true }); await reply('✅ Announcement taken down.'); }
    else if (command.kind === 'set') {
      const res = await call({ text: command.text, hours: command.hours });
      await reply(res.ok ? `✅ Live for ${command.hours >= 1 ? `${+command.hours.toFixed(1)}h` : `${Math.round(command.hours * 60)}m`}. Everyone online sees it now; others see it when they open the game.` : '⚠️ Could not publish. Try again.');
    }
  } catch { await reply('⚠️ Something went wrong. Try again.'); }
  return ok();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Direct Health & Status probe endpoint
    if (url.pathname === '/health' || url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'funaab-life-backend',
          environment: env.ENVIRONMENT || 'production',
          // Lets a deploy be verified from the browser: older Workers silently ignore new messages.
          features: ['campus_bet', 'trusted_catchup', 'football', 'basketball', 'volleyball', 'volleyball_rally', 'daily_plan', 'hustles', 'feedback', 'held_item'],
          timestamp: Date.now(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Telegram bot webhook: the owner's /notification becomes a campus announcement.
    if (url.pathname === '/telegram/webhook') {
      return handleTelegramWebhook(request, env);
    }
    if (url.pathname.startsWith('/__')) return new Response('Not found', { status: 404 });

    // 2. CORS Preflight
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin') || '*';
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }

    // 3. Durable Object Routing
    const roomId = url.searchParams.get('room') || 'world:funaab:main';
    if (!/^world:funaab:(main|library|hostel|hostel-room:[0-9a-f-]{36})$/.test(roomId)) return new Response('Unknown world',{status:400});
    const id = env.WORLD_ROOM.idFromName(roomId);
    const stub = env.WORLD_ROOM.get(id);

    const isWebSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    // CRITICAL: For WebSocket upgrades, return stub.fetch directly to preserve response.webSocket!
    if (isWebSocket) {
      return stub.fetch(request);
    }

    // Standard HTTP request forwarding
    const response = await stub.fetch(request);
    const origin = request.headers.get('Origin') || '*';
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', origin);
    newHeaders.set('Access-Control-Allow-Credentials', 'true');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
