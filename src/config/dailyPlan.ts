// Today's Plan: 3 goals a day per student, drawn from this pool by the database.
// Server copy: supabase/migrations/016_daily_plan.sql (scripts/test-daily-plan-db.ts fails on drift).
// 'db' goals are proven from existing ledgers (lectures, jobs, food, keke, Game Den);
// 'worker' goals are reported by the Worker from trusted positions/actions.

import { locationById } from './campusLocations';
import { LOVE_GARDEN } from './loveGarden';
import { FOOTBALL_PITCH } from './football';

export type DailyGoalSource = 'db' | 'worker';
export interface DailyGoalDef { id: string; title: string; icon: string; source: DailyGoalSource; target: number; reward: number }

export const DAILY_GOALS: DailyGoalDef[] = [
  { id: 'attend_lecture', title: 'Attend a lecture', icon: '🎓', source: 'db', target: 1, reward: 100 },
  { id: 'finish_job', title: 'Finish a campus job', icon: '💼', source: 'db', target: 1, reward: 100 },
  { id: 'buy_food', title: 'Buy something to eat', icon: '🍲', source: 'db', target: 1, reward: 100 },
  { id: 'ride_keke', title: 'Ride a Keke', icon: '🛺', source: 'db', target: 1, reward: 100 },
  { id: 'game_den_match', title: 'Play a Game Den match', icon: '🎮', source: 'db', target: 1, reward: 100 },
  { id: 'take_penalties', title: 'Take 3 penalties at the Sports Centre', icon: '⚽', source: 'worker', target: 3, reward: 100 },
  { id: 'visit_love_garden', title: 'Visit the Love Garden', icon: '🌳', source: 'worker', target: 1, reward: 100 },
  { id: 'garden_hangout', title: 'Sit in the Love Garden with another student', icon: '🪑', source: 'worker', target: 1, reward: 100 },
  { id: 'visit_friend_room', title: "Visit a friend's hostel room", icon: '🚪', source: 'worker', target: 1, reward: 100 },
  { id: 'campus_night', title: 'Show up for Campus Night (8–9pm, Love Garden)', icon: '🌙', source: 'worker', target: 1, reward: 100 },
];

export const DAILY_PLAN = {
  GOALS_PER_DAY: 3,
  /** Paid once when all of the day's goals are claimed; also advances the streak. */
  ALL_DONE_BONUS: 150,
  STREAK_BADGES: [3, 7, 30] as const,
  /** Campus Night: Lagos wall-clock hour [start, end). */
  CAMPUS_NIGHT_HOURS: [20, 21] as const,
};

/** Where a goal's "Go" button takes the student: a route arrow to a place, or the sheet that does it. */
export type GoalTarget =
  | { kind: 'place'; id: string; name: string; at: [number, number, number]; icon: string }
  | { kind: 'sheet'; modal: 'campus_jobs' | 'friends'; hint: string }
  | { kind: 'lecture' };
export const goalTarget = (goalId: string): GoalTarget | null => {
  const place = (id: string, name: string, at: [number, number, number], icon: string): GoalTarget => ({ kind: 'place', id, name, at, icon });
  switch (goalId) {
    case 'attend_lecture': return { kind: 'lecture' };
    case 'finish_job': return { kind: 'sheet', modal: 'campus_jobs', hint: 'Pick a job, then follow the arrow.' };
    case 'buy_food': return place('food-court', 'Food Court', locationById('food-court').entrance, '🍲');
    case 'ride_keke': return place('car-park', 'Car Park Keke stop', locationById('car-park').kekeStop, '🛺');
    case 'game_den_match': return place('ps-room', 'Game Den', locationById('ps-room').entrance, '🎮');
    case 'take_penalties': return place('sports-penalty-spot', 'Penalty spot', FOOTBALL_PITCH.shooterSpot, '⚽');
    case 'visit_love_garden':
    case 'garden_hangout':
    case 'campus_night': return place('love-garden', LOVE_GARDEN.name, LOVE_GARDEN.centre, '🌳');
    case 'visit_friend_room': return { kind: 'sheet', modal: 'friends', hint: 'Open a friend and invite yourself in, or accept an invite.' };
    default: return null;
  }
};

export const dailyGoal = (id: string) => DAILY_GOALS.find((g) => g.id === id);
export const workerGoalIds = DAILY_GOALS.filter((g) => g.source === 'worker').map((g) => g.id);

/** Lagos hour (UTC+1, no DST) for any instant. */
export const lagosHour = (ms: number) => new Date(ms + 3600000).getUTCHours();
export const isCampusNight = (ms: number) => {
  const h = lagosHour(ms);
  return h >= DAILY_PLAN.CAMPUS_NIGHT_HOURS[0] && h < DAILY_PLAN.CAMPUS_NIGHT_HOURS[1];
};
/** Lagos calendar day as YYYY-MM-DD. */
export const lagosDay = (ms: number) => new Date(ms + 3600000).toISOString().slice(0, 10);
