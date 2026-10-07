import { PlayerProfile } from '../../types/game';
import { useGameStore } from '../../stores/gameStore';
import { useSocialStore } from '../../stores/socialStore';

class NetworkManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private isConnecting: boolean = false;
  private currentUser: PlayerProfile | null = null;
  private lastMoveSentTime: number = 0;
  private targetWsUrl: string = '';

  constructor() {
    const customUrl = import.meta.env.VITE_WS_URL;
    if (customUrl) {
      this.targetWsUrl = customUrl;
    } else {
      const loc = window.location;
      const isHttps = loc.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      // If running Vite on port 5173, point default local multiplayer server to 8787
      if (loc.port === '5173' || loc.port === '3000') {
        this.targetWsUrl = `${wsProtocol}//${loc.hostname}:8787`;
      } else {
        this.targetWsUrl = `${wsProtocol}//${loc.host}/api/ws`;
      }
    }
  }

  public connect(user: PlayerProfile) {
    this.currentUser = user;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    useGameStore.getState().setConnectionStatus('connecting');

    try {
      this.ws = new WebSocket(this.targetWsUrl);

      this.ws.onopen = () => {
        useGameStore.getState().setConnectionStatus('connected');
        // Send join packet
        this.send({
          type: 'join',
          user: {
            id: user.id,
            username: user.username,
            college: user.college,
            avatarConfig: user.avatarConfig,
            position: useGameStore.getState().myPosition,
            rotation: useGameStore.getState().myRotation,
          },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        useGameStore.getState().setConnectionStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('Multiplayer WebSocket error (will retry):', err);
        useGameStore.getState().setConnectionStatus('reconnecting');
      };
    } catch (err) {
      console.warn('Multiplayer connection failed (running in offline preview mode):', err);
      useGameStore.getState().setConnectionStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: any) {
    const gameStore = useGameStore.getState();
    const socialStore = useSocialStore.getState();

    switch (data.type) {
      case 'init': {
        const otherPlayers: Record<string, any> = {};
        for (const [id, player] of Object.entries(data.players || {})) {
          if (id !== this.currentUser?.id) {
            otherPlayers[id] = player;
          }
        }
        gameStore.setPlayers(otherPlayers);
        if (data.kekes) gameStore.setKekes(data.kekes);
        if (data.activeMatches) gameStore.setMatches(data.activeMatches);
        break;
      }

      case 'player_joined': {
        if (data.player && data.player.id !== this.currentUser?.id) {
          gameStore.updatePlayer(data.player.id, data.player);
          socialStore.addMessage({
            id: `sys-join-${Date.now()}`,
            senderId: 'system',
            senderName: 'Campus Security',
            college: data.player.college,
            text: `@${data.player.username} (${data.player.college}) just stepped into campus!`,
            timestamp: Date.now(),
            isSystem: true,
          });
        }
        break;
      }

      case 'player_left': {
        if (data.id) {
          const existing = gameStore.players[data.id];
          if (existing) {
            socialStore.addMessage({
              id: `sys-leave-${Date.now()}`,
              senderId: 'system',
              senderName: 'Campus Security',
              college: existing.college,
              text: `@${existing.username} left the campus.`,
              timestamp: Date.now(),
              isSystem: true,
            });
          }
          gameStore.removePlayer(data.id);
        }
        break;
      }

      case 'players_batch': {
        // High frequency batch updates
        for (const [id, update] of Object.entries(data.updates || {})) {
          if (id !== this.currentUser?.id) {
            gameStore.updatePlayer(id, update as any);
          }
        }
        break;
      }

      case 'chat_message': {
        socialStore.addMessage(data);
        break;
      }

      case 'keke_sync': {
        if (data.kekeId) {
          gameStore.updateKeke(data.kekeId, {
            position: data.position,
            rotation: data.rotation,
            passengers: data.passengers,
            currentStopName: data.currentStopName,
          });
        }
        break;
      }

      case 'ps_match_update': {
        if (data.match) {
          gameStore.updateMatch(data.match);
        }
        break;
      }
    }
  }

  public sendMove(position: [number, number, number], rotation: number, animation: string, kekeRiding = false) {
    const now = Date.now();
    // Throttle to ~10Hz (every 100ms)
    if (now - this.lastMoveSentTime < 95) return;
    this.lastMoveSentTime = now;

    this.send({
      type: 'move',
      position,
      rotation,
      animation,
      kekeRiding,
    });
  }

  public sendChat(text: string) {
    this.send({
      type: 'chat',
      text,
    });
  }

  public enterKeke(kekeId: string) {
    this.send({
      type: 'keke_enter',
      kekeId,
    });
  }

  public exitKeke(kekeId: string) {
    this.send({
      type: 'keke_exit',
      kekeId,
    });
  }

  public createPSChallenge(stationId: string) {
    this.send({
      type: 'ps_challenge_create',
      stationId,
    });
  }

  public joinPSChallenge(matchId: string) {
    this.send({
      type: 'ps_challenge_join',
      matchId,
    });
  }

  public sendPSAction(matchId: string, choice: 'left' | 'center' | 'right') {
    this.send({
      type: 'ps_action',
      matchId,
      choice,
    });
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      if (this.currentUser) {
        this.connect(this.currentUser);
      }
    }, 2500);
  }

  public disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useGameStore.getState().setConnectionStatus('disconnected');
  }
}

export const networkManager = new NetworkManager();
