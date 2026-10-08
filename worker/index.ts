// Cloudflare Worker + Durable Objects Multiplayer Engine for FUNAAB Life (Production Public Beta)

export interface Env {
  WORLD_ROOM: DurableObjectNamespace;
  SUPABASE_JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  ENABLE_GUEST_MODE?: string;
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
  lastUpdated: number;
}

interface KekeState {
  id: string;
  routeId: string;
  position: [number, number, number];
  rotation: number;
  speed: number;
  currentWaypointIndex: number;
  passengers: string[];
  currentStopName: string;
  isStopped: boolean;
}

interface PSMatchState {
  id: string;
  stationId: string;
  hostId: string;
  hostName: string;
  guestId?: string;
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
  updatedAt: number;
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
  }>;
  lecturerSpeech: string;
  boardText: string;
  startedAt: number;
}

const KEKE_WAYPOINTS: Array<{ pos: [number, number, number]; stopName?: string; waitTime?: number }> = [
  { pos: [-22, 0, 20], stopName: 'Main Keke Park', waitTime: 4000 },
  { pos: [-22, 0, 8], stopName: 'Passing Eatery' },
  { pos: [-22, 0, -8], stopName: 'Passing Health Centre' },
  { pos: [-26, 0, -28], stopName: 'COLFHEC / Floral World Stop', waitTime: 4000 },
  { pos: [-8, 0, -28], stopName: 'Passing Senate' },
  { pos: [12, 0, -28], stopName: 'JAO / Library Stop', waitTime: 3500 },
  { pos: [24, 0, -12], stopName: 'Iyalode Hostel Stop', waitTime: 3500 },
  { pos: [24, 0, 16], stopName: 'Bank & ATM Stop', waitTime: 3000 },
  { pos: [0, 0, 20], stopName: 'Passing Landmark Plaza' },
];

function getZoneName(x: number, z: number, currentLectureId?: string): string {
  if (currentLectureId) {
    if (currentLectureId.includes('fst')) return 'In Class — Food Chemistry';
    if (currentLectureId.includes('eng')) return 'In Class — Thermodynamics';
    if (currentLectureId.includes('bio')) return 'In Class — Genetics';
    return 'In Class';
  }
  if (x >= -28 && x <= -20 && z >= -24 && z <= -16) return 'Floral World';
  if (x >= -52 && x <= -24 && z >= -14 && z <= 14) return 'Sports Centre';
  if (x >= -32 && x <= -12 && z >= 12 && z <= 28) return 'Main Car Park';
  if (x >= -24 && x <= -16 && z >= 0 && z <= 10) return 'Campus Eatery';
  if (x >= -26 && x <= -14 && z >= -16 && z <= -4) return 'Health Centre';
  if (x >= -36 && x <= -20 && z >= -40 && z <= -24) return 'COLFHEC';
  if (x >= -16 && x <= 16 && z >= -38 && z <= -20) return 'Senate & Library';
  if (x >= 18 && x <= 30 && z >= 12 && z <= 24) return 'Bank & ATM';
  if (x >= 20 && x <= 34 && z >= -18 && z <= -4) return 'Iyalode Hostel';
  if (x >= -12 && x <= 12 && z >= 12 && z <= 24) return 'W-Landmark Plaza';
  if (x >= -6 && x <= 6 && z >= 26 && z <= 50) return 'Main Gate';
  return 'Campus Grounds';
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
  private isSimulationRunning: boolean = false;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.players = new Map();
    this.kekes = new Map();
    this.psMatches = new Map();
    this.lectureRooms = new Map();

    // Initialize campus Keke vehicle
    this.kekes.set('keke-1', {
      id: 'keke-1',
      routeId: 'route-alpha',
      position: [-22, 0, 20],
      rotation: 0,
      speed: 4.8,
      currentWaypointIndex: 0,
      passengers: [],
      currentStopName: 'Main Keke Park',
      isStopped: false,
    });

    this.startSimulationLoop();
  }

  private startSimulationLoop() {
    if (this.isSimulationRunning) return;
    this.isSimulationRunning = true;

    // Run 10Hz tick for batch updates & Keke simulation
    setInterval(() => {
      this.tickKekeSimulation();
      this.broadcastBatchPlayers();
    }, 100);
  }

  private tickKekeSimulation() {
    const keke = this.kekes.get('keke-1');
    if (!keke) return;

    const currentWP = KEKE_WAYPOINTS[keke.currentWaypointIndex];
    if (!currentWP) return;

    if (keke.isStopped) {
      if (Date.now() > this.kekeWaypointTimer) {
        keke.isStopped = false;
        keke.currentWaypointIndex = (keke.currentWaypointIndex + 1) % KEKE_WAYPOINTS.length;
      }
      return;
    }

    const [tx, , tz] = currentWP.pos;
    const [cx, cy, cz] = keke.position;
    const dx = tx - cx;
    const dz = tz - cz;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.8) {
      if (currentWP.stopName && currentWP.waitTime) {
        keke.isStopped = true;
        keke.currentStopName = currentWP.stopName;
        this.kekeWaypointTimer = Date.now() + currentWP.waitTime;
      } else {
        keke.currentWaypointIndex = (keke.currentWaypointIndex + 1) % KEKE_WAYPOINTS.length;
      }
    } else {
      const step = 0.45;
      const angle = Math.atan2(dx, dz);
      keke.position = [cx + Math.sin(angle) * step, cy, cz + Math.cos(angle) * step];
      keke.rotation = angle;
    }
  }

  private broadcastBatchPlayers() {
    if (this.players.size === 0) return;

    const updates: Record<string, any> = {};
    for (const [connId, player] of this.players) {
      updates[connId] = {
        id: player.id,
        connectionId: connId,
        username: player.username,
        college: player.college,
        avatarConfig: player.avatarConfig,
        position: player.position,
        rotation: player.rotation,
        animation: player.animation,
        kekeRiding: player.kekeRiding,
        kekeId: player.kekeId,
        currentLectureId: player.currentLectureId,
        currentZone: player.currentLectureId
          ? getZoneName(0, 0, player.currentLectureId)
          : (player.currentZone || getZoneName(player.position?.[0] || 0, player.position?.[2] || 0)),
      };
    }

    const payload = JSON.stringify({
      type: 'players_batch',
      updates,
      kekes: Object.fromEntries(this.kekes),
    });

    for (const [ws, session] of this.sessions) {
      if (ws.readyState === WebSocket.OPEN && session.room === 'world:funaab:main') {
        try {
          ws.send(payload);
        } catch (e) {}
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const isWebSocket = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    if (isWebSocket) {
      const token = url.searchParams.get('token');
      console.log('[WS] WebSocket upgrade received at path:', url.pathname, token ? '(token present)' : '(no token)');
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleSession(server, token);

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

  private async handleSession(webSocket: WebSocket, initialToken: string | null) {
    webSocket.accept();

    let sessionConnId: string | null = null;
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

        switch (data.type) {
          case 'join': {
            const { player, room = 'world:funaab:main', token } = data;
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

            sessionRoom = room;
            const assignedConnId: string =
              player.connectionId || `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            sessionConnId = assignedConnId;

            const sessionData: SessionData = {
              connectionId: assignedConnId,
              id: authenticatedUserId,
              username: String(player.username || 'Student').slice(0, 24),
              college: String(player.college || 'COLENG').slice(0, 16),
              avatarConfig: player.avatarConfig || {},
              room: sessionRoom,
              lastPacketTime: Date.now(),
              packetCount: 1,
            };

            this.sessions.set(webSocket, sessionData);

            const playerState: PlayerState = {
              id: authenticatedUserId,
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

          case 'move': {
            if (!sessionConnId) return;
            const player = this.players.get(sessionConnId);
            if (player) {
              player.position = data.position;
              player.rotation = data.rotation;
              player.animation = data.animation;
              player.kekeRiding = data.kekeRiding;
              player.kekeId = data.kekeId;
              player.lastUpdated = Date.now();
            }
            break;
          }

          case 'ping': {
            webSocket.send(JSON.stringify({ type: 'pong', t: data.t }));
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

          case 'keke_enter': {
            if (!sessionConnId) return;
            const keke = this.kekes.get(data.kekeId || 'keke-1');
            if (keke && keke.passengers.length < 3 && !keke.passengers.includes(sessionConnId)) {
              keke.passengers.push(sessionConnId);
              const player = this.players.get(sessionConnId);
              if (player) {
                player.kekeRiding = true;
                player.kekeId = keke.id;
              }

              this.broadcastToRoom(
                'world:funaab:main',
                JSON.stringify({
                  type: 'keke_sync',
                  kekeId: keke.id,
                  position: keke.position,
                  rotation: keke.rotation,
                  passengers: keke.passengers,
                  currentStopName: keke.currentStopName,
                })
              );
            }
            break;
          }

          case 'keke_exit': {
            if (!sessionConnId) return;
            const keke = this.kekes.get(data.kekeId || 'keke-1');
            if (keke) {
              keke.passengers = keke.passengers.filter((id) => id !== sessionConnId);
              const player = this.players.get(sessionConnId);
              if (player) {
                player.kekeRiding = false;
                player.kekeId = undefined;
              }

              this.broadcastToRoom(
                'world:funaab:main',
                JSON.stringify({
                  type: 'keke_sync',
                  kekeId: keke.id,
                  position: keke.position,
                  rotation: keke.rotation,
                  passengers: keke.passengers,
                  currentStopName: keke.currentStopName,
                })
              );
            }
            break;
          }

          case 'ps_challenge_create': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            const matchId = `match-${Date.now()}`;
            const match: PSMatchState = {
              id: matchId,
              stationId: data.stationId || 'ps5-station-1',
              hostId: sessionConnId,
              hostName: session?.username || 'Player 1',
              status: 'waiting',
              currentRound: 1,
              totalRounds: 3,
              hostScore: 0,
              guestScore: 0,
              updatedAt: Date.now(),
            };
            this.psMatches.set(matchId, match);
            this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'ps_match_update', match }));
            break;
          }

          case 'ps_challenge_join': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            const match = this.psMatches.get(data.matchId);
            if (match && match.status === 'waiting' && match.hostId !== sessionConnId) {
              match.guestId = sessionConnId;
              match.guestName = session?.username || 'Player 2';
              match.status = 'in_progress';
              match.updatedAt = Date.now();
              this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'ps_match_update', match }));
            }
            break;
          }

          case 'ps_action': {
            if (!sessionConnId) return;
            const match = this.psMatches.get(data.matchId);
            if (!match || match.status !== 'in_progress') return;

            if (sessionConnId === match.hostId) {
              match.hostChoice = data.choice;
            } else if (sessionConnId === match.guestId) {
              match.guestChoice = data.choice;
            }

            if (match.hostChoice && match.guestChoice) {
              const shooterIsHost = match.currentRound % 2 === 1;
              const shooterChoice = shooterIsHost ? match.hostChoice : match.guestChoice;
              const keeperChoice = shooterIsHost ? match.guestChoice : match.hostChoice;

              const isGoal = shooterChoice !== keeperChoice;
              if (isGoal) {
                if (shooterIsHost) match.hostScore++;
                else match.guestScore++;
                match.roundResult = `GOAL! ${shooterIsHost ? match.hostName : match.guestName} scored! (Shot: ${shooterChoice} | Dive: ${keeperChoice})`;
              } else {
                match.roundResult = `SAVED! ${shooterIsHost ? match.guestName : match.hostName} saved it! (Both picked ${shooterChoice})`;
              }

              if (match.currentRound >= match.totalRounds) {
                match.status = 'finished';
                if (match.hostScore > match.guestScore) match.winnerName = match.hostName;
                else if (match.guestScore > match.hostScore) match.winnerName = match.guestName;
                else match.winnerName = 'Tie Game!';
              } else {
                match.currentRound++;
                match.hostChoice = undefined;
                match.guestChoice = undefined;
              }
              match.updatedAt = Date.now();
              this.broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'ps_match_update', match }));
            }
            break;
          }

          // LECTURE & CLASSROOM SYSTEM
          case 'lecture_enter': {
            if (!sessionConnId) return;
            const session = this.sessions.get(webSocket);
            if (!session) return;

            const lectureId = String(data.lectureId || '');
            const seatNumber = Number(data.seatNumber) || 1;

            session.room = `world:funaab:lecture:${lectureId}`;
            session.currentLectureId = lectureId;
            session.seatNumber = seatNumber;

            const player = this.players.get(sessionConnId);
            if (player) {
              player.currentLectureId = lectureId;
              player.seatNumber = seatNumber;
              player.currentZone = getZoneName(0, 0, lectureId);
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
                amount: 500,
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
                reward: Number(data.reward) || 300,
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
      }
    });

    const cleanup = () => {
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
          keke.passengers = keke.passengers.filter((id) => id !== sessionConnId);
        });

        this.players.delete(sessionConnId);

        // Broadcast player_left to main world
        this.broadcastToRoom(
          'world:funaab:main',
          JSON.stringify({
            type: 'player_left',
            connectionId: sessionConnId,
            id: session?.id,
          })
        );
      }
      this.sessions.delete(webSocket);
    };

    webSocket.addEventListener('close', cleanup);
    webSocket.addEventListener('error', cleanup);
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
