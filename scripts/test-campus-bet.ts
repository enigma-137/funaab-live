// Campus Bet model tests + Monte Carlo economy simulation.
// Run: npm run test:campus-bet   (add --report for the full strategy table)
import assert from 'node:assert/strict';
import { CAMPUS_BET_TEAMS } from '../src/config/campusBetTeams';
import { CAMPUS_BET_MULTIPLIERS, campusBetPayout, isValidCampusBetStake, CAMPUS_BET_STAKE, type CampusBetPick } from '../src/config/campusBet';
import { drawOutcome, fixtureProbabilities, generateMatchday, MODEL, secureRandom, validateMatchday, type GeneratedFixture } from '../src/config/campusBetModel';

const report = process.argv.includes('--report');

// ---------- Teams ----------
assert.equal(CAMPUS_BET_TEAMS.length, 10, 'exactly 10 clubs');
assert.equal(new Set(CAMPUS_BET_TEAMS.map((t) => t.id)).size, 10, 'unique club ids');
assert.equal(new Set(CAMPUS_BET_TEAMS.map((t) => t.shortName)).size, 10, 'unique short names');
assert(CAMPUS_BET_TEAMS.every((t) => t.hiddenBaseStrength >= 60 && t.hiddenBaseStrength <= 85), 'strengths within 60–85');
const realClubs = /real madrid|arsenal|barcelona|manchester|chelsea|liverpool|enyimba|rangers|kano pillars|shooting stars|remo stars|rivers united|plateau|lobi|heartland|akwa/i;
assert(CAMPUS_BET_TEAMS.every((t) => !realClubs.test(t.name)), 'no real club names');

// ---------- Probability model ----------
for (let gap = -60; gap <= 60; gap += 0.5) {
  const p = fixtureProbabilities(gap);
  assert(Math.abs(p.home + p.draw + p.away - 1) < 1e-9, `sum to 1 at gap ${gap}`);
  for (const win of [p.home, p.away]) assert(win >= MODEL.winMin - 1e-9 && win <= MODEL.winMax + 1e-9, `win cap at gap ${gap}: ${win}`);
  assert(p.draw >= MODEL.drawMin - 1e-9 && p.draw <= MODEL.drawMax + 1e-9, `draw range at gap ${gap}: ${p.draw}`);
}
const extreme = fixtureProbabilities(60);
assert(extreme.home <= 0.6 && extreme.away >= 0.17, 'even the biggest mismatch can be lost');
const even = fixtureProbabilities(0);
assert.equal(even.home, even.away, 'level teams are symmetric');

// ---------- Matchday generation ----------
for (let i = 0; i < 2000; i++) {
  const md = generateMatchday();
  assert.equal(validateMatchday(md), null);
  assert.equal(md.length, 5);
  assert(md.every((f) => f.home_team_id !== f.away_team_id), 'no self-pairing');
}
assert.notEqual(validateMatchday(generateMatchday().slice(0, 4)), null, 'rejects 4 fixtures');
const dup = generateMatchday(); dup[1] = { ...dup[1], home_team_id: dup[0].home_team_id };
assert.notEqual(validateMatchday(dup), null, 'rejects a club playing twice');
const badP = generateMatchday(); badP[0] = { ...badP[0], home_probability: 0.9, draw_probability: 0.05, away_probability: 0.05 };
assert.notEqual(validateMatchday(badP), null, 'rejects uncapped probabilities');

// Repeat avoidance: the last three matchdays' pairings should rarely come back.
{
  let repeats = 0, total = 0;
  const history: GeneratedFixture[][] = [];
  for (let i = 0; i < 3000; i++) {
    const recent = history.slice(-MODEL.recentRoundsForRepeats).flat().map((f) => [f.home_team_id, f.away_team_id] as [string, string]);
    const keys = new Set(recent.map(([a, b]) => [a, b].sort().join('|')));
    const md = generateMatchday(recent);
    repeats += md.filter((f) => keys.has([f.home_team_id, f.away_team_id].sort().join('|'))).length;
    total += 5; history.push(md);
  }
  assert(repeats / total < 0.02, `recent fixtures repeat rarely (${(100 * repeats / total).toFixed(2)}%)`);
}

// ---------- Payout + stake rules ----------
assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => campusBetPayout(100, k)), [0, 0, 50, 100, 300, 500]);
assert.equal(campusBetPayout(100, 4), 300, '4/5 pays 3× stake');
assert.equal(campusBetPayout(500, 5), 2500, 'max possible payout is ₦2,500');
for (const ok of [50, 100, 130, 500]) assert(isValidCampusBetStake(ok));
for (const bad of [49, 137, 501, 0, -100, 100.5, NaN, '100', null]) assert(!isValidCampusBetStake(bad));
assert.equal(campusBetPayout(130, 2), 65, 'half-stake payouts stay whole Naira');
assert.equal(CAMPUS_BET_STAKE.default, 100);

// ---------- Secure RNG sanity ----------
{
  const n = 200000; let sum = 0; const buckets = new Array(10).fill(0);
  for (let i = 0; i < n; i++) { const u = secureRandom(); assert(u >= 0 && u < 1); sum += u; buckets[Math.floor(u * 10)]++; }
  assert(Math.abs(sum / n - 0.5) < 0.005, 'RNG mean ≈ 0.5');
  assert(buckets.every((b) => Math.abs(b / n - 0.1) < 0.005), 'RNG roughly uniform');
}

// ---------- Monte Carlo ----------
type Strategy = (md: GeneratedFixture[], form: Map<string, number>) => CampusBetPick[];
const favouriteSide = (f: GeneratedFixture): CampusBetPick => (f.home_probability >= f.away_probability ? 'HOME' : 'AWAY');
const picks: CampusBetPick[] = ['HOME', 'DRAW', 'AWAY'];
const strategies: Record<string, Strategy> = {
  'A random picks': (md) => md.map(() => picks[Math.floor(secureRandom() * 3)]),
  'B always favourite (oracle)': (md) => md.map(favouriteSide),
  'B2 favourite by public form': (md, form) => md.map((f) => ((form.get(f.home_team_id) ?? 0) >= (form.get(f.away_team_id) ?? 0) ? 'HOME' : 'AWAY')),
  'C always underdog (oracle)': (md) => md.map((f) => (favouriteSide(f) === 'HOME' ? 'AWAY' : 'HOME')),
  'D highest-probability outcome': (md) => md.map((f) => {
    const best = Math.max(f.home_probability, f.draw_probability, f.away_probability);
    return best === f.home_probability ? 'HOME' : best === f.draw_probability ? 'DRAW' : 'AWAY';
  }),
  'E mixed (50% fav / 25% draw / 25% dog)': (md) => md.map((f) => {
    const u = secureRandom();
    return u < 0.5 ? favouriteSide(f) : u < 0.75 ? 'DRAW' : favouriteSide(f) === 'HOME' ? 'AWAY' : 'HOME';
  }),
  'F always draw': (md) => md.map(() => 'DRAW'),
  'G always home': (md) => md.map(() => 'HOME'),
};

const ROUNDS = 50000;
const STAKE = 100;
const SHIPPED = `shipped [${CAMPUS_BET_MULTIPLIERS.join(',')}]`;
const DRAFT = 'spec draft [0,0,1,2,3,5]';
const tables: Record<string, readonly number[]> = { [DRAFT]: [0, 0, 1, 2, 3, 5], 'no 2/5 [0,0,0,1,3,5]': [0, 0, 0, 1, 3, 5], [SHIPPED]: CAMPUS_BET_MULTIPLIERS };
const counts: Record<string, number[]> = Object.fromEntries(Object.keys(strategies).map((k) => [k, new Array(6).fill(0)]));
const teamStats = new Map(CAMPUS_BET_TEAMS.map((t) => [t.id, { w: 0, d: 0, l: 0 }]));
const formPoints = new Map<string, number[]>(CAMPUS_BET_TEAMS.map((t) => [t.id, []]));
let homeWins = 0, draws = 0, awayWins = 0, maxWinP = 0, minWinP = 1;
const roundDraws: number[] = [];
let strongestWins = 0, strongestGames = 0, strongestAllWinRounds = 0;
const strongest = [...CAMPUS_BET_TEAMS].sort((a, b) => b.hiddenBaseStrength - a.hiddenBaseStrength)[0].id;
const history: GeneratedFixture[][] = [];

for (let r = 0; r < ROUNDS; r++) {
  const recent = history.slice(-3).flat().map((f) => [f.home_team_id, f.away_team_id] as [string, string]);
  const md = generateMatchday(recent);
  history.push(md); if (history.length > 3) history.shift();
  const publicForm = new Map([...formPoints].map(([id, pts]) => [id, pts.slice(-5).reduce((a, b) => a + b, 0)]));
  const results = md.map((f) => drawOutcome(f, secureRandom()));
  for (const [name, strategy] of Object.entries(strategies)) {
    const ticket = strategy(md, publicForm);
    counts[name][ticket.filter((p, i) => p === results[i]).length]++;
  }
  let drawsThisRound = 0;
  md.forEach((f, i) => {
    maxWinP = Math.max(maxWinP, f.home_probability, f.away_probability);
    minWinP = Math.min(minWinP, f.home_probability, f.away_probability);
    const res = results[i];
    if (res === 'HOME') homeWins++; else if (res === 'DRAW') { draws++; drawsThisRound++; } else awayWins++;
    const h = teamStats.get(f.home_team_id)!, a = teamStats.get(f.away_team_id)!;
    if (res === 'HOME') { h.w++; a.l++; } else if (res === 'AWAY') { a.w++; h.l++; } else { h.d++; a.d++; }
    formPoints.get(f.home_team_id)!.push(res === 'HOME' ? 3 : res === 'DRAW' ? 1 : 0);
    formPoints.get(f.away_team_id)!.push(res === 'AWAY' ? 3 : res === 'DRAW' ? 1 : 0);
    if (f.home_team_id === strongest || f.away_team_id === strongest) {
      strongestGames++;
      const won = (f.home_team_id === strongest && res === 'HOME') || (f.away_team_id === strongest && res === 'AWAY');
      if (won) strongestWins++;
    }
  });
  roundDraws.push(drawsThisRound);
  if (r % 50 === 0) for (const pts of formPoints.values()) pts.splice(0, Math.max(0, pts.length - 5));
}
const games = ROUNDS * 5;

// Expected return per table and strategy.
const expectedReturn = (dist: number[], table: readonly number[]) => dist.reduce((sum, n, k) => sum + n * table[k], 0) / ROUNDS;
const rows = Object.entries(counts).map(([name, dist]) => ({
  name,
  dist,
  returns: Object.fromEntries(Object.entries(tables).map(([t, table]) => [t, expectedReturn(dist, table)])),
}));

// ---------- Economy assertions (shipped table) ----------
const shipped = SHIPPED;
for (const row of rows) assert(row.returns[shipped] < 0.95, `${row.name} must not be profitable: return ${row.returns[shipped].toFixed(3)}`);
assert(rows.find((r) => r.name.startsWith('B always'))!.returns[DRAFT] > 1, 'confirms the draft table would pay favourite-backers');

// ---------- Pattern audits ----------
const homeRate = homeWins / games, drawRate = draws / games, awayRate = awayWins / games;
assert(homeRate > 0.33 && homeRate < 0.43, `home win rate ${homeRate}`);
assert(drawRate > 0.22 && drawRate < 0.32, `draw rate ${drawRate}`);
assert(maxWinP <= 0.6 + 1e-9 && minWinP >= 0.17 - 1e-9, 'caps hold over all simulated fixtures');
const strongestRate = strongestWins / strongestGames;
assert(strongestRate > 0.42 && strongestRate < 0.58, `strongest club wins ${strongestRate}`);
const winRate = (id: string) => { const s = teamStats.get(id)!; return s.w / (s.w + s.d + s.l); };
const sortedTeams = [...CAMPUS_BET_TEAMS].sort((a, b) => b.hiddenBaseStrength - a.hiddenBaseStrength);
assert(winRate(sortedTeams[9].id) > 0.18 && winRate(sortedTeams[9].id) < 0.32, 'weakest club still wins sometimes');
// Draw counts in consecutive rounds should be uncorrelated (no "draws every N rounds").
const mean = roundDraws.reduce((a, b) => a + b, 0) / roundDraws.length;
let num = 0, den = 0;
for (let i = 0; i < roundDraws.length; i++) { den += (roundDraws[i] - mean) ** 2; if (i) num += (roundDraws[i] - mean) * (roundDraws[i - 1] - mean); }
const lag1 = num / den;
assert(Math.abs(lag1) < 0.03, `draw autocorrelation ${lag1}`);

if (report) {
  const pct = (n: number) => `${(100 * n / ROUNDS).toFixed(2)}%`;
  console.log(`\nCampus Bet Monte Carlo — ${ROUNDS.toLocaleString()} matchdays, ₦${STAKE} stake, same fixtures/results for every strategy\n`);
  for (const row of rows) {
    const r = row.returns[shipped];
    console.log(`${row.name.padEnd(40)} 5/5 ${pct(row.dist[5]).padStart(6)}  4/5 ${pct(row.dist[4]).padStart(6)}  3/5 ${pct(row.dist[3]).padStart(6)}  ` +
      `2/5 ${pct(row.dist[2]).padStart(6)}  0-1/5 ${pct(row.dist[0] + row.dist[1]).padStart(6)}  avg payout ₦${(r * STAKE).toFixed(1).padStart(5)}  net ₦${((r - 1) * STAKE).toFixed(1).padStart(6)}  return ${(100 * r).toFixed(1)}%  ` +
      `| ${Object.entries(row.returns).filter(([t]) => t !== shipped).map(([t, v]) => `${t}: ${(100 * v).toFixed(1)}%`).join('  ')}`);
  }
  console.log(`\nOutcomes: home ${(100 * homeRate).toFixed(1)}%, draw ${(100 * drawRate).toFixed(1)}%, away ${(100 * awayRate).toFixed(1)}%  ·  win-prob range ${minWinP}–${maxWinP}  ·  draw lag-1 autocorrelation ${lag1.toFixed(4)}`);
  console.log('Club win rates (strongest → weakest):');
  for (const t of sortedTeams) {
    const s = teamStats.get(t.id)!, n = s.w + s.d + s.l;
    console.log(`  ${t.name.padEnd(16)} W ${(100 * s.w / n).toFixed(1)}%  D ${(100 * s.d / n).toFixed(1)}%  L ${(100 * s.l / n).toFixed(1)}%`);
  }
}
console.log(`CAMPUS BET MODEL PASSED: 10 fictional clubs, capped probabilities, ${ROUNDS.toLocaleString()} simulated matchdays, no profitable strategy, no outcome patterns.`);
