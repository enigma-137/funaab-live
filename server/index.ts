import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const PORT = 8787;

interface SessionData {
  id: string;
  username: string;
  college: string;
  avatarConfig: any;
}

const server = http.createServer((req, res) => {
  // Add CORS headers for API requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', players: players.size }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

const sessions = new Map<WebSocket, SessionData>();
const players = new Map<string, any>();
const kekes = new Map<string, any>();
const psMatches = new Map<string, any>();

// In-memory mock wallet ledger for local dev
const localWallets = new Map<string, { balance: number; transactions: any[]; inventory: any[] }>();

// Initialize Keke state
kekes.set('keke-1', {
  id: 'keke-1',
  routeId: 'route-alpha',
  position: [-18, 0, 18],
  rotation: 0,
  speed: 4.5,
  currentWaypointIndex: 0,
  passengers: [],
  currentStopName: 'Keke Park',
  isStopped: false,
});

function broadcast(message: string, skipSocket?: WebSocket) {
  for (const [ws] of sessions) {
    if (ws !== skipSocket && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (e) {
        // Socket error
      }
    }
  }
}

// Tick loop to broadcast batch player updates at 10Hz (100ms)
setInterval(() => {
  if (players.size === 0) return;

  const updates: Record<string, any> = {};
  for (const [id, player] of players) {
    updates[id] = {
      position: player.position,
      rotation: player.rotation,
      animation: player.animation,
      kekeRiding: player.kekeRiding,
      kekeId: player.kekeId,
    };
  }

  broadcast(
    JSON.stringify({
      type: 'players_batch',
      updates,
    })
  );
}, 100);

wss.on('connection', (ws: WebSocket) => {
  let sessionPlayerId: string | null = null;

  ws.on('message', (raw: string) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'join': {
          const { user } = data;
          sessionPlayerId = user.id;

          sessions.set(ws, {
            id: user.id,
            username: user.username,
            college: user.college,
            avatarConfig: user.avatarConfig,
          });

          const playerState = {
            id: user.id,
            username: user.username,
            college: user.college,
            avatarConfig: user.avatarConfig,
            position: user.position || [0, 0, 8],
            rotation: user.rotation || 0,
            animation: 'idle',
            lastUpdated: Date.now(),
          };

          players.set(user.id, playerState);

          // Initialize wallet if new
          if (!localWallets.has(user.id)) {
            localWallets.set(user.id, {
              balance: 5000,
              transactions: [
                {
                  id: `tx-${Date.now()}`,
                  userId: user.id,
                  type: 'starter',
                  amount: 5000,
                  balanceAfter: 5000,
                  description: 'FUNAAB Resumption Allowance',
                  createdAt: new Date().toISOString(),
                },
              ],
              inventory: [],
            });
          }

          // Send init payload
          ws.send(
            JSON.stringify({
              type: 'init',
              yourId: user.id,
              players: Object.fromEntries(players),
              kekes: Object.fromEntries(kekes),
              activeMatches: Object.fromEntries(psMatches),
            })
          );

          // Broadcast join to peers
          broadcast(
            JSON.stringify({
              type: 'player_joined',
              player: playerState,
            }),
            ws
          );
          break;
        }

        case 'move': {
          if (!sessionPlayerId) return;
          const player = players.get(sessionPlayerId);
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

        case 'chat': {
          if (!sessionPlayerId) return;
          const player = players.get(sessionPlayerId);
          if (!player) return;

          const chatMsg = {
            type: 'chat_message',
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            senderId: sessionPlayerId,
            senderName: player.username,
            college: player.college,
            text: data.text.slice(0, 300),
            timestamp: Date.now(),
            position: player.position,
          };

          broadcast(JSON.stringify(chatMsg));
          break;
        }

        case 'keke_enter': {
          if (!sessionPlayerId) return;
          const keke = kekes.get(data.kekeId || 'keke-1');
          if (keke && !keke.passengers.includes(sessionPlayerId)) {
            keke.passengers.push(sessionPlayerId);
            const player = players.get(sessionPlayerId);
            if (player) {
              player.kekeRiding = true;
              player.kekeId = keke.id;
            }
            broadcast(
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
          if (!sessionPlayerId) return;
          const keke = kekes.get(data.kekeId || 'keke-1');
          if (keke) {
            keke.passengers = keke.passengers.filter((id: string) => id !== sessionPlayerId);
            const player = players.get(sessionPlayerId);
            if (player) {
              player.kekeRiding = false;
              player.kekeId = undefined;
            }
            broadcast(
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
          if (!sessionPlayerId) return;
          const player = players.get(sessionPlayerId);
          const matchId = `match-${Date.now()}`;
          const match = {
            id: matchId,
            stationId: data.stationId || 'ps5-station-1',
            hostId: sessionPlayerId,
            hostName: player?.username || 'Player 1',
            status: 'waiting',
            currentRound: 1,
            totalRounds: 3,
            hostScore: 0,
            guestScore: 0,
            updatedAt: Date.now(),
          };
          psMatches.set(matchId, match);
          broadcast(JSON.stringify({ type: 'ps_match_update', match }));
          break;
        }

        case 'ps_challenge_join': {
          if (!sessionPlayerId) return;
          const player = players.get(sessionPlayerId);
          const match = psMatches.get(data.matchId);
          if (match && match.status === 'waiting') {
            match.guestId = sessionPlayerId;
            match.guestName = player?.username || 'Player 2';
            match.status = 'in_progress';
            match.updatedAt = Date.now();
            broadcast(JSON.stringify({ type: 'ps_match_update', match }));
          }
          break;
        }

        case 'ps_action': {
          if (!sessionPlayerId) return;
          const match = psMatches.get(data.matchId);
          if (!match || match.status !== 'in_progress') return;

          if (sessionPlayerId === match.hostId) {
            match.hostChoice = data.choice;
          } else if (sessionPlayerId === match.guestId) {
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
              match.roundResult = `SAVED! ${shooterIsHost ? match.guestName : match.hostName} saved it! (Both chose ${shooterChoice})`;
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
            broadcast(JSON.stringify({ type: 'ps_match_update', match }));
          } else {
            broadcast(JSON.stringify({ type: 'ps_match_update', match }));
          }
          break;
        }
      }
    } catch (err) {
      console.error('Server error:', err);
    }
  });

  ws.on('close', () => {
    if (sessionPlayerId) {
      players.delete(sessionPlayerId);
      kekes.forEach((keke) => {
        keke.passengers = keke.passengers.filter((id: string) => id !== sessionPlayerId);
      });
      broadcast(JSON.stringify({ type: 'player_left', id: sessionPlayerId }));
    }
    sessions.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`> FUNAAB Life Realtime Multiplayer Server running on ws://localhost:${PORT}`);
});
