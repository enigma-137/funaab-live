import { useLevelStore } from '../../stores/levelStore';
import { CAMPUS_SPAWN } from '../../config/campusLocations';
import { TABLE_ITEM_MS, isHeldKind, type HeldKind } from '../../config/heldItems';
import { useHostelStore } from '../../stores/hostelStore';
import { useInputStore } from '../../stores/inputStore';
import { normalizeAvatar } from '../../config/avatar';
import { PlayerProfile, PlayerState } from '../../types/game';
import { useGameStore } from '../../stores/gameStore';
import { useSocialStore } from '../../stores/socialStore';
import { useWalletStore } from '../../stores/walletStore';
import { useLectureStore } from '../../stores/lectureStore';
import { useAuthStore } from '../../stores/authStore';
import { gameSound } from '../audio/gameAudio';
import { hasMeaningfulMovementChange, type MovementSnapshot } from './movementSync';
import { useFootballStore } from '../../stores/footballStore';
import { useBasketballStore, useVolleyballStore } from '../../stores/courtGameStore';
import { useRallyStore } from '../../stores/rallyStore';
import { usePartyStore } from '../../stores/partyStore';
import { useNoticeStore } from '../../stores/noticeStore';
import { useDailyPlanStore } from '../../stores/dailyPlanStore';
import { useHustleStore } from '../../stores/hustleStore';
import { toast } from '../../stores/toastStore';

class NetworkManager {
  public room = 'world:funaab:main';
  private pending = new Map<string,{resolve:(v:any)=>void,reject:(e:Error)=>void}>();
  private connectGeneration = 0;
  private ws: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private currentUser: PlayerProfile | null = null;
  public connectionId: string = '';
  private lastMoveSentTime: number = 0;
  private lastMoveSent: MovementSnapshot | null = null;
  private pendingMove: MovementSnapshot | null = null;
  private pendingMoveTimeout: ReturnType<typeof setTimeout> | null = null;
  private waitingForSnapshot = false;
  private targetWsUrl: string = '';
  private pingStartTime: number = 0;

  constructor() {
    this.connectionId = this.generateConnectionId();
    this.resolveTargetUrl();
  }

  private generateConnectionId(): string {
    return `conn_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  }

  public async campusSummary(signal?: AbortSignal) {
    const url = new URL(this.targetWsUrl, window.location.href);
    url.protocol = ['wss:', 'https:'].includes(url.protocol) ? 'https:' : 'http:';
    url.pathname = '/campus-summary';
    url.search = '';
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Campus activity unavailable');
    return response.json() as Promise<import('../../config/campusSummary').CampusSummary>;
  }

  /** The campus announcement the owner sent from Telegram, or null. */
  public async announcement(signal?: AbortSignal) {
    const url = new URL(this.targetWsUrl, window.location.href);
    url.protocol = ['wss:', 'https:'].includes(url.protocol) ? 'https:' : 'http:';
    url.pathname = '/announcement';
    url.search = '';
    const response = await fetch(url, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('No announcement feed');
    return (await response.json()).announcement as import('../../config/broadcast').Announcement | null;
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

  public async action(action: string, jobId?: string, runId?: string): Promise<any> {
    if(this.ws?.readyState!==WebSocket.OPEN) throw new Error('Reconnect to campus before starting work');
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('Job request timed out. Reload jobs to check saved progress.'));},15000);
      this.pending.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.send({type:'job_action',requestId,action,jobId,runId});
    });
  }
  public bookKeke(kekeId:string,destinationId:string):Promise<any>{
    if(this.ws?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Reconnect before booking'));
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('Booking timed out. Check your ride before retrying.'));},20000);
      this.pending.set(requestId,{resolve:v=>{clearTimeout(timer);if(typeof v.balance==='number')useWalletStore.setState({balance:v.balance});resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.send({type:'keke_book',requestId,kekeId,destinationId});
    });
  }
  /** Campus Bet: the Worker validates and the database decides results and payouts. */
  public campusBet(op:'state'|'place',payload:Record<string,unknown>={}):Promise<any>{
    if(this.ws?.readyState!==WebSocket.OPEN||this.room!=='world:funaab:main')return Promise.reject(new Error('Reconnect to campus to use Campus Bet'));
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('Campus Bet got no reply from the game server. If this keeps happening, the multiplayer Worker may need redeploying.'));},15000);
      this.pending.set(requestId,{resolve:v=>{clearTimeout(timer);if(typeof v?.balance==='number')useWalletStore.setState({balance:v.balance});resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.send({type:'campus_bet',requestId,op,...payload});
    });
  }
  /** In-game feedback: the Worker adds the player's identity and place, then forwards it to Telegram. */
  public sendFeedback(payload:{kind:string;message:string;name:string;contact?:string;device:string}):Promise<{sent:boolean}>{
    if(this.ws?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('You are offline. Reconnect, then send again.'));
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('No reply from the game server. Please try again in a minute.'));},15000);
      this.pending.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.send({type:'feedback',requestId,...payload});
    });
  }
  /** Penalty challenge: only aim + power leave the client; the Worker decides every result. */
  public football(op:string,payload:Record<string,unknown>={}):Promise<any>{
    if(this.ws?.readyState!==WebSocket.OPEN||this.room!=='world:funaab:main')return Promise.reject(new Error('Reconnect to campus to play football'));
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('The pitch did not answer. If this keeps happening, the multiplayer Worker may need redeploying.'));},10000);
      this.pending.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.send({type:'football',requestId,op,...payload});
    });
  }
  /** Court games (basketball free throws, volleyball serves): aim + power out, verdict back. */
  public court(game:'basketball'|'volleyball'|'volleyball_rally'|'party'|'arcade',op:string,payload:Record<string,unknown>={}):Promise<any>{
    if(this.ws?.readyState!==WebSocket.OPEN||this.room!=='world:funaab:main')return Promise.reject(new Error(`Reconnect to campus to play ${game}`));
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('The court did not answer. If this keeps happening, the multiplayer Worker may need redeploying.'));},10000);
      this.pending.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.send({type:game,requestId,op,...payload});
    });
  }
  /** Hustles that need proof of place/time (POS, photos, tutoring, errand handover). */
  public hustle(op:string,payload:Record<string,unknown>={}):Promise<any>{
    if(this.ws?.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Reconnect to campus first'));
    const requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('No reply from campus. Try again.'));},12000);
      this.pending.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.send({type:'hustle',requestId,op,...payload});
    });
  }
  public roomChanged() { this.send({type:'room_changed'}); }
  public switchRoom(room: string, user: PlayerProfile) {
    this.disconnect(); this.room=room; this.connectionId=this.generateConnectionId();
    useSocialStore.setState({messages: [], unreadCount: 0});
    useGameStore.setState({players:{},kekes:{},activeMatches:{},currentMatch:null,nearbyInteractable:null,isRidingKeke:false,seatedAt:null});
    return this.connect(user);
  }
  public async connect(user: PlayerProfile) {
    this.currentUser = user;
    const generation = ++this.connectGeneration;
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
      if (generation !== this.connectGeneration || !this.currentUser) return;
      let wsUrl = this.targetWsUrl;
      if (token) {
        const separator = wsUrl.includes('?') ? '&' : '?';
        wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
      }

      wsUrl += `${wsUrl.includes('?')?'&':'?'}room=${encodeURIComponent(this.room)}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        const user = this.currentUser;
        if (!user) return;
        this.clearPendingMove();
        this.lastMoveSent = null;
        this.lastMoveSentTime = 0;
        this.waitingForSnapshot = true;
        useGameStore.getState().setConnectionStatus('connected');
        console.log('[WS] connected to', this.targetWsUrl);

        const store = useGameStore.getState();
        // Send join packet with connectionId, profile, and auth token
        this.send({
          type: 'join',
          room: this.room,
          token: token || undefined,
          player: {
            id: user.id,
            connectionId: this.connectionId,
            username: user.username,
            college: user.college,
            avatarConfig: normalizeAvatar(user.avatarConfig),
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

      this.ws.onclose = (event) => {
        if(useGameStore.getState().isRidingKeke){
          useGameStore.getState().setRidingKeke(false,null,null);
          useGameStore.getState().setMyPosition(CAMPUS_SPAWN);useHostelStore.setState({teleport:CAMPUS_SPAWN});
        }

        if(event.code===1008) { window.dispatchEvent(new CustomEvent(this.room === 'world:funaab:library' ? 'library-access-ended' : 'hostel-access-ended',{detail:event.reason})); this.clearPendingMove(); this.stopHeartbeat(); return; }
        useGameStore.getState().setConnectionStatus('disconnected');
        this.clearPendingMove();
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
      case 'action_result': {
        const pending=this.pending.get(data.requestId); this.pending.delete(data.requestId);
        if (data.error) pending?.reject(new Error(data.error)); else pending?.resolve(data.result); return;
      }
      case 'room_changed': window.dispatchEvent(new Event('hostel-room-changed')); return;
      case 'campus_bet_settled': { window.dispatchEvent(new Event('campus-bet-settled')); const user=useAuthStore.getState().user; if(user) useWalletStore.getState().loadWallet(user.id); return; }
      case 'announcement': useNoticeStore.getState().receive(data.announcement ?? null); return;
      case 'level_refresh': void useLevelStore.getState().load(); return;
      case 'wallet_refresh': { const user=useAuthStore.getState().user; if(user) useWalletStore.getState().loadWallet(user.id); void useDailyPlanStore.getState().load(); void useLevelStore.getState().load(); return; }
      case 'daily_plan_refresh': void useDailyPlanStore.getState().load(); return;
      case 'hustle_notice': toast({ icon: data.icon || '💼', text: String(data.text || ''), tone: 'info', ms: 4500 }); void useHustleStore.getState().loadErrands(); return;
      case 'reward_error': window.dispatchEvent(new CustomEvent('hostel-notice',{detail:data.message})); return;

      case 'init':
      case 'snapshot': {
        this.waitingForSnapshot = false;
        this.lastMoveSent = null;
        this.lastMoveSentTime = 0;
        if (data.yourConnectionId) {
          this.connectionId=data.yourConnectionId;
          gameStore.setMyConnectionId(this.connectionId);
        }
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
        gameStore.setRidingKeke(false,null,null);
        if (data.activeMatches) gameStore.setMatches(data.activeMatches);
        if (data.football) useFootballStore.getState().receive(data.football, true);
        if (data.basketball) useBasketballStore.getState().receive(data.basketball, true);
        if (data.volleyball) useVolleyballStore.getState().receive(data.volleyball, true);
        if (data.rally) useRallyStore.getState().receive(data.rally, true);
        if (data.arcade) usePartyStore.getState().receive(data.arcade);

        const account=useAuthStore.getState().user;if(account)void useWalletStore.getState().loadWallet(account.id);
        console.log(`[WS] joined ${this.room}`);
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
              text: `@${player.username} (${player.college}) joined ${this.room === 'world:funaab:library' ? 'the library' : 'the room'}!`,
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

      case 'keke_dropoff': {
        gameStore.setRidingKeke(false,null,null);useInputStore.getState().clearTargetDestination();
        useHostelStore.setState({teleport:data.position});gameStore.setMyPosition(data.position);return;
      }
      case 'players_batch': {
        if(data.kekes){
          gameStore.setKekes(data.kekes);
          const riding=Object.values(data.kekes).find((k:any)=>k.passengers?.includes(this.connectionId)) as any;
          if(riding)gameStore.setRidingKeke(true,riding.id,riding.targets?.[this.connectionId]||riding.destinationId||null);
          else if(gameStore.isRidingKeke)gameStore.setRidingKeke(false,null,null);
        }

        // High frequency batch updates
        for (const [id, update] of Object.entries(data.updates || {})) {
          if (id !== this.connectionId) {
            gameStore.updatePlayer(id, update as any);
          }
        }
        break;
      }

      case 'avatar_updated': {
        if (data.connectionId !== this.connectionId) gameStore.updatePlayer(data.connectionId, { avatarConfig: normalizeAvatar(data.avatarConfig) });
        break;
      }

      case 'held_item': {
        // Another student bought food or a drink: show it in their hand.
        if (data.connectionId !== this.connectionId && isHeldKind(data.kind)) {
          const ms = Math.min(Math.max(Number(data.ms) || 0, 0), TABLE_ITEM_MS);
          gameStore.updatePlayer(data.connectionId, { heldItem: { kind: data.kind, until: Date.now() + ms } });
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

      // Real classmates in your lecture (seat, hand raised). The server only sends these to the class.
      case 'lecture_room_snapshot':
      case 'lecture_student_joined':
      case 'lecture_student_left':
      case 'lecture_hand_raise_sync': {
        const lecture = useLectureStore.getState();
        const state = lecture.classroomState;
        if (!state) break;
        const students = { ...state.activeStudents };
        const toSeat = (st: any) => ({ connectionId: st.connectionId, username: st.username, college: st.college, seatNumber: st.seatNumber, handRaised: !!st.isHandRaised });
        if (data.type === 'lecture_room_snapshot') {
          if (data.lectureId && data.lectureId !== state.lectureId) break;
          for (const k of Object.keys(students)) delete students[k];
          for (const st of Object.values<any>(data.roomState?.activeStudents || {})) if (st.connectionId !== this.connectionId) students[st.connectionId] = toSeat(st);
        } else if (data.type === 'lecture_student_joined') {
          if (data.student && data.student.connectionId !== this.connectionId) students[data.student.connectionId] = toSeat(data.student);
        } else if (data.type === 'lecture_student_left') {
          delete students[data.connectionId];
        } else if (students[data.connectionId]) {
          students[data.connectionId] = { ...students[data.connectionId], handRaised: !!data.isHandRaised };
        }
        lecture.syncClassroomState({ ...state, activeStudents: students });
        break;
      }

      case 'lecture_chat_message': {
        // Classroom chat: tag it with this class so it shows in the class chat, not campus chat.
        const lectureId = data.lectureId || useLectureStore.getState().currentLecture?.id;
        if (lectureId && data.text) socialStore.addMessage({ ...data, lectureId });
        break;
      }

      case 'private_chat_message': {
        const msg = data.message || data;
        if (msg && msg.text) {
          if (msg.senderId && msg.senderId !== useAuthStore.getState().user?.id) gameSound.chime();
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

      case 'football_state': {
        if (data.football) useFootballStore.getState().receive(data.football);
        break;
      }
      case 'basketball_state': {
        if (data.basketball) useBasketballStore.getState().receive(data.basketball);
        break;
      }
      case 'volleyball_state': {
        if (data.volleyball) useVolleyballStore.getState().receive(data.volleyball);
        break;
      }
      case 'arcade_state': usePartyStore.getState().receive(data); return;
      case 'volleyball_rally_state': {
        if (data.rally) useRallyStore.getState().receive(data.rally);
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
    if (this.ws?.readyState !== WebSocket.OPEN || this.waitingForSnapshot) return;
    this.pendingMove = { position: [...position], rotation, animation, kekeRiding };
    this.flushPendingMove();
  }

  private flushPendingMove() {
    const next = this.pendingMove;
    if (!next || this.ws?.readyState !== WebSocket.OPEN || this.waitingForSnapshot) return;
    const previous = this.lastMoveSent;
    if (!hasMeaningfulMovementChange(previous, next)) {
      this.pendingMove = null;
      return;
    }

    const elapsed = Date.now() - this.lastMoveSentTime;
    if (previous && elapsed < 95) {
      if (this.pendingMoveTimeout === null) {
        this.pendingMoveTimeout = setTimeout(() => {
          this.pendingMoveTimeout = null;
          this.flushPendingMove();
        }, 95 - elapsed);
      }
      return;
    }

    this.pendingMove = null;
    this.lastMoveSent = next;
    this.lastMoveSentTime = Date.now();
    this.send({
      type: 'move',
      connectionId: this.connectionId,
      ...next,
    });
  }

  private clearPendingMove() {
    if (this.pendingMoveTimeout !== null) {
      clearTimeout(this.pendingMoveTimeout);
      this.pendingMoveTimeout = null;
    }
    this.pendingMove = null;
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

  /** Withdraw your Game Den challenge, or forfeit the match you're in. */
  public leavePSMatch() {
    this.send({ type: 'ps_leave' });
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
      isHandRaised: raised, // the field the Worker reads
    });
  }

  public sendClassroomChat(lectureId: string, text: string) {
    // The Worker's classroom chat message is 'lecture_chat' (it answers with 'lecture_chat_message').
    this.send({
      type: 'lecture_chat',
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

  /** Tell the room this student is now carrying something they bought. */
  public holdItem(kind: HeldKind, ms: number) {
    this.send({ type: 'held_item', kind, ms });
  }

  public updateAvatar(user: PlayerProfile) {
    this.currentUser = user;
    this.send({ type: 'avatar_update', avatarConfig: normalizeAvatar(user.avatarConfig) });
  }

  public disconnect() {
    for(const p of this.pending.values()) p.reject(new Error("Connection changed; reconnect and check your ride or saved job"));
    this.pending.clear();
    this.currentUser = null;
    this.connectGeneration++;
    this.clearPendingMove();
    this.waitingForSnapshot = false;
    this.stopHeartbeat();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
    useGameStore.getState().setConnectionStatus('disconnected');
  }
}

export const networkManager = new NetworkManager();
