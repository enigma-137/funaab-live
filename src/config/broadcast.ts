// Campus announcements sent from Telegram. The owner messages the bot:
//
//   /notification Server maintenance at 9 PM          shows to everyone for 24 hours
//   /notification 6h New joystick controls!           shows for 6 hours (m, h or d)
//   /notification off                                 takes it down
//   /myid                                             replies with your Telegram id (for setup)
//   /help
//
// Pure parsing and limits here; the Worker does the authorising, storing and broadcasting.

export const BROADCAST = {
  MAX_TEXT: 300,
  DEFAULT_HOURS: 24,
  MAX_HOURS: 24 * 7,
};

export interface Announcement { id: string; text: string; createdAt: number; expiresAt: number }

export type BotCommand =
  | { kind: 'set'; text: string; hours: number }
  | { kind: 'clear' }
  | { kind: 'myid' }
  | { kind: 'help' }
  | { kind: 'status' }
  | { kind: 'error'; message: string }
  | { kind: 'ignore' };

/** "30m", "6h", "2d" → hours (0.5, 6, 48), or null when the word isn't a duration. */
export function parseDuration(word: string): number | null {
  const m = /^(\d{1,3})([mhd])$/i.exec(word);
  if (!m) return null;
  const n = Number(m[1]);
  const hours = m[2].toLowerCase() === 'm' ? n / 60 : m[2].toLowerCase() === 'h' ? n : n * 24;
  return hours > 0 ? hours : null;
}

/** Keep announcements to plain, short text: collapse whitespace, drop control characters. */
export const cleanAnnouncement = (text: string) =>
  text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

export function parseBotCommand(raw: unknown): BotCommand {
  if (typeof raw !== 'string') return { kind: 'ignore' };
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(raw.trim());
  if (!m) return { kind: 'ignore' };
  const name = m[1].toLowerCase(), rest = (m[2] ?? '').trim();
  if (name === 'myid') return { kind: 'myid' };
  if (name === 'help' || name === 'start') return { kind: 'help' };
  if (name === 'status') return { kind: 'status' };
  if (name !== 'notification' && name !== 'notify') return { kind: 'ignore' };
  if (!rest) return { kind: 'error', message: 'Add your message: /notification Maintenance at 9 PM' };
  if (/^(off|clear|stop|remove)$/i.test(rest)) return { kind: 'clear' };
  const [first, ...others] = rest.split(/\s+/);
  const hours = parseDuration(first);
  const body = cleanAnnouncement(hours ? others.join(' ') : rest);
  if (!body) return { kind: 'error', message: 'Add your message after the time, e.g. /notification 6h New update!' };
  if (body.length > BROADCAST.MAX_TEXT) return { kind: 'error', message: `Too long (${body.length}). Keep it under ${BROADCAST.MAX_TEXT} characters.` };
  const h = hours ?? BROADCAST.DEFAULT_HOURS;
  if (h > BROADCAST.MAX_HOURS) return { kind: 'error', message: 'The longest an announcement can stay up is 7 days (7d).' };
  return { kind: 'set', text: body, hours: h };
}

export const BOT_HELP = [
  'FUNAAB Life announcements',
  '',
  '/notification <message> — show to everyone for 24 hours',
  '/notification 6h <message> — for 6 hours (m, h or d)',
  '/notification off — take it down',
  '/status — what is showing now',
  '/myid — your Telegram id',
].join('\n');

export const announcementActive = (a: Announcement | null | undefined, now = Date.now()) =>
  !!a && typeof a.text === 'string' && a.text.length > 0 && a.expiresAt > now;

/** Authorised senders: the comma-separated Telegram user ids in TELEGRAM_ADMIN_IDS. */
export const isBotAdmin = (adminIds: string | undefined, userId: unknown) =>
  typeof userId === 'number' && !!adminIds && adminIds.split(',').map((s) => s.trim()).filter(Boolean).includes(String(userId));
