// Classroom chat: the client's message type matches the Worker, classmates receive it, students
// outside the class don't.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WorldRoomDO } from '../worker/index';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const client = fs.readFileSync('src/game/multiplayer/networkManager.ts', 'utf8');
  assert.match(client, /sendClassroomChat[\s\S]{0,200}type: 'lecture_chat'/, 'client sends the type the Worker handles');
  assert.match(client, /case 'lecture_chat_message'/, 'client handles the Worker reply');

  const oldWS = globalThis.WebSocket, oldInterval = globalThis.setInterval;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 1;
  try {
    const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true' } as any);
    const join = async (n: number) => {
      const socket = new Socket(); await w.handleSession(socket, null, 'world:funaab:main');
      await socket.packet({ type: 'join', player: { id: `00000000-0000-4000-8000-00000000000${n}`, username: 'S' + n, position: [0, 0, 8] } });
      return socket;
    };
    const a = await join(1), b = await join(2), outside = await join(3);
    await a.packet({ type: 'lecture_enter', lectureId: 'fst-101', seatNumber: 1 });
    await b.packet({ type: 'lecture_enter', lectureId: 'fst-101', seatNumber: 2 });
    // Classmates see each other: the second student's snapshot lists the first, the first is told.
    const snap = b.messages.find((m) => m.type === 'lecture_room_snapshot');
    assert(Object.values<any>(snap.roomState.activeStudents).some((st) => st.username === 'S1' && st.seatNumber === 1), 'snapshot lists real classmates');
    assert(a.messages.some((m) => m.type === 'lecture_student_joined' && m.student.username === 'S2' && m.student.seatNumber === 2), 'classmates told who sat down');
    assert(!outside.messages.some((m) => m.type === 'lecture_student_joined'), 'outsiders are not');
    assert(client.includes("case 'lecture_room_snapshot'") && client.includes("case 'lecture_student_joined'"), 'client shows real classmates');
    await a.packet({ type: 'lecture_chat', lectureId: 'fst-101', text: 'Good afternoon class' });
    const got = (s: Socket) => s.messages.filter((m) => m.type === 'lecture_chat_message');
    assert.equal(got(b).length, 1, 'classmate receives it');
    assert.equal(got(b)[0].text, 'Good afternoon class');
    assert.equal(got(a).length, 1, 'sender sees their own message');
    assert.equal(got(outside).length, 0, 'students outside the class do not');
    console.log('CLASSROOM CHAT PASSED: real classmates listed in seats, client/Worker message types match, classmates receive, outsiders do not.');
  } finally { (globalThis as any).WebSocket = oldWS; (globalThis as any).setInterval = oldInterval; }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
