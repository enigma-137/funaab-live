// Monte Carlo comparison of the OLD (pre-012, as audited on the server) and NEW economies.
// Run: npm run sim:economy   (deterministic seed; prints a table and exits non-zero if NEW misses targets)
import assert from 'node:assert/strict';
import { CAMPUS_JOBS } from '../src/config/campusJobs';
import { ECONOMY_CONFIG as E } from '../src/config/economy';
import { FOOD_VENDOR_LIST } from '../src/config/foodVendors';
import { HOSTEL_SHOP } from '../src/config/hostelShop';
import { kekeDestinations } from '../src/config/kekeRoutes';

type Economy = {
  name: string;
  starter: number;
  daily: number;
  jobs: number[];
  firstJobBonus: number;
  meals: number[];
  drinks: number[];
  keke: number[];
  psWin: number;
  psLose: number;
  lecture: number;
  lectureDailyCap: number;
  lawnFine: number;
  furniture: number[]; // wishlist in buying order
};

const wishlist = ['hostel_chair', 'hostel_bedsheet', 'hostel_pillow', 'hostel_fan_basic', 'hostel_table', 'hostel_curtain',
  'hostel_rug', 'hostel_lamp', 'hostel_tv_basic', 'hostel_speaker', 'hostel_ps_console', 'hostel_game_pad', 'hostel_generator_small'];
// Pre-012 server values (supabase/migrations 002/003/005/007/011, the money actually moved).
const OLD_HOSTEL: Record<string, number> = { hostel_chair: 150, hostel_bedsheet: 200, hostel_pillow: 100, hostel_fan_basic: 350,
  hostel_table: 250, hostel_curtain: 200, hostel_rug: 250, hostel_lamp: 250, hostel_tv_basic: 500, hostel_speaker: 300,
  hostel_ps_console: 800, hostel_game_pad: 200, hostel_generator_small: 700 };
const fares = kekeDestinations.map((d) => d.fare);

const OLD: Economy = {
  name: 'OLD', starter: 5000, daily: 1000, jobs: [250, 200, 175, 200], firstJobBonus: 0,
  meals: [1200, 1300, 1100, 1000, 800, 1200, 600, 800, 700, 600, 800], drinks: [150, 350, 150, 400],
  keke: fares, psWin: 120, psLose: 40, lecture: 100, lectureDailyCap: 99, lawnFine: 500,
  furniture: wishlist.map((id) => OLD_HOSTEL[id]),
};
const NEW: Economy = {
  // SIM_DAILY overrides the daily allowance for sensitivity runs.
  name: 'NEW', starter: E.STARTER_BALANCE, daily: Number(process.env.SIM_DAILY) || E.DAILY_RESUMPTION_ALLOWANCE,
  jobs: CAMPUS_JOBS.map((j) => j.reward),
  firstJobBonus: E.FIRST_JOB_DAILY_BONUS,
  meals: [...E.FLORAL_WORLD_MENU, ...E.FOOD_COURT_MENU].filter((m) => m.type === 'food').map((m) => m.price)
    .concat(FOOD_VENDOR_LIST.flatMap((v) => v.items.map((i) => i.price))),
  drinks: [...E.FLORAL_WORLD_MENU, ...E.FOOD_COURT_MENU].filter((m) => m.type === 'drink').map((m) => m.price),
  keke: fares, psWin: E.GAME_DEN.WINNER, psLose: E.GAME_DEN.LOSER, lecture: E.ATTENDANCE_ALLOWANCE,
  lectureDailyCap: E.ATTENDANCE_DAILY_LIMIT, lawnFine: E.LAWN_FINE,
  furniture: wishlist.map((id) => HOSTEL_SHOP.find((i) => i.id === id)!.price),
};

type Profile = { name: string; dailyClaim: number; jobs: [number, number]; meals: [number, number]; drink: number;
  keke: [number, number]; psMatches: number; lectures: number; lawnFine: number; buffer: number };
const PROFILES: Profile[] = [
  // Brief's representative player: 2 jobs, 1 meal, Keke trips, occasional Game Den / furniture / fine.
  { name: 'active', dailyClaim: 0.9, jobs: [2, 2], meals: [1, 1], drink: 0.5, keke: [1, 3], psMatches: 0.5, lectures: 0.6, lawnFine: 0.08, buffer: 1500 },
  { name: 'casual', dailyClaim: 0.7, jobs: [0, 1], meals: [1, 1], drink: 0.3, keke: [0, 2], psMatches: 0.15, lectures: 0.2, lawnFine: 0.05, buffer: 2500 },
  { name: 'grinder', dailyClaim: 1, jobs: [5, 8], meals: [1, 2], drink: 0.8, keke: [2, 4], psMatches: 2, lectures: 1.5, lawnFine: 0.05, buffer: 1000 },
];

function rng(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function simulate(econ: Economy, p: Profile, players = 2000, sessions = 100) {
  const r = rng(0xf00d);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const between = ([lo, hi]: [number, number]) => lo + Math.floor(r() * (hi - lo + 1));
  const at = { 10: 0, 50: 0, 100: 0 } as Record<number, number>;
  let income = 0, spend = 0, broke = 0, permanentlyBroke = 0, owned = 0, bigThree = 0, bigThreeDay = 0, skippedMeals = 0;
  const bigIdx = [8, 10, 12]; // TV, PS, generator in the wishlist
  for (let pl = 0; pl < players; pl++) {
    let bal = econ.starter, next = 0, brokeStreak = 0, everStuck = false, gotBig = -1;
    for (let day = 1; day <= sessions; day++) {
      let inc = 0, out = 0;
      if (r() < p.dailyClaim) inc += econ.daily;
      const jobs = between(p.jobs);
      for (let j = 0; j < jobs; j++) inc += pick(econ.jobs) + (j === 0 ? econ.firstJobBonus : 0);
      const matches = Math.floor(p.psMatches) + (r() < p.psMatches % 1 ? 1 : 0);
      for (let m = 0; m < Math.min(matches, 6); m++) inc += r() < 0.5 ? econ.psWin : econ.psLose;
      const lectures = Math.min(econ.lectureDailyCap, Math.floor(p.lectures) + (r() < p.lectures % 1 ? 1 : 0));
      inc += lectures * econ.lecture;
      bal += inc; income += inc;
      // Necessities first; a player who can't afford the meal skips it.
      const meals = between(p.meals);
      for (let m = 0; m < meals; m++) { const c = pick(econ.meals); if (bal - out >= c) out += c; else skippedMeals++; }
      if (r() < p.drink) { const c = pick(econ.drinks); if (bal - out >= c) out += c; }
      const trips = between(p.keke);
      for (let t = 0; t < trips; t++) { const c = pick(econ.keke); if (bal - out >= c) out += c; }
      if (r() < p.lawnFine) out += Math.min(econ.lawnFine, bal - out);
      // Occasional furniture: buy the next wishlist item once it leaves a safety buffer.
      if (next < econ.furniture.length && r() < 0.35 && bal - out - econ.furniture[next] >= p.buffer) { out += econ.furniture[next]; next++; }
      if (gotBig < 0 && bigIdx.every((i) => i < next)) gotBig = day;
      bal -= out; spend += out;
      const cheapestMeal = Math.min(...econ.meals);
      brokeStreak = bal < cheapestMeal ? brokeStreak + 1 : 0;
      if (brokeStreak >= 5) everStuck = true;
      if (day in at) at[day] += bal;
    }
    if (everStuck) broke++;
    if (bal < Math.min(...econ.meals)) permanentlyBroke++;
    owned += next;
    if (gotBig > 0) { bigThree++; bigThreeDay += gotBig; }
  }
  const per = (x: number) => Math.round(x / players);
  return {
    income: Math.round(income / players / sessions), spend: Math.round(spend / players / sessions),
    bal10: per(at[10]), bal50: per(at[50]), bal100: per(at[100]),
    stuck: Math.round((broke / players) * 100), brokeAtEnd: Math.round((permanentlyBroke / players) * 100),
    furniture: +(owned / players).toFixed(1), bigThree: Math.round((bigThree / players) * 100),
    bigThreeDay: bigThree ? Math.round(bigThreeDay / bigThree) : null, skippedMeals: +(skippedMeals / players).toFixed(1),
  };
}

const results: Record<string, Record<string, ReturnType<typeof simulate>>> = {};
for (const p of PROFILES) results[p.name] = { OLD: simulate(OLD, p), NEW: simulate(NEW, p) };

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
console.log(`Typical meal: OLD ₦${avg(OLD.meals)}  NEW ₦${avg(NEW.meals)} | typical job: OLD ₦${avg(OLD.jobs)}  NEW ₦${avg(NEW.jobs)} | jobs per meal: OLD ${(avg(OLD.meals) / avg(OLD.jobs)).toFixed(1)}  NEW ${(avg(NEW.meals) / avg(NEW.jobs)).toFixed(1)}\n`);
const rows = [
  ['avg daily income', 'income'], ['avg daily spending', 'spend'], ['balance after 10 sessions', 'bal10'],
  ['balance after 50 sessions', 'bal50'], ['balance after 100 sessions', 'bal100'], ['stuck broke ≥5 sessions (%)', 'stuck'],
  ['broke at day 100 (%)', 'brokeAtEnd'], ['meals skipped (100 days)', 'skippedMeals'], ['furniture items owned', 'furniture'],
  ['own TV+PS+generator (%)', 'bigThree'], ['…on average by session', 'bigThreeDay'],
] as const;
for (const p of PROFILES) {
  console.log(`== ${p.name} player (2000 players × 100 sessions)`);
  console.log(`${'metric'.padEnd(30)}${'OLD'.padStart(10)}${'NEW'.padStart(10)}`);
  for (const [label, key] of rows) console.log(`${label.padEnd(30)}${String(results[p.name].OLD[key]).padStart(10)}${String(results[p.name].NEW[key]).padStart(10)}`);
  console.log('');
}

// Targets from the brief: a meal ≈ 1–2 simple activities; active players gradually furnish but don't
// get infinitely rich; casual players can still eat and travel.
const active = results.active.NEW, casual = results.casual.NEW;
assert(avg(NEW.meals) / avg(NEW.jobs) <= 2 && avg(NEW.meals) / avg(NEW.jobs) >= 0.5, 'a meal costs about 1–2 jobs');
assert(active.stuck <= 1, 'active players never get stuck broke');
// Casual players may dip below a meal between jobs, but one job (₦250–₦500, +₦200 first-job bonus) recovers
// them; what matters is that they still eat and travel.
assert(casual.skippedMeals <= 5 && casual.brokeAtEnd <= 15, 'casual players still eat and travel');
assert(active.bigThree >= 50 && active.bigThreeDay! >= 7, 'active players save up for TV + PS + generator, not instantly');
assert(active.income - active.spend > 0 && active.income - active.spend < 1500, 'active net income is positive but modest');
console.log('ECONOMY SIMULATION: NEW economy within targets.');
