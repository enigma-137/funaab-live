// Home background ("where you're from"): chosen once, private, and a different path, not a rank.
// Comfortable homes send more money; struggling students earn a bigger hustle bonus on work.
// Server copy: supabase/migrations/018_home_background.sql (scripts/test-backgrounds-db.ts checks drift).

export type BackgroundId = 'comfortable' | 'average' | 'struggling';
export interface BackgroundDef {
  id: BackgroundId; title: string; icon: string; blurb: string;
  /** One-off money when you choose (resumption money from home). */
  welcome: number;
  /** "Money from home": arrives each Sunday, collect it any day that week. */
  weekly: number;
  /** Extra % on campus job (and hustle) pay, paid as its own ledger line. */
  hustleBonusPercent: number;
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'comfortable', title: 'Comfortable home', icon: '🏡', blurb: 'Parents send good money every week. Life is easier, but hustling pays no extra.', welcome: 3000, weekly: 2500, hustleBonusPercent: 0 },
  { id: 'average', title: 'Average home', icon: '🏠', blurb: 'Something comes from home every week, and a little extra on every job you do.', welcome: 1000, weekly: 1200, hustleBonusPercent: 10 },
  { id: 'struggling', title: 'Struggling home', icon: '🛖', blurb: 'Home can only send a little. You hustle harder: +20% on every job and hustle.', welcome: 0, weekly: 400, hustleBonusPercent: 20 },
];

export const background = (id: string | null | undefined) => BACKGROUNDS.find((b) => b.id === id);
/** Ledger types that earn the hustle bonus (jobs today; hustles from migration 019). */
export const HUSTLE_LEDGER_TYPES = ['campus_job', 'hustle_pay'] as const;
