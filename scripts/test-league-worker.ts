// College League from the Worker: a played-out penalty win reports once; forfeits never count.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';
import { FOOTBALL_PITCH } from '../src/config/football';

class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldFetch = globalThis.fetch, oldInterval = globalThis.setInterval, oldRandom = Math.random;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  const events: any[] = [];
  globalThis.fetch = (async (url: any, init: any) => { if (String(url).endsWith('league_event_trusted')) events.push(JSON.parse(init.body)); return new Response('1'); }) as any;
  const storage = { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  try {
    const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://league.invalid' } as any);
    const join = async (id: string, name: string) => {
      const s = new Socket(); await w.handleSession(s, null, 'world:funaab:main');
      await s.packet({ type: 'join', player: { id, username: name, position: [...FOOTBALL_PITCH.shooterSpot] } });
      const sess = w.sessions.get(s); sess.trustedPosition = [...FOOTBALL_PITCH.shooterSpot]; sess.claimedPosition = sess.trustedPosition; return s;
    };
    const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2';
    const a = await join(A, 'Ada'), b = await join(B, 'Bisi');
    const op = async (s: Socket, p: object) => { await s.packet({ type: 'football', requestId: crypto.randomUUID(), ...p }); return s.messages.filter((m) => m.type === 'action_result').at(-1); };
    const play = async () => {
      const id = (await op(a, { op: 'create' })).result.id;
      await op(b, { op: 'join', matchId: id });
      for (let i = 0; i < 6; i++) {
        const turn = w.football.turnUserId === A ? a : b;
        Math.random = () => 0.5; // keeper stays centre
        await op(turn, { op: 'shoot', aim: turn === a ? 0.6 : -1, power: 0.6 }); // Ada scores, Bisi hits the post
      }
      return id;
    };
    const m1 = await play(); await flush();
    assert.deepEqual(events, [{ p_user: A, p_kind: 'football_win', p_ref: m1 }], 'winner reported once with the match id');
    await op(a, { op: 'leave' }); await op(b, { op: 'leave' });
    // Forfeit: Bisi walks off mid-match → Ada "wins" but it never counts.
    events.length = 0;
    const id = (await op(a, { op: 'create' })).result.id;
    await op(b, { op: 'join', matchId: id });
    b.close(); await flush();
    assert.equal(w.football.endReason, 'forfeit');
    assert.equal(events.length, 0, 'forfeits earn no league points');
    console.log('LEAGUE WORKER PASSED: played-out wins report once per match; forfeits never count');
  } finally { (globalThis as any).WebSocket = oldWS; globalThis.fetch = oldFetch; globalThis.setInterval = oldInterval; Math.random = oldRandom; }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
