// Telegram announcements: command parsing, and the Worker flow (secret, allow-list, publish,
// live push, public read, expiry, clear, no way in from outside).
import assert from 'node:assert/strict';
import worker, { WorldRoomDO } from '../worker/index';
import { BROADCAST, parseBotCommand, parseDuration, announcementActive } from '../src/config/broadcast';

// ---- Parsing ----
assert.deepEqual(parseBotCommand('/notification Maintenance at 9 PM'), { kind: 'set', text: 'Maintenance at 9 PM', hours: 24 });
assert.deepEqual(parseBotCommand('/notification@FunaabBot 6h New joystick!'), { kind: 'set', text: 'New joystick!', hours: 6 });
assert.deepEqual(parseBotCommand('/notification 30m  Quick   note'), { kind: 'set', text: 'Quick note', hours: 0.5 });
assert.deepEqual(parseBotCommand('/notify 2d Big update'), { kind: 'set', text: 'Big update', hours: 48 });
assert.equal(parseBotCommand('/notification 6h').kind, 'error');
assert.equal(parseBotCommand('/notification').kind, 'error');
assert.equal(parseBotCommand('/notification 9d Too long').kind, 'error');
assert.equal(parseBotCommand('/notification ' + 'x'.repeat(BROADCAST.MAX_TEXT + 1)).kind, 'error');
assert.deepEqual(parseBotCommand('/notification off'), { kind: 'clear' });
assert.deepEqual(parseBotCommand('/myid'), { kind: 'myid' });
assert.equal(parseBotCommand('hello there').kind, 'ignore');
assert.equal(parseBotCommand('/other thing').kind, 'ignore');
assert.equal(parseBotCommand(undefined).kind, 'ignore');
assert.equal(parseDuration('12x'), null);
assert.equal(parseDuration('0h'), null);
assert.equal((parseBotCommand('/notification a\u0000b‮ c') as any).text.includes('\u0000'), false);

// ---- Worker flow ----
const sent: any[] = [], oldFetch = globalThis.fetch, oldWS = globalThis.WebSocket, oldInterval = globalThis.setInterval;
class Socket { static OPEN = 1; readyState = 1; messages: any[] = []; handlers: Record<string, Function> = {}; accept() {} addEventListener(e: string, f: Function) { this.handlers[e] = f; } send(s: string) { this.messages.push(JSON.parse(s)); } close() { this.readyState = 3; this.handlers.close?.(); } async packet(p: object) { await this.handlers.message({ data: JSON.stringify(p) }); } }
(globalThis as any).WebSocket = Socket; (globalThis as any).setInterval = () => 0;
globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes('api.telegram.org')) { sent.push(JSON.parse(init.body)); return new Response('{}'); }
  return oldFetch(url, init);
}) as any;
const mem = new Map<string, unknown>();
const storage = { get: async (k: string) => mem.get(k), put: async (k: string, v: unknown) => { mem.set(k, v); }, delete: async (k: string) => { mem.delete(k); }, list: async () => new Map(), getAlarm: async () => null, setAlarm: async () => {} };
const env: any = { ENABLE_GUEST_MODE: 'true', TELEGRAM_BOT_TOKEN: 'bot', TELEGRAM_WEBHOOK_SECRET: 's3cret', TELEGRAM_ADMIN_IDS: '111, 222' };
const room = new WorldRoomDO({ storage } as any, env);
env.WORLD_ROOM = { idFromName: () => 'main', get: () => ({ fetch: (u: any, init?: any) => room.fetch(new Request(u, init)) }) };
const hook = (text: string, from = 111, secret: string | null = 's3cret') =>
  worker.fetch(new Request('https://w.example/telegram/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}) }, body: JSON.stringify({ message: { text, from: { id: from }, chat: { id: from } } }) }), env);
const current = async () => (await (await worker.fetch(new Request('https://w.example/announcement'), env)).json() as any).announcement;
const flush = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  try {
    const player = new Socket(); await (room as any).handleSession(player, null, 'world:funaab:main');
    await player.packet({ type: 'join', player: { id: '00000000-0000-4000-8000-0000000000a1', username: 'Ada', position: [0, 0, 0] } });

    // No secret / wrong secret: refused, nothing stored.
    assert.equal((await hook('/notification Hi', 111, null)).status, 403);
    assert.equal((await hook('/notification Hi', 111, 'wrong')).status, 403);
    assert.equal(await current(), null);
    // A stranger with the right secret path but not on the allow-list: ignored silently.
    sent.length = 0;
    assert.equal((await hook('/notification Free money', 999)).status, 200);
    assert.equal(await current(), null); assert.equal(sent.length, 0, 'strangers get no reply');
    // Anyone can ask for their own id.
    await hook('/myid', 999); assert.match(sent.at(-1).text, /999/);

    // The owner publishes; everyone online gets it live; anyone can read it.
    sent.length = 0;
    assert.equal((await hook('/notification 6h New joystick controls! 🕹️', 222)).status, 200);
    const a = await current();
    assert.equal(a.text, 'New joystick controls! 🕹️');
    assert(a.expiresAt - a.createdAt === 6 * 3600000);
    assert.deepEqual(player.messages.filter((m) => m.type === 'announcement').at(-1).announcement.id, a.id, 'pushed to players online');
    assert.match(sent.at(-1).text, /Live for 6h/);
    await hook('/status'); assert.match(sent.at(-1).text, /New joystick controls/);

    // A newer one replaces it; a bad command explains itself.
    await hook('/notification Maintenance at 9 PM');
    assert.equal((await current()).text, 'Maintenance at 9 PM');
    await hook('/notification 6h'); assert.match(sent.at(-1).text, /Add your message/);
    assert.equal((await current()).text, 'Maintenance at 9 PM', 'errors change nothing');

    // Expiry: it stops showing without anyone clearing it.
    const stored: any = mem.get('announcement'); stored.expiresAt = Date.now() - 1; mem.set('announcement', stored);
    assert.equal(await current(), null); assert.equal(announcementActive(stored), false);

    // Clear.
    await hook('/notification Another one'); assert((await current())?.text);
    await hook('/notification off');
    assert.equal(await current(), null);
    assert.equal(player.messages.filter((m) => m.type === 'announcement').at(-1).announcement, null, 'clearing is pushed too');

    // Nobody can reach the internal publish route from outside.
    const direct = (headers: Record<string, string> = {}) => worker.fetch(new Request('https://w.example/__announce', { method: 'POST', headers, body: JSON.stringify({ text: 'hax' }) }), env);
    assert.equal((await direct()).status, 404);
    assert.equal((await room.fetch(new Request('https://room/__announce', { method: 'POST', body: JSON.stringify({ text: 'hax' }) }))).status, 403);
    assert.equal((await room.fetch(new Request('https://room/__announce', { method: 'POST', headers: { 'X-Internal': 'guess' }, body: JSON.stringify({ text: 'hax' }) }))).status, 403);
    assert.equal(await current(), null);
    // Not configured at all: the webhook is closed.
    const bare = await worker.fetch(new Request('https://w.example/telegram/webhook', { method: 'POST', body: '{}' }), { ...env, TELEGRAM_WEBHOOK_SECRET: undefined });
    assert.equal(bare.status, 403);
    void flush;
    console.log('BROADCAST PASSED: command parsing, secret + allow-list, live push, public read, replace, expiry, clear, internal route closed.');
  } finally { globalThis.fetch = oldFetch; (globalThis as any).WebSocket = oldWS; globalThis.setInterval = oldInterval; }
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
