// Campus Bet hidden match model. Server-only (Worker + tests): imports hidden strengths.
// Fixtures and probabilities are generated here with secure randomness; the database
// validates them, stores them once, and draws the actual results with its own
// strong randomness at settlement (see 010_campus_bet.sql).
import { CAMPUS_BET_TEAMS, campusBetTeamById } from './campusBetTeams';
import { CAMPUS_BET_FIXTURES_PER_ROUND, type CampusBetPick } from './campusBet';

export type Rng = () => number;

/** Uniform [0,1) from the platform CSPRNG (Workers and Node both expose Web Crypto). */
const pool = new Uint32Array(1024);
let poolIndex = pool.length;
export const secureRandom: Rng = () => {
  if (poolIndex + 2 > pool.length) { crypto.getRandomValues(pool); poolIndex = 0; }
  // 53 random bits → exact double in [0,1).
  const value = ((pool[poolIndex] >>> 5) * 67108864 + (pool[poolIndex + 1] >>> 6)) / 9007199254740992;
  poolIndex += 2;
  return value;
};

export const MODEL = {
  formRange: 10, // per-matchday hidden form, uniform ±10, re-rolled every round
  matchVariance: 4, // extra per-fixture noise, uniform ±4 per side
  homeAdvantage: 3,
  logisticScale: 18, // strength gap that moves the decisive-outcome split by one logit
  drawBase: 0.3,
  drawSlope: 0.0025, // draws get rarer as the gap widens
  drawMin: 0.2,
  drawMax: 0.32,
  winMax: 0.6, // no side is ever more than 60% to win
  winMin: 0.17, // and no side is ever less than 17%
  recentRoundsForRepeats: 3,
} as const;

export interface FixtureProbabilities { home: number; draw: number; away: number }
export interface GeneratedFixture {
  slot: number;
  home_team_id: string;
  away_team_id: string;
  home_probability: number;
  draw_probability: number;
  away_probability: number;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Effective strength gap (home minus away, including home advantage) → probabilities.
 * The decisive share follows a logistic curve; draws shrink with the gap; both win
 * probabilities are then clamped to [winMin, winMax] and draw takes the remainder.
 */
export function fixtureProbabilities(gap: number): FixtureProbabilities {
  const draw0 = Math.min(MODEL.drawMax, Math.max(MODEL.drawMin, MODEL.drawBase - MODEL.drawSlope * Math.abs(gap)));
  const share = 1 / (1 + Math.exp(-gap / MODEL.logisticScale));
  const clamp = (p: number) => Math.min(MODEL.winMax, Math.max(MODEL.winMin, p));
  let home = clamp((1 - draw0) * share);
  let away = clamp((1 - draw0) * (1 - share));
  let draw = 1 - home - away;
  if (draw < MODEL.drawMin) {
    // Take the shortfall from the favourite; it stays above winMin because draw ≥ 0.2.
    const shortfall = MODEL.drawMin - draw;
    if (home >= away) home -= shortfall; else away -= shortfall;
  } else if (draw > MODEL.drawMax) {
    const surplus = draw - MODEL.drawMax;
    const total = home + away;
    home = Math.min(MODEL.winMax, home + surplus * (home / total));
    away = Math.min(MODEL.winMax, away + surplus * (away / total));
  }
  home = round4(home);
  away = round4(away);
  return { home, draw: round4(1 - home - away), away };
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pair all ten clubs into five fixtures. Tries several secure shuffles and keeps the
 * one that repeats the fewest pairings from the last few matchdays.
 */
export function generateMatchday(recentPairs: Array<[string, string]> = [], rng: Rng = secureRandom): GeneratedFixture[] {
  const recent = new Set(recentPairs.map(([a, b]) => pairKey(a, b)));
  let best: string[] = [];
  let bestRepeats = Infinity;
  for (let attempt = 0; attempt < 40 && bestRepeats > 0; attempt++) {
    const order = shuffle(CAMPUS_BET_TEAMS.map((t) => t.id), rng);
    let repeats = 0;
    for (let i = 0; i < order.length; i += 2) if (recent.has(pairKey(order[i], order[i + 1]))) repeats++;
    if (repeats < bestRepeats) { best = order; bestRepeats = repeats; }
  }
  const form = new Map(CAMPUS_BET_TEAMS.map((t) => [t.id, (rng() * 2 - 1) * MODEL.formRange]));
  const fixtures: GeneratedFixture[] = [];
  for (let i = 0; i < CAMPUS_BET_FIXTURES_PER_ROUND; i++) {
    const [home, away] = [best[i * 2], best[i * 2 + 1]];
    const strength = (id: string) =>
      campusBetTeamById(id)!.hiddenBaseStrength + form.get(id)! + (rng() * 2 - 1) * MODEL.matchVariance;
    const p = fixtureProbabilities(strength(home) + MODEL.homeAdvantage - strength(away));
    fixtures.push({
      slot: i + 1,
      home_team_id: home,
      away_team_id: away,
      home_probability: p.home,
      draw_probability: p.draw,
      away_probability: p.away,
    });
  }
  return fixtures;
}

/** Same rule the database applies at settlement: one uniform draw against the stored split. */
export function drawOutcome(f: Pick<GeneratedFixture, 'home_probability' | 'draw_probability'>, u: number): CampusBetPick {
  if (u < f.home_probability) return 'HOME';
  if (u < f.home_probability + f.draw_probability) return 'DRAW';
  return 'AWAY';
}

/** Structural checks mirrored by campus_bet_sync_trusted in SQL. */
export function validateMatchday(fixtures: GeneratedFixture[]): string | null {
  if (fixtures.length !== CAMPUS_BET_FIXTURES_PER_ROUND) return 'Matchday needs exactly 5 fixtures';
  const ids = fixtures.flatMap((f) => [f.home_team_id, f.away_team_id]);
  if (new Set(ids).size !== CAMPUS_BET_TEAMS.length || ids.some((id) => !campusBetTeamById(id))) return 'Every club plays exactly once';
  for (const f of fixtures) {
    const ps = [f.home_probability, f.draw_probability, f.away_probability];
    if (ps.some((p) => !Number.isFinite(p) || p < 0.15 || p > 0.62)) return 'Probability outside caps';
    if (Math.abs(ps[0] + ps[1] + ps[2] - 1) > 1e-6) return 'Probabilities must sum to 1';
  }
  return null;
}
