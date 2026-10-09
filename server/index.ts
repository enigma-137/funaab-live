import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const PORT = 8787;

interface SessionData {
  connectionId: string;
  id: string;
  username: string;
  college: string;
  avatarConfig: any;
  room: string;
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', players: players.size, activeSessions: sessions.size }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

// Map of socket -> SessionData
const sessions = new Map<WebSocket, SessionData>();
// Map of connectionId -> PlayerState
const players = new Map<string, any>();
const kekes = new Map<string, any>();
const psMatches = new Map<string, any>();
const lectureRooms = new Map<string, any>();

// In-memory mock wallet ledger for local dev
const localWallets = new Map<string, { balance: number; transactions: any[]; inventory: any[] }>();

// Initialize Keke vehicle state
kekes.set('keke-1', {
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

function broadcastToRoom(room: string, message: string, skipSocket?: WebSocket) {
  for (const [ws, session] of sessions) {
    if (session.room === room && ws !== skipSocket && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (e) {
        // Socket closed
      }
    }
  }
}

// 10Hz tick broadcast for batch movement
setInterval(() => {
  if (players.size === 0) return;

  const updates: Record<string, any> = {};
  for (const [connId, player] of players) {
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

  const batchPayload = JSON.stringify({
    type: 'players_batch',
    updates,
  });

  for (const [ws] of sessions) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(batchPayload);
      } catch (e) {}
    }
  }
}, 100);

function verifySupabaseJwt(token?: string): { sub: string; email?: string; role?: string } | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      console.warn('[JWT] Token expired');
      return null;
    }
    if (!payload.sub) return null;
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch (e) {
    return null;
  }
}

wss.on('connection', (ws: WebSocket, req) => {
  let sessionConnId: string | null = null;
  let sessionRoom: string = 'world:funaab:main';

  // Parse token from query param if provided
  let handshakeToken: string | undefined;
  try {
    if (req.url) {
      const parsedUrl = new URL(req.url, 'http://localhost:8787');
      handshakeToken = parsedUrl.searchParams.get('token') || undefined;
    }
  } catch (e) {}

  ws.on('message', (raw: string) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'join': {
          const { player, room = 'world:funaab:main', token } = data;
          const effectiveToken = token || handshakeToken;
          let authoritativeUserId = player.id;

          if (effectiveToken) {
            const verified = verifySupabaseJwt(effectiveToken);
            if (verified) {
              authoritativeUserId = verified.sub;
            }
          }

          sessionRoom = room;
          const assignedConnId: string = player.connectionId || `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          sessionConnId = assignedConnId;

          const session: SessionData = {
            connectionId: assignedConnId,
            id: authoritativeUserId,
            username: String(player.username || 'Student').slice(0, 24),
            college: String(player.college || 'COLENG').slice(0, 16),
            avatarConfig: player.avatarConfig || {},
            room: sessionRoom,
          };
          sessions.set(ws, session);

          const playerState = {
            id: authoritativeUserId,
            connectionId: assignedConnId,
            username: session.username,
            college: session.college,
            avatarConfig: session.avatarConfig,
            position: Array.isArray(player.position) ? player.position : [0, 0, 8],
            rotation: Number(player.rotation) || 0,
            animation: String(player.animation || 'idle'),
            kekeRiding: false,
            lastUpdated: Date.now(),
          };

          players.set(assignedConnId, playerState);

          console.log(`[WS] connected: ${sessionConnId}`);
          console.log(`[WS] @${session.username} (${session.college}) joined ${sessionRoom}`);
          console.log(`[WS] players online: ${players.size}`);

          // Wallet initialization for dev
          if (!localWallets.has(authoritativeUserId)) {
            localWallets.set(authoritativeUserId, {
              balance: 5000,
              transactions: [
                {
                  id: `tx-${Date.now()}`,
                  userId: authoritativeUserId,
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

          // 1. Send immediate snapshot of all current players to the newcomer
          const roomPlayers: Record<string, any> = {};
          for (const [cId, p] of players) {
            roomPlayers[cId] = p;
          }

          ws.send(
            JSON.stringify({
              type: 'snapshot',
              yourConnectionId: sessionConnId,
              yourId: authoritativeUserId,
              players: roomPlayers,
              kekes: Object.fromEntries(kekes),
              activeMatches: Object.fromEntries(psMatches),
            })
          );

          // 2. Broadcast player_joined to all existing players in the room
          broadcastToRoom(
            sessionRoom,
            JSON.stringify({
              type: 'player_joined',
              player: playerState,
            }),
            ws
          );
          break;
        }

        case 'move': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
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
          ws.send(JSON.stringify({ type: 'pong', t: data.t }));
          break;
        }

        case 'chat': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          if (!player) return;

          const chatMsg = {
            type: 'chat_message',
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            senderId: player.id,
            senderConnectionId: connId,
            senderName: player.username,
            college: player.college,
            text: String(data.text || '').slice(0, 300),
            timestamp: Date.now(),
            position: player.position,
          };

          broadcastToRoom(sessionRoom, JSON.stringify(chatMsg));
          break;
        }

        case 'private_chat': {
          const connId = data.connectionId || sessionConnId;
          const sender = (connId ? players.get(connId) : null) || sessions.get(ws);
          if (!sender) return;

          const recipientId = String(data.recipientId || '').trim();
          const recipientUsername = String(data.recipientUsername || '').trim();
          const text = String(data.text || '').slice(0, 500);

          let targetWs: WebSocket | null = null;
          let targetSession: SessionData | null = null;

          for (const [sWs, sData] of sessions.entries()) {
            if (
              (recipientId && (sData.id === recipientId || sData.connectionId === recipientId)) ||
              (recipientUsername && sData.username.toLowerCase() === recipientUsername.toLowerCase())
            ) {
              targetWs = sWs;
              targetSession = sData;
              break;
            }
          }

          const msgPayload = {
            id: `dm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            senderId: sender.id,
            senderName: sender.username,
            college: sender.college,
            recipientId: targetSession ? targetSession.id : recipientId,
            recipientUsername: targetSession ? targetSession.username : recipientUsername,
            text,
            timestamp: Date.now(),
            isPrivate: true,
            transferData: data.transferData || undefined,
          };

          const outPacket = JSON.stringify({
            type: 'private_chat_message',
            message: msgPayload,
          });

          // Deliver to recipient
          if (targetWs && targetWs.readyState === WebSocket.OPEN && targetWs !== ws) {
            targetWs.send(outPacket);
          }

          // Echo to sender so sender has confirmed DM history
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(outPacket);
          }
          break;
        }

        case 'user_report': {
          const connId = data.connectionId || sessionConnId;
          const reporter = (connId ? players.get(connId) : null) || sessions.get(ws);
          console.log(
            `[SAFETY REPORT] Reporter: @${reporter?.username || data.reporterUsername} | Reported: @${data.reportedUsername} (${data.reportedUserId}) | Reason: ${data.reason} | Details: ${data.details || 'N/A'}`
          );
          break;
        }

        case 'lawn_fine_report': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          if (!player) return;

          const fineAmount = Math.max(0, Number(data.fineAmount) || 500);
          const wallet = localWallets.get(player.id);
          let deducted = 0;
          if (wallet) {
            deducted = Math.min(wallet.balance, fineAmount);
            wallet.balance = Math.max(0, wallet.balance - fineAmount);
            wallet.transactions.unshift({
              id: `tx-fine-${Date.now()}`,
              userId: player.id,
              type: 'lawn_fine',
              amount: -deducted,
              balanceAfter: wallet.balance,
              description: `Campus security lawn fine (${data.officerName || 'Security'})`,
              createdAt: new Date().toISOString(),
            });
          }

          // Broadcast lightweight campus world notice
          const alertMsg = {
            type: 'chat_message',
            id: `fine-msg-${Date.now()}`,
            senderId: 'campus-security',
            senderName: data.officerName || 'Security Officer',
            college: 'SECURITY',
            text: `🚨 @${player.username} was fined ₦${deducted || 500} for walking across the restricted lawn! Keep off the grass!`,
            timestamp: Date.now(),
            isSystem: true,
          };

          broadcastToRoom(sessionRoom, JSON.stringify(alertMsg));
          break;
        }

        case 'keke_enter': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const keke = kekes.get(data.kekeId || 'keke-1');
          if (keke && !keke.passengers.includes(connId)) {
            keke.passengers.push(connId);
            const player = players.get(connId);
            if (player) {
              player.kekeRiding = true;
              player.kekeId = keke.id;
              player.targetDestinationId = data.destinationId;
              player.targetDestinationName = data.destinationName;
            }
            broadcastToRoom(
              sessionRoom,
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
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const keke = kekes.get(data.kekeId || 'keke-1');
          if (keke) {
            keke.passengers = keke.passengers.filter((id: string) => id !== connId);
            const player = players.get(connId);
            if (player) {
              player.kekeRiding = false;
              player.kekeId = undefined;
              player.targetDestinationId = undefined;
              player.targetDestinationName = undefined;
            }
            broadcastToRoom(
              sessionRoom,
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
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          const matchId = `match-${Date.now()}`;
          const match = {
            id: matchId,
            stationId: data.stationId || 'ps5-station-1',
            hostId: player?.id || connId,
            hostConnectionId: connId,
            hostName: player?.username || 'Player 1',
            status: 'waiting',
            currentRound: 1,
            totalRounds: 3,
            hostScore: 0,
            guestScore: 0,
            updatedAt: Date.now(),
          };
          psMatches.set(matchId, match);
          broadcastToRoom(sessionRoom, JSON.stringify({ type: 'ps_match_update', match }));
          break;
        }

        case 'ps_challenge_join': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          const match = psMatches.get(data.matchId);
          if (match && match.status === 'waiting') {
            match.guestId = player?.id || connId;
            match.guestConnectionId = connId;
            match.guestName = player?.username || 'Player 2';
            match.status = 'in_progress';
            match.updatedAt = Date.now();
            broadcastToRoom(sessionRoom, JSON.stringify({ type: 'ps_match_started', match }));
            broadcastToRoom(sessionRoom, JSON.stringify({ type: 'ps_match_update', match }));
          }
          break;
        }

        case 'ps_action': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const match = psMatches.get(data.matchId);
          if (!match || match.status !== 'in_progress') return;

          if (connId === match.hostConnectionId || connId === match.hostId) {
            match.hostChoice = data.choice;
          } else if (connId === match.guestConnectionId || connId === match.guestId) {
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
            broadcastToRoom(sessionRoom, JSON.stringify({ type: 'ps_match_update', match }));
          } else {
            broadcastToRoom(sessionRoom, JSON.stringify({ type: 'ps_match_update', match }));
          }
          break;
        }

        case 'p2p_transfer': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const sender = players.get(connId);
          if (!sender) return;

          const amount = Math.floor(Number(data.amount) || 0);
          const recipientUsername = String(data.recipientUsername || '').trim();

          if (amount <= 0 || amount > 100000) {
            ws.send(JSON.stringify({
              type: 'p2p_transfer_failed',
              error: 'Invalid transfer amount',
            }));
            return;
          }

          if (sender.username.toLowerCase() === recipientUsername.toLowerCase()) {
            ws.send(JSON.stringify({
              type: 'p2p_transfer_failed',
              error: 'Cannot transfer money to yourself',
            }));
            return;
          }

          // Find recipient in active players or sessions
          let recipientPlayer: any = null;
          let recipientConn: WebSocket | null = null;
          for (const [otherWs, sessionData] of sessions.entries()) {
            if (sessionData && sessionData.username && sessionData.username.toLowerCase() === recipientUsername.toLowerCase()) {
              recipientPlayer = players.get(sessionData.connectionId) || sessionData;
              recipientConn = otherWs;
              break;
            }
          }

          const senderWallet = localWallets.get(sender.id);
          if (!senderWallet || senderWallet.balance < amount) {
            ws.send(JSON.stringify({
              type: 'p2p_transfer_failed',
              error: 'Insufficient funds for this transfer',
            }));
            return;
          }

          // Atomic execution
          try {
            senderWallet.balance -= amount;
            senderWallet.transactions.unshift({
              id: `tx-send-${Date.now()}`,
              userId: sender.id,
              type: 'transfer_out',
              amount: -amount,
              balanceAfter: senderWallet.balance,
              description: `Sent to @${recipientUsername}`,
              createdAt: new Date().toISOString(),
            });

            if (recipientPlayer) {
              let recWallet = localWallets.get(recipientPlayer.id);
              if (!recWallet) {
                recWallet = { balance: 5000, transactions: [], inventory: [] };
                localWallets.set(recipientPlayer.id, recWallet);
              }
              recWallet.balance += amount;
              recWallet.transactions.unshift({
                id: `tx-recv-${Date.now()}`,
                userId: recipientPlayer.id,
                type: 'transfer_in',
                amount: amount,
                balanceAfter: recWallet.balance,
                description: `Received from @${sender.username}`,
                createdAt: new Date().toISOString(),
              });

              if (recipientConn && recipientConn.readyState === WebSocket.OPEN) {
                recipientConn.send(JSON.stringify({
                  type: 'p2p_transfer_received',
                  senderUsername: sender.username,
                  recipientUsername: recipientPlayer.username,
                  amount,
                }));
              }
            }

            // Confirm to sender
            ws.send(JSON.stringify({
              type: 'p2p_transfer_success',
              recipientUsername,
              amount,
              newBalance: senderWallet.balance,
            }));

            // Campus activity feed broadcast
            const actEvt = {
              id: `evt-tx-${Date.now()}`,
              text: `@${sender.username} sent ₦${amount.toLocaleString()} to @${recipientUsername} 💸`,
              type: 'transfer',
              timestamp: Date.now(),
            };
            broadcastToRoom(sessionRoom, JSON.stringify({ type: 'activity_event', event: actEvt }));

          } catch (txErr) {
            console.error('Transfer transaction error:', txErr);
            ws.send(JSON.stringify({
              type: 'p2p_transfer_failed',
              error: 'Transaction failed, balance preserved',
            }));
          }
          break;
        }

        case 'job_completed': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          if (!player) return;

          const reward = Math.max(0, Math.min(1000, Number(data.reward) || 250));
          const jobTitle = String(data.jobTitle || 'Campus Job').slice(0, 100);

          const wallet = localWallets.get(player.id);
          if (wallet) {
            wallet.balance += reward;
            wallet.transactions.unshift({
              id: `tx-job-${Date.now()}`,
              userId: player.id,
              type: 'job_reward',
              amount: reward,
              balanceAfter: wallet.balance,
              description: `Completed: ${jobTitle}`,
              createdAt: new Date().toISOString(),
            });
          }

          // Broadcast activity feed
          const jobEvt = {
            id: `evt-job-${Date.now()}`,
            text: `@${player.username} completed ${jobTitle} (+₦${reward.toLocaleString()}) 💼`,
            type: 'job',
            timestamp: Date.now(),
          };
          broadcastToRoom(sessionRoom, JSON.stringify({ type: 'activity_event', event: jobEvt }));
          break;
        }

        case 'daily_reward_claimed': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          if (!player) return;

          const amount = Math.max(0, Math.min(500, Number(data.amount) || 200));
          const wallet = localWallets.get(player.id);
          if (wallet) {
            wallet.balance += amount;
            wallet.transactions.unshift({
              id: `tx-daily-${Date.now()}`,
              userId: player.id,
              type: 'daily_reward',
              amount,
              balanceAfter: wallet.balance,
              description: `Daily Resumption Allowance`,
              createdAt: new Date().toISOString(),
            });
          }

          const dailyEvt = {
            id: `evt-daily-${Date.now()}`,
            text: `@${player.username} claimed daily resumption allowance (+₦${amount}) ☀️`,
            type: 'daily',
            timestamp: Date.now(),
          };
          broadcastToRoom(sessionRoom, JSON.stringify({ type: 'activity_event', event: dailyEvt }));
          break;
        }

        case 'lecture_enter': {
          const connId = data.connectionId || data.data?.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          if (!player) return;

          const lectureId = String(data.lectureId || data.data?.lectureId || 'funaab-fst-201');
          const lectureRoomKey = `world:funaab:lecture:${lectureId}`;

          let roomState = lectureRooms.get(lectureId);
          if (!roomState) {
            roomState = {
              lectureId,
              students: new Map(),
              currentScriptIndex: 0,
            };
            lectureRooms.set(lectureId, roomState);
          }

          // Compute next available seat (1 to 30)
          const takenSeats = new Set(Array.from(roomState.students.values()).map((s: any) => s.seatNumber));
          let assignedSeat = Number(data.seatNumber || data.data?.seatNumber) || 1;
          if (takenSeats.has(assignedSeat)) {
            for (let s = 1; s <= 30; s++) {
              if (!takenSeats.has(s)) {
                assignedSeat = s;
                break;
              }
            }
          }

          const studentData = {
            connectionId: connId,
            id: player.id,
            username: player.username,
            college: player.college,
            seatNumber: assignedSeat,
            handRaised: false,
          };

          roomState.students.set(connId, studentData);

          // Update session room and player state
          const session = sessions.get(ws);
          if (session) {
            session.room = lectureRoomKey;
          }
          player.currentLectureId = lectureId;
          player.seatNumber = assignedSeat;

          console.log(`[WS] @${player.username} entered lecture ${lectureId} (Seat #${assignedSeat})`);

          // Send snapshot of current classroom attendees
          const attendees: Record<string, any> = {};
          for (const [sConnId, st] of roomState.students) {
            attendees[sConnId] = st;
          }

          ws.send(JSON.stringify({
            type: 'classroom_sync',
            lectureId,
            assignedSeat,
            classroomState: {
              lectureId,
              activeStudents: attendees,
            },
          }));

          // Broadcast student joined to everyone inside the lecture hall
          broadcastToRoom(lectureRoomKey, JSON.stringify({
            type: 'classroom_student_joined',
            lectureId,
            student: studentData,
          }), ws);

          // Broadcast lightweight campus feed
          const actEvt = {
            id: `evt-lec-${Date.now()}`,
            text: `@${player.username} walked into class (${lectureId.toUpperCase()}) 🎓`,
            type: 'lecture',
            timestamp: Date.now(),
          };
          broadcastToRoom('world:funaab:main', JSON.stringify({ type: 'activity_event', event: actEvt }));
          break;
        }

        case 'lecture_leave': {
          const connId = data.connectionId || data.data?.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          if (!player) return;

          const lectureId = String(data.lectureId || data.data?.lectureId || player.currentLectureId || 'funaab-fst-201');
          const lectureRoomKey = `world:funaab:lecture:${lectureId}`;

          const roomState = lectureRooms.get(lectureId);
          if (roomState) {
            roomState.students.delete(connId);
          }

          const session = sessions.get(ws);
          if (session) {
            session.room = 'world:funaab:main';
          }
          player.currentLectureId = undefined;
          player.seatNumber = undefined;

          console.log(`[WS] @${player.username} left lecture ${lectureId}`);

          broadcastToRoom(lectureRoomKey, JSON.stringify({
            type: 'classroom_student_left',
            lectureId,
            connectionId: connId,
          }));
          break;
        }

        case 'lecture_hand_raise': {
          const connId = data.connectionId || data.data?.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          if (!player) return;

          const lectureId = String(data.lectureId || data.data?.lectureId || player.currentLectureId || 'funaab-fst-201');
          const lectureRoomKey = `world:funaab:lecture:${lectureId}`;
          const isRaised = data.raised !== undefined ? !!data.raised : !!data.data?.raised;

          const roomState = lectureRooms.get(lectureId);
          if (roomState && roomState.students.has(connId)) {
            const st = roomState.students.get(connId)!;
            st.handRaised = isRaised;
          }

          broadcastToRoom(lectureRoomKey, JSON.stringify({
            type: 'classroom_hand_raise',
            lectureId,
            connectionId: connId,
            raised: isRaised,
          }));
          break;
        }

        case 'classroom_chat': {
          const connId = data.connectionId || data.data?.connectionId || sessionConnId;
          if (!connId) return;
          const player = players.get(connId);
          if (!player) return;

          const lectureId = String(data.lectureId || data.data?.lectureId || player.currentLectureId || 'funaab-fst-201');
          const lectureRoomKey = `world:funaab:lecture:${lectureId}`;
          const chatText = String(data.text || data.data?.text || '').slice(0, 300);

          const chatMsg = {
            type: 'chat_message',
            id: `msg-cls-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            senderId: player.id,
            senderConnectionId: connId,
            senderName: player.username,
            college: player.college,
            text: chatText,
            timestamp: Date.now(),
            lectureId,
          };

          broadcastToRoom(lectureRoomKey, JSON.stringify(chatMsg));
          break;
        }

        case 'private_chat': {
          const connId = data.connectionId || sessionConnId;
          if (!connId) return;
          const sender = players.get(connId);
          if (!sender) return;

          const targetUsername = String(data.recipientUsername || data.targetUsername || '').trim();
          const targetId = String(data.recipientId || data.targetId || '');

          // Find recipient player session
          let recipientWs: WebSocket | null = null;
          let recipientPlayer: any = null;

          for (const [sWs, sData] of sessions) {
            if (
              (targetId && sData.id === targetId) ||
              (targetUsername && sData.username.toLowerCase() === targetUsername.toLowerCase())
            ) {
              recipientWs = sWs;
              recipientPlayer = sData;
              break;
            }
          }

          const chatText = String(data.text || '').slice(0, 500);
          const transferData = data.transferData || null;

          const dmPacket = {
            type: 'private_chat_message',
            message: {
              id: `dm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              senderId: sender.id,
              senderName: sender.username,
              college: sender.college,
              recipientId: targetId || (recipientPlayer ? recipientPlayer.id : ''),
              recipientUsername: targetUsername || (recipientPlayer ? recipientPlayer.username : ''),
              text: chatText,
              timestamp: Date.now(),
              isPrivate: true,
              transferData,
            },
          };

          const rawMsg = JSON.stringify(dmPacket);

          // Deliver to recipient if online
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(rawMsg);
          }

          // Echo back to sender so their local DM view updates instantly
          ws.send(rawMsg);
          break;
        }

        case 'user_report': {
          const reporterUsername = data.reporterUsername || 'anonymous';
          const reportedUsername = data.reportedUsername || 'unknown';
          const reason = data.reason || 'General Concern';
          const details = data.details || '';

          console.log(`[SAFETY REPORT] @${reporterUsername} reported @${reportedUsername} for: ${reason}. Details: ${details}`);

          ws.send(JSON.stringify({
            type: 'user_report_success',
            reportedUsername,
            timestamp: Date.now(),
          }));
          break;
        }
      }
    } catch (err) {
      console.error('Server error processing message:', err);
    }
  });

  ws.on('close', () => {
    if (sessionConnId) {
      const exitingPlayer = players.get(sessionConnId);
      const closingSession = sessions.get(ws);
      const lectureId = exitingPlayer?.currentLectureId;
      if (lectureId) {
        const lectureRoomKey = `world:funaab:lecture:${lectureId}`;
        const roomState = lectureRooms.get(lectureId);
        roomState?.students.delete(sessionConnId);
        if (roomState?.students.size === 0) lectureRooms.delete(lectureId);
        if (closingSession) closingSession.room = 'world:funaab:main';
        broadcastToRoom(lectureRoomKey, JSON.stringify({
          type: 'classroom_student_left',
          lectureId,
          connectionId: sessionConnId,
        }));
      }
      players.delete(sessionConnId);
      if (exitingPlayer) {
        exitingPlayer.currentLectureId = undefined;
        exitingPlayer.seatNumber = undefined;
      }
      kekes.forEach((keke) => {
        keke.passengers = keke.passengers.filter((id: string) => id !== sessionConnId);
      });
      console.log(`[WS] player left: @${exitingPlayer?.username || 'user'} (${sessionConnId})`);
      console.log(`[WS] players online: ${players.size}`);

      broadcastToRoom(
        sessionRoom,
        JSON.stringify({
          type: 'player_left',
          connectionId: sessionConnId,
          id: exitingPlayer?.id,
        })
      );
    }
    sessions.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`> FUNAAB Life Realtime Multiplayer Server running on ws://localhost:${PORT}`);
});
