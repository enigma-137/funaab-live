// In-game feedback: input validation, Telegram formatting/escaping, and the Worker handler
// (session identity, place, rate limits, missing secrets, Telegram failure).
import assert from 'node:assert/strict';
import { parseFeedback, formatFeedbackMessage, FEEDBACK_LIMITS } from '../src/config/feedback';
import { WorldRoomDO } from '../worker/index';

// ---------- parse ----------
assert.match((parseFeedback({ kind: 'rant', message: 'hello there' }) as any).error, /Pick Bug/);
assert.match((parseFeedback({ kind: 'bug', message: ' hi ' }) as any).error, /little more/);
const long = parseFeedback({ kind: 'bug', message: 'x'.repeat(5000), name: 'n'.repeat(200), contact: 'c'.repeat(300) }) as any;
assert.equal(long.message.length, FEEDBACK_LIMITS.messageMax);
assert.equal(long.name.length, FEEDBACK_LIMITS.nameMax);
assert.equal(long.contact.length, FEEDBACK_LIMITS.contactMax);
assert.equal((parseFeedback({ kind: 'bug', message: 'ok ok\u0000\u0007 ok' }) as any).message, 'ok ok ok', 'control characters removed');

// ---------- format ----------
const text = formatFeedbackMessage(
  { kind: 'bug', message: 'Keke <b>stuck</b> & gone', name: 'Emma', contact: '0801', device: 'mobile' },
  { username: 'enigma', college: 'COLFHEC', place: 'Library' },
  new Date('2026-10-13T19:42:00Z'),
);
assert.match(text, /^🐞 <b>Bug<\/b> from @enigma \(COLFHEC\) · “Emma”/);
assert.match(text, /Keke &lt;b&gt;stuck&lt;\/b&gt; &amp; gone/, 'player text is HTML-escaped');
assert.match(text, /📍 Library · 📱 Mobile · 13 Oct, 8:42 pm/i, 'Lagos time');
assert.match(text, /📞 0801/);
assert.doesNotMatch(formatFeedbackMessage({ kind: 'suggestion', message: 'more kekes', name: 'enigma' }, { username: 'enigma', college: 'X', place: 'P' }), /“/, 'name equal to username is not repeated');

// ---------- Worker ----------
class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }

async function main() {
  const oldWS = globalThis.WebSocket, oldInterval = globalThis.setInterval, oldNow = Date.now, oldFetch = globalThis.fetch;
  (globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
  let now = oldNow(); Date.now = () => now;
  const store = new Map<string, any>();
  const storage = { get: async (k: string) => store.get(k), put: async (k: string, v: any) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
  const sent: any[] = [];
  let telegramOk = true;
  (globalThis as any).fetch = async (url: string, init: any) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return { ok: telegramOk, status: telegramOk ? 200 : 400, text: async () => 'bad' } as any;
  };
  try {
    const make = async (env: object) => {
      const w: any = new WorldRoomDO({ storage } as any, { ENABLE_GUEST_MODE: 'true', ...env } as any);
      const socket = new Socket(); await w.handleSession(socket, null, 'world:funaab:main');
      await socket.packet({ type: 'join', player: { id: '00000000-0000-4000-8000-0000000000a1', username: 'enigma', college: 'COLFHEC', position: [20, 0, 12] } });
      const s = w.sessions.get(socket); s.trustedPosition = [20, 0, 12]; s.claimedPosition = [20, 0, 12]; s.movementClock = now;
      const call = async (p: object) => { now += 100; await socket.packet({ type: 'feedback', requestId: crypto.randomUUID(), ...p }); return socket.messages.filter((m) => m.type === 'action_result').at(-1); };
      return call;
    };

    // Not configured yet: a clear message, nothing sent.
    let call = await make({});
    assert.match((await call({ kind: 'bug', message: 'hello world' })).error, /not switched on/);
    assert.equal(sent.length, 0);

    call = await make({ TELEGRAM_BOT_TOKEN: 'T0K', TELEGRAM_CHAT_ID: '-100123' });
    assert.match((await call({ kind: 'bug', message: 'hi' })).error, /little more/);
    const ok = await call({ kind: 'bug', message: 'The keke is stuck', name: 'Emma', device: 'mobile', username: 'spoofed', college: 'FAKE' });
    assert.deepEqual(ok.result, { sent: true });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, 'https://api.telegram.org/botT0K/sendMessage');
    assert.equal(sent[0].body.chat_id, '-100123');
    assert.equal(sent[0].body.parse_mode, 'HTML');
    assert.match(sent[0].body.text, /from @enigma/, 'identity comes from the session');
    assert.doesNotMatch(sent[0].body.text, /spoofed|FAKE/, 'client cannot spoof identity');
    assert.match(sent[0].body.text, /📍 Library/, 'place from the trusted position');

    // Gap between messages, then the hourly cap.
    assert.match((await call({ kind: 'bug', message: 'second one quickly' })).error, /few seconds/);
    for (let i = 0; i < FEEDBACK_LIMITS.perHour - 1; i++) { now += FEEDBACK_LIMITS.gapMs; assert.equal((await call({ kind: 'feedback', message: `message ${i}` })).error, undefined); }
    now += FEEDBACK_LIMITS.gapMs;
    assert.match((await call({ kind: 'feedback', message: 'one too many' })).error, /a lot this hour/);
    now += 3600_000;
    // Telegram failure: the player is told, and it doesn't use up their limit.
    telegramOk = false;
    const before = sent.length;
    assert.match((await call({ kind: 'suggestion', message: 'add more trees' })).error, /Couldn't send/);
    telegramOk = true; now += 100;
    assert.equal((await call({ kind: 'suggestion', message: 'add more trees' })).error, undefined, 'retry right after a failure works');
    assert.equal(sent.length, before + 2);
    console.log('FEEDBACK PASSED: validation, escaping, Lagos time, session identity/place, not-configured, gap + hourly limits, Telegram failure.');
  } finally {
    (globalThis as any).WebSocket = oldWS; (globalThis as any).setInterval = oldInterval; Date.now = oldNow; (globalThis as any).fetch = oldFetch;
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
