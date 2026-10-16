// Group chats with friends (supabase/migrations/047_group_chats.sql enforces the same rules;
// scripts/test-group-chat-db.ts checks drift).
export const GROUP_CHAT = {
  /** People in a group, the creator included. */
  maxMembers: 20,
  /** Groups one student can create. */
  maxOwned: 5,
  nameMax: 40,
  messageMax: 500,
  /** Messages kept per group; older ones are deleted. */
  keep: 200,
  /** Anti-spam: at most this many messages a minute, and one a second. */
  perMinute: 20,
};

/**
 * Top-level domains that make "word.tld" count as a link. Short ones that are also English words
 * (to, in, be, me, us) are left out so "coming.in a bit" is fine; wa.me and t.me are caught by name.
 */
export const LINK_TLDS = ['com', 'net', 'org', 'ng', 'io', 'co', 'ly', 'gg', 'xyz', 'app', 'link', 'info', 'biz', 'tk', 'ml', 'ga', 'cf', 'gq', 'site', 'online', 'live', 'tv', 'uk', 'ru', 'top', 'club', 'shop', 'store', 'dev', 'page', 'cc', 'gl', 'gd'];

/** The same pattern is written into the database (047); keep them in step. */
export const LINK_PATTERN = `(https?://|www\\.|\\m(wa|t)\\s*\\.\\s*me\\M|\\m[a-z0-9-]+\\s*(\\.|\\(dot\\)|\\[dot\\])\\s*(${LINK_TLDS.join('|')})\\M)`;
const LINK_RE = new RegExp(LINK_PATTERN.replace(/\\[mM]/g, '\\b'), 'i');

/** Links are not allowed in group chats (names or messages). */
export const hasLink = (text: string) => LINK_RE.test(text);
