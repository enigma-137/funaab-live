// Weekly College League: students earn points for their college from things the server already
// records. Ranked by average points per active student (fair to small colleges), with a per-student
// weekly cap so one grinder can't carry a college. Server copy: migration 020 (drift-tested).
export const LEAGUE = {
  POINTS: { daily_goal: 10, lecture: 5, game_den_match: 5, hustle: 2, football_win: 15 },
  STUDENT_WEEKLY_CAP: 200,
  /** Colleges need this many active students to be ranked. */
  MIN_ACTIVE: 2,
};
export const LEAGUE_SOURCES: Array<{ key: keyof typeof LEAGUE.POINTS; label: string; icon: string }> = [
  { key: 'daily_goal', label: "Today's Plan goal", icon: '📅' },
  { key: 'lecture', label: 'Lecture attended', icon: '🎓' },
  { key: 'game_den_match', label: 'Game Den match', icon: '🎮' },
  { key: 'hustle', label: 'Hustle done', icon: '💼' },
  { key: 'football_win', label: 'Penalty challenge win', icon: '⚽' },
];
