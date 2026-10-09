import { PlayerProfile, PlayerState } from '../../types/game';
import { useGameStore } from '../../stores/gameStore';
import { useSocialStore } from '../../stores/socialStore';
import { useWalletStore } from '../../stores/walletStore';
import { useLectureStore } from '../../stores/lectureStore';
import { useAuthStore } from '../../stores/authStore';

class NetworkManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private currentUser: PlayerProfile | null = null;
  public connectionId: string = '';
  private lastMoveSentTime: number = 0;
  private targetWsUrl: string = '';
  private pingStartTime: number = 0;

  constructor() {
    this.connectionId = this.generateConnectionId();
    this.resolveTargetUrl();
  }

  private generateConnectionId(): string {
    return `conn_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  }

  private resolveTargetUrl() {
    const customUrl = import.meta.env.VITE_WS_URL;
    if (customUrl) {
      this.targetWsUrl = customUrl;
      return;
    }

    if (typeof window !== 'undefined') {
      const loc = window.location;
      const isHttps = loc.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';

      // If running on localhost or 127.0.0.1 in dev
      if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') {
        this.targetWsUrl = `${wsProtocol}//${loc.hostname}:8787`;
      } else {
        this.targetWsUrl = `${wsProtocol}//${loc.host}/api/ws`;
      }
    }
  }

  public async connect(user: PlayerProfile) {
    this.currentUser = user;
    if (!this.connectionId) {
      this.connectionId = this.generateConnectionId();
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    useGameStore.getState().setConnectionStatus('connecting');
    useGameStore.getState().setMyConnectionId(this.connectionId);

    try {
      const token = await useAuthStore.getState().getAccessToken();
      let wsUrl = this.targetWsUrl;
      if (token) {
        const separator = wsUrl.includes('?') ? '&' : '?';
        wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        useGameStore.getState().setConnectionStatus('connected');
        console.log('[WS] connected to', this.targetWsUrl);

        const store = useGameStore.getState();
        // Send join packet with connectionId, profile, and auth token
        this.send({
          type: 'join',
          room: 'world:funaab:main',
          token: token || undefined,
          player: {
            id: user.id,
            connectionId: this.connectionId,
            username: user.username,
            college: user.college,
            avatarConfig: user.avatarConfig,
            position: store.myPosition,
            rotation: store.myRotation,
            animation: store.myAnimation,
          },
        });

        // Start ping heartbeat
        this.startHeartbeat();
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
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('Multiplayer WebSocket notice:', err);
        useGameStore.getState().setConnectionStatus('reconnecting');
      };
    } catch (err) {
      console.warn('Multiplayer connection error:', err);
      useGameStore.getState().setConnectionStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: any) {
    const gameStore = useGameStore.getState();
    const socialStore = useSocialStore.getState();

    switch (data.type) {
      case 'init':
      case 'snapshot': {
        const otherPlayers: Record<string, PlayerState> = {};
        const incoming = Array.isArray(data.players)
          ? data.players
          : Object.values(data.players || {});

        for (const player of incoming) {
          const p = player as PlayerState;
          const pConnId = p.connectionId || p.id;
          if (pConnId !== this.connectionId && p.id !== this.currentUser?.id) {
            otherPlayers[pConnId] = {
              ...p,
              connectionId: pConnId,
            };
          }
        }

        gameStore.setPlayers(otherPlayers);
        if (data.kekes) gameStore.setKekes(data.kekes);
        if (data.activeMatches) gameStore.setMatches(data.activeMatches);

        console.log(`[WS] joined world:funaab:main`);
        console.log(`[WS] players online: ${Object.keys(otherPlayers).length + 1}`);
        break;
      }

      case 'player_joined': {
        const player = data.player as PlayerState;
        if (player) {
          const pConnId = player.connectionId || player.id;
          if (pConnId !== this.connectionId && player.id !== this.currentUser?.id) {
            gameStore.upsertPlayer({ ...player, connectionId: pConnId });
            socialStore.addMessage({
              id: `sys-join-${Date.now()}`,
              senderId: 'system',
              senderName: 'Campus Security',
              college: player.college,
              text: `@${player.username} (${player.college}) just stepped into campus!`,
              timestamp: Date.now(),
              isSystem: true,
            });
            console.log(`[WS] player joined: @${player.username} (${pConnId})`);
          }
        }
        break;
      }

      case 'player_left': {
        const leftKey = data.connectionId || data.id;
        if (leftKey && leftKey !== this.connectionId) {
          const existing = gameStore.players[leftKey];
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
            console.log(`[WS] player left: @${existing.username} (${leftKey})`);
          }
          gameStore.removePlayer(leftKey);
        }
        break;
      }

      case 'players_batch': {
        // High frequency batch updates
        for (const [id, update] of Object.entries(data.updates || {})) {
          if (id !== this.connectionId) {
            gameStore.updatePlayer(id, update as any);
          }
        }
        break;
      }

      case 'player_state': {
        const pConnId = data.connectionId || data.id;
        if (pConnId && pConnId !== this.connectionId) {
          gameStore.updatePlayer(pConnId, data);
        }
        break;
      }

      case 'chat_message': {
        socialStore.addMessage(data);
        break;
      }

      case 'private_chat_message': {
        const msg = data.message || data;
        if (msg && msg.text) {
          socialStore.addDirectMessage({
            id: msg.id || `dm-${Date.now()}`,
            senderId: msg.senderId,
            senderName: msg.senderName,
            college: msg.college || 'CAMPUS',
            recipientId: msg.recipientId,
            recipientUsername: msg.recipientUsername,
            text: msg.text,
            timestamp: msg.timestamp || Date.now(),
            transferData: msg.transferData,
            isPrivate: true,
          });
        }
        break;
      }

      case 'p2p_transfer_received': {
        useWalletStore.getState().receiveTransfer(data.senderUsername, data.amount);
        socialStore.addMessage({
          id: `msg-tx-${Date.now()}`,
          senderId: 'system-bank',
          senderName: 'FUNAAB Bank',
          college: 'FINANCE',
          text: `💸 @${data.senderUsername} sent you ₦${Number(data.amount).toLocaleString()}!`,
          timestamp: Date.now(),
          isSystem: true,
        });
        gameStore.addActivityEvent({
          id: `evt-tx-${Date.now()}`,
          text: `@${data.senderUsername} sent ₦${data.amount} to @${data.recipientUsername}`,
          type: 'transfer',
          timestamp: Date.now(),
        });
        break;
      }

      case 'activity_event': {
        if (data.event) {
          gameStore.addActivityEvent(data.event);
        }
        break;
      }

      case 'pong': {
        if (this.pingStartTime > 0) {
          const latency = Date.now() - this.pingStartTime;
          gameStore.setPing(latency);
        }
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

      case 'ps_match_started': {
        if (data.match) {
          gameStore.startPSMatch(data.match);
        }
        break;
      }

      case 'classroom_sync': {
        // Room-specific sync of active students in the lecture
        if (data.lectureId && data.classroomState) {
          useLectureStore.getState().syncClassroomState(data.classroomState);
        }
        break;
      }

      case 'classroom_student_joined': {
        const state = useLectureStore.getState().classroomState;
        if (state && data.student) {
          const updated = {
            ...state,
            activeStudents: {
              ...state.activeStudents,
              [data.student.connectionId]: data.student,
            },
          };
          useLectureStore.getState().syncClassroomState(updated);
        }
        break;
      }

      case 'classroom_student_left': {
        const state = useLectureStore.getState().classroomState;
        if (state && data.connectionId) {
          const copy = { ...state.activeStudents };
          delete copy[data.connectionId];
          useLectureStore.getState().syncClassroomState({ ...state, activeStudents: copy });
        }
        break;
      }

      case 'classroom_hand_raise': {
        const state = useLectureStore.getState().classroomState;
        if (state && data.connectionId && state.activeStudents[data.connectionId]) {
          const student = state.activeStudents[data.connectionId];
          const updated = {
            ...state,
            activeStudents: {
              ...state.activeStudents,
              [data.connectionId]: {
                ...student,
                handRaised: data.raised,
              },
            },
          };
          useLectureStore.getState().syncClassroomState(updated);
          if (data.raised) {
            socialStore.addMessage({
              id: `msg-hand-${Date.now()}`,
              senderId: 'classroom',
              senderName: student.username,
              college: student.college,
              text: `✋ @${student.username} raised their hand in class.`,
              timestamp: Date.now(),
              isSystem: true,
              lectureId: data.lectureId,
            });
          }
        }
        break;
      }

      case 'classroom_lecturer_update': {
        useLectureStore.getState().updateLecturerSpeech(data.speech, data.boardTopic);
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
      connectionId: this.connectionId,
      position,
      rotation,
      animation,
      kekeRiding,
    });
  }

  public sendChat(text: string) {
    this.send({
      type: 'chat',
      connectionId: this.connectionId,
      text,
    });
  }

  public enterKeke(kekeId: string, destinationId?: string, destinationName?: string) {
    this.send({
      type: 'keke_enter',
      connectionId: this.connectionId,
      kekeId,
      destinationId,
      destinationName,
    });
  }

  public exitKeke(kekeId: string) {
    this.send({
      type: 'keke_exit',
      connectionId: this.connectionId,
      kekeId,
    });
  }

  public reportLawnFine(officerName: string, fineAmount: number) {
    this.send({
      type: 'lawn_fine_report',
      connectionId: this.connectionId,
      officerName,
      fineAmount,
    });
  }

  public sendP2PTransfer(senderId: string, senderUsername: string, recipientUsername: string, amount: number) {
    this.send({
      type: 'p2p_transfer',
      connectionId: this.connectionId,
      senderId,
      senderUsername,
      recipientUsername,
      amount,
    });
  }

  public sendJobCompleted(jobTitle: string, reward: number) {
    this.send({
      type: 'job_completed',
      connectionId: this.connectionId,
      jobTitle,
      reward,
    });
  }

  public sendDailyRewardClaimed(username: string, amount: number) {
    this.send({
      type: 'daily_reward_claimed',
      connectionId: this.connectionId,
      username,
      amount,
    });
  }

  public createPSChallenge(stationId: string) {
    this.send({
      type: 'ps_challenge_create',
      connectionId: this.connectionId,
      stationId,
    });
  }

  public joinPSChallenge(matchId: string) {
    this.send({
      type: 'ps_challenge_join',
      connectionId: this.connectionId,
      matchId,
    });
  }

  public sendPSAction(matchId: string, choice: 'left' | 'center' | 'right') {
    this.send({
      type: 'ps_action',
      connectionId: this.connectionId,
      matchId,
      choice,
    });
  }

  public enterLectureRoom(lectureId: string, seatNumber: number) {
    this.send({
      type: 'lecture_enter',
      connectionId: this.connectionId,
      lectureId,
      seatNumber,
    });
  }

  public leaveLectureRoom(lectureId: string) {
    this.send({
      type: 'lecture_leave',
      connectionId: this.connectionId,
      lectureId,
    });
  }

  public sendHandRaise(lectureId: string, raised: boolean) {
    this.send({
      type: 'lecture_hand_raise',
      connectionId: this.connectionId,
      lectureId,
      raised,
    });
  }

  public sendClassroomChat(lectureId: string, text: string) {
    this.send({
      type: 'classroom_chat',
      connectionId: this.connectionId,
      lectureId,
      text,
    });
  }

  public sendPrivateChat(
    recipientId: string,
    recipientUsername: string,
    text: string,
    transferData?: { amount: number; note?: string }
  ) {
    if (!this.currentUser) return;
    this.send({
      type: 'private_chat',
      connectionId: this.connectionId,
      senderId: this.currentUser.id,
      senderName: this.currentUser.username,
      college: this.currentUser.college,
      recipientId,
      recipientUsername,
      text,
      transferData,
    });
  }

  public sendUserReport(
    reportedUserId: string,
    reportedUsername: string,
    reason: string,
    details?: string
  ) {
    if (!this.currentUser) return;
    this.send({
      type: 'user_report',
      connectionId: this.connectionId,
      reporterId: this.currentUser.id,
      reporterUsername: this.currentUser.username,
      reportedUserId,
      reportedUsername,
      reason,
      details,
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingStartTime = Date.now();
        this.send({ type: 'ping', t: this.pingStartTime });
      }
    }, 3000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
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
    this.stopHeartbeat();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    useGameStore.getState().setConnectionStatus('disconnected');
  }
}

export const networkManager = new NetworkManager();
