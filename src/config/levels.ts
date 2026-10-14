// Activity levels: Level 1, 2, 3… from XP earned by playing, replacing 100L–500L academics.
// Mirrored by migration 031 (the database is the authority; scripts/test-levels-db.ts checks drift).

export const XP_RULES = {
  /** Most XP anyone can earn in one Lagos day, so levels reward regular play over grinding. */
  DAILY_CAP: 400,
  /** XP per completed activity. Wallet transaction types, plus a few Worker-recorded results. */
  SOURCES: {
    campus_job: 20,
    hustle_pay: 15,
    errand_pay: 8,
    lecture_attendance: 10,
    daily_goal: 10,
    daily_plan_bonus: 25,
    daily_reward: 5,
    home_allowance: 10,
    food_purchase: 3,
    keke_fare: 4,
    hostel_purchase: 5,
    hostel_makeover: 5,
    hostel_expand: 30,
    lodge_rent: 10,
    game_den: 10,
    football_win: 15,
    court_match: 5,
    court_win: 12,
    rally_match: 5,
    rally_win: 15,
  },
} as const;
export type XpSource = keyof typeof XP_RULES.SOURCES;

/** Total XP needed to reach a level: 0, 100, 250, 450, 700… (each step 50 more than the last). */
export const xpForLevel = (level: number) => 25 * (Math.max(1, Math.floor(level)) - 1) * (Math.max(1, Math.floor(level)) + 2);

export function levelForXp(xp: number) {
  const x = Math.max(0, Math.floor(xp) || 0);
  let level = Math.max(1, Math.floor((-1 + Math.sqrt(9 + (4 * x) / 25)) / 2));
  while (xpForLevel(level + 1) <= x) level++;
  while (level > 1 && xpForLevel(level) > x) level--;
  return level;
}

/** Where a player stands inside their current level. */
export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const from = xpForLevel(level),
    to = xpForLevel(level + 1);
  return { level, xp: Math.max(0, Math.floor(xp) || 0), into: Math.max(0, xp - from), needed: to - from, next: to };
}

/** Plain-language list for the Level sheet. */
export const XP_GUIDE: Array<{ icon: string; label: string; xp: string }> = [
  { icon: '💼', label: 'Finish a campus job or delivery', xp: `${XP_RULES.SOURCES.campus_job}` },
  { icon: '🧾', label: 'Hustles: POS shift, photo shoot, tutoring, room shop sale', xp: `${XP_RULES.SOURCES.hustle_pay}` },
  { icon: '🎓', label: 'Attend a lecture', xp: `${XP_RULES.SOURCES.lecture_attendance}` },
  { icon: '✅', label: "Today's Plan goal (finish all for a bonus)", xp: `${XP_RULES.SOURCES.daily_goal} (+${XP_RULES.SOURCES.daily_plan_bonus})` },
  { icon: '🎮', label: 'Play a Game Den match', xp: `${XP_RULES.SOURCES.game_den}` },
  { icon: '⚽', label: 'Win a penalty shootout', xp: `${XP_RULES.SOURCES.football_win}` },
  { icon: '🏀', label: 'Court 1v1 or 2v2 rally (more for a win)', xp: `${XP_RULES.SOURCES.court_match}–${XP_RULES.SOURCES.rally_win}` },
  { icon: '🛺', label: 'Ride a keke, buy food, furnish your room', xp: `${XP_RULES.SOURCES.food_purchase}–${XP_RULES.SOURCES.hostel_expand}` },
];
