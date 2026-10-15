// SUG elections: every week students can run for SUG President and vote. The database runs the
// election (migration 034); this mirrors its calendar and rules for the UI and tests.
//
//   Mon–Wed  nominations (Level 3+, ₦10,000 fee, a short manifesto)
//   Thu–Sat  voting (Level 2+, one vote, can change it until polls close)
//   Sunday   results: the winner is SUG President for the next week (until next Sunday)
//
// The President gets a 👑 SUG badge on their name tag and one campus-wide announcement a day.

export const SUG = {
  NOMINATION_FEE: 10000,
  MIN_LEVEL_TO_RUN: 3,
  MIN_LEVEL_TO_VOTE: 2,
  MAX_CANDIDATES: 12,
  MANIFESTO_MAX: 200,
  ANNOUNCEMENT_MAX: 160,
};
export type SugPhase = 'nominations' | 'voting' | 'results';

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const EPOCH = Date.UTC(2026, 0, 5); // Monday 5 Jan 2026 (Lagos midnight − 1 h, handled below)
const DAY = 86400000;

/** Lagos calendar day (as a UTC-midnight timestamp) for an instant. */
const lagosDay = (ms: number) => Math.floor((ms + LAGOS_OFFSET_MS) / DAY) * DAY;
/** Election week number (weeks since Monday 5 Jan 2026, Lagos time). */
export const sugCycle = (ms: number) => Math.floor((lagosDay(ms) - EPOCH) / (7 * DAY));
export function sugPhase(ms: number): SugPhase {
  const dow = new Date(lagosDay(ms)).getUTCDay(); // 0 = Sunday
  return dow === 0 ? 'results' : dow <= 3 ? 'nominations' : 'voting';
}
/** When the current phase ends (epoch ms). */
export function sugPhaseEndsAt(ms: number) {
  const day = lagosDay(ms), dow = new Date(day).getUTCDay();
  const daysLeft = dow === 0 ? 1 : dow <= 3 ? 4 - dow : 7 - dow;
  return day + daysLeft * DAY - LAGOS_OFFSET_MS;
}
export const SUG_PHASE_LABEL: Record<SugPhase, string> = {
  nominations: 'Nominations open (Mon–Wed)',
  voting: 'Voting open (Thu–Sat)',
  results: 'Results day (Sunday)',
};

/** Words that never appear in a manifesto or announcement (kept short; the database has the same list). */
export const SUG_BLOCKED = ['fuck', 'shit', 'bitch', 'nigger', 'mumu', 'olodo', 'ashawo', 'idiot'];
export const sugTextProblem = (text: string, max: number) => {
  const t = text.trim();
  if (t.length < 3) return 'Write a little more.';
  if (t.length > max) return `Keep it under ${max} characters.`;
  if (/(https?:\/\/|www\.)/i.test(t)) return 'No links, please.';
  if (SUG_BLOCKED.some((w) => t.toLowerCase().includes(w))) return 'Keep it clean — no insults or swearing.';
  return null;
};
