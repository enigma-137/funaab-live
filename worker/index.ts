// Cloudflare Worker + Durable Objects Multiplayer Room for FUNAAB Life

export interface Env {
  WORLD_ROOM: DurableObjectNamespace;
}

export class WorldRoomDO {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, { id: string; username: string; college: string; avatarConfig: any }>;
  private players: Map<string, any>;
  private kekes: Map<string, any>;
  private psMatches: Map<string, any>;
  private tickInterval: any;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
    this.players = new Map();
    this.kekes = new Map();
    this.psMatches = new Map();

    // Initialize Keke simulation in DO
    this.kekes.set('keke-1', {
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
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          playersCount: this.players.size,
          players: Array.from(this.players.values()),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('FUNAAB Life Durable Object Room Ready', { status: 200 });
  }

  private async handleSession(webSocket: WebSocket) {
    webSocket.accept();

    let sessionPlayerId: string | null = null;

    webSocket.addEventListener('message', async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);

        switch (data.type) {
          case 'join': {
            const { user } = data;
            sessionPlayerId = user.id;

            this.sessions.set(webSocket, {
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

            this.players.set(user.id, playerState);

            // Send init payload to newly joined client
            webSocket.send(
              JSON.stringify({
                type: 'init',
                yourId: user.id,
                players: Object.fromEntries(this.players),
                kekes: Object.fromEntries(this.kekes),
                activeMatches: Object.fromEntries(this.psMatches),
              })
            );

            // Broadcast to other peers
            this.broadcast(
              JSON.stringify({
                type: 'player_joined',
                player: playerState,
              }),
              webSocket
            );
            break;
          }

          case 'move': {
            if (!sessionPlayerId) return;
            const existing = this.players.get(sessionPlayerId);
            if (existing) {
              existing.position = data.position;
              existing.rotation = data.rotation;
              existing.animation = data.animation;
              existing.kekeRiding = data.kekeRiding;
              existing.lastUpdated = Date.now();
            }
            break;
          }

          case 'chat': {
            if (!sessionPlayerId) return;
            const player = this.players.get(sessionPlayerId);
            if (!player) return;

            const chatMsg = {
              type: 'chat_message',
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              senderId: sessionPlayerId,
              senderName: player.username,
              college: player.college,
              text: data.text.slice(0, 300), // sanitize length
              timestamp: Date.now(),
              position: player.position,
            };

            this.broadcast(JSON.stringify(chatMsg));
            break;
          }

          case 'keke_enter': {
            if (!sessionPlayerId) return;
            const keke = this.kekes.get(data.kekeId || 'keke-1');
            if (keke && keke.passengers.length < 3 && !keke.passengers.includes(sessionPlayerId)) {
              keke.passengers.push(sessionPlayerId);
              this.broadcast(
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
            const keke = this.kekes.get(data.kekeId || 'keke-1');
            if (keke) {
              keke.passengers = keke.passengers.filter((id: string) => id !== sessionPlayerId);
              this.broadcast(
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
            const player = this.players.get(sessionPlayerId);
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
            this.psMatches.set(matchId, match);
            this.broadcast(JSON.stringify({ type: 'ps_match_update', match }));
            break;
          }

          case 'ps_challenge_join': {
            if (!sessionPlayerId) return;
            const player = this.players.get(sessionPlayerId);
            const match = this.psMatches.get(data.matchId);
            if (match && match.status === 'waiting') {
              match.guestId = sessionPlayerId;
              match.guestName = player?.username || 'Player 2';
              match.status = 'in_progress';
              match.updatedAt = Date.now();
              this.broadcast(JSON.stringify({ type: 'ps_match_update', match }));
            }
            break;
          }

          case 'ps_action': {
            if (!sessionPlayerId) return;
            const match = this.psMatches.get(data.matchId);
            if (!match || match.status !== 'in_progress') return;

            if (sessionPlayerId === match.hostId) {
              match.hostChoice = data.choice;
            } else if (sessionPlayerId === match.guestId) {
              match.guestChoice = data.choice;
            }

            // If both players picked their direction/move
            if (match.hostChoice && match.guestChoice) {
              // Host is Shooter, Guest is Goalkeeper for odd rounds, flip for even
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
              this.broadcast(JSON.stringify({ type: 'ps_match_update', match }));
            } else {
              // Wait for other player's turn
              this.broadcast(JSON.stringify({ type: 'ps_match_update', match }));
            }
            break;
          }
        }
      } catch (err) {
        console.error('DO WebSocket Error:', err);
      }
    });

    const cleanup = () => {
      if (sessionPlayerId) {
        this.players.delete(sessionPlayerId);
        // Remove from keke if riding
        this.kekes.forEach((keke) => {
          keke.passengers = keke.passengers.filter((id: string) => id !== sessionPlayerId);
        });
        this.broadcast(JSON.stringify({ type: 'player_left', id: sessionPlayerId }));
      }
      this.sessions.delete(webSocket);
    };

    webSocket.addEventListener('close', cleanup);
    webSocket.addEventListener('error', cleanup);
  }

  private broadcast(message: string, skipSocket?: WebSocket) {
    for (const [ws] of this.sessions) {
      if (ws !== skipSocket) {
        try {
          ws.send(message);
        } catch (e) {
          // Closed socket
        }
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Support multiple world rooms (e.g. world:funaab:main)
    const roomId = url.searchParams.get('room') || 'world:funaab:main';
    const id = env.WORLD_ROOM.idFromName(roomId);
    const stub = env.WORLD_ROOM.get(id);

    return stub.fetch(request);
  },
};
