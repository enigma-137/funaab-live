// Goals: daily tasks, streak bonus, badges and leaderboards. The server (migration 015) decides
// progress and pays rewards; these values mirror it for display. scripts/test-goals.ts checks drift.

export type DailyTaskId = 'allowance' | 'job' | 'two_jobs' | 'lecture' | 'keke' | 'game_den' | 'food';

/** Where "Go" sends the student for each task. */
export type GoalAction = 'daily_reward' | 'campus_jobs' | 'lecture_hall' | 'campus_map' | 'game_den' | 'food_court';

export const DAILY_TASKS: Record<DailyTaskId, { title: string; target: number; reward: number; icon: string; hint: string; action: GoalAction }> = {
  allowance: { title: 'Claim your daily allowance', target: 1, reward: 50, icon: '🎁', hint: 'Open Allowance on your phone.', action: 'daily_reward' },
  job: { title: 'Finish a campus job', target: 1, reward: 50, icon: '💼', hint: 'Pick one from the Jobs board.', action: 'campus_jobs' },
  two_jobs: { title: 'Finish 2 campus jobs', target: 2, reward: 50, icon: '💼', hint: 'Any two jobs from the Jobs board.', action: 'campus_jobs' },
  lecture: { title: 'Attend a lecture', target: 1, reward: 50, icon: '🎓', hint: 'Sit through a live class.', action: 'lecture_hall' },
  keke: { title: 'Take a keke ride', target: 1, reward: 50, icon: '🛺', hint: 'Wave down a keke at any stop.', action: 'campus_map' },
  game_den: { title: 'Play a Game Den match', target: 1, reward: 50, icon: '🎮', hint: 'Finish a penalty shootout.', action: 'game_den' },
  food: { title: 'Buy something to eat', target: 1, reward: 50, icon: '🍲', hint: 'The Food Court or a campus vendor.', action: 'food_court' },
};

/** All-three bonus: ₦100 on day 1 of a streak, +₦25 each day, capped at ₦250 from day 7. */
export const TASK_BONUS = { base: 100, step: 25, maxSteps: 6 } as const;
export const taskBonusFor = (streakDay: number) =>
  TASK_BONUS.base + TASK_BONUS.step * Math.min(Math.max(streakDay, 1) - 1, TASK_BONUS.maxSteps);

/** Colleges that count toward "Visited every college" (must match college_visits in 015). */
export const VISIT_COLLEGES = ['colfhec', 'coleng', 'colerm', 'colvet', 'colanim', 'colplant', 'colcoms', 'colbios', 'colphys'] as const;
/** Metres from a college's entrance that count as a visit. */
export const VISIT_RADIUS = 14;

export type AchievementCounts = {
  jobs: number; keke: number; den_wins: number; full_class_days: number;
  colleges: number; best_streak: number; friends: number;
};

export const BADGES: Array<{ id: string; title: string; description: string; icon: string; metric: keyof AchievementCounts; target: number }> = [
  { id: 'first_keke', title: 'First keke ride', description: 'Ride a keke anywhere on campus.', icon: '🛺', metric: 'keke', target: 1 },
  { id: 'first_shift', title: 'First shift', description: 'Finish your first campus job.', icon: '💼', metric: 'jobs', target: 1 },
  { id: 'hard_worker', title: 'Hard worker', description: 'Finish 25 campus jobs.', icon: '🛠️', metric: 'jobs', target: 25 },
  { id: 'penalty_king', title: 'Penalty king', description: 'Win 10 Game Den matches.', icon: '👑', metric: 'den_wins', target: 10 },
  { id: 'never_missed', title: 'Never missed a class', description: 'Attend 3 lectures in a day, on 5 different days.', icon: '📚', metric: 'full_class_days', target: 5 },
  { id: 'explorer', title: 'Visited every college', description: `Walk up to all ${VISIT_COLLEGES.length} college buildings.`, icon: '🧭', metric: 'colleges', target: VISIT_COLLEGES.length },
  { id: 'on_a_roll', title: 'On a roll', description: 'Finish all daily tasks 7 days in a row.', icon: '🔥', metric: 'best_streak', target: 7 },
  { id: 'socialite', title: 'Campus socialite', description: 'Make 5 friends.', icon: '🤝', metric: 'friends', target: 5 },
];
