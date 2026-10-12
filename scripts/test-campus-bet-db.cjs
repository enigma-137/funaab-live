// Campus Bet database tests: lifecycle, ticket atomicity, settlement idempotency, RLS.
// Run: PGLITE_MODULE=<path> node scripts/test-campus-bet-db.cjs
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');

const pairs = [['falcons', 'titans'], ['green-lions', 'rovers-athletic'], ['campus-united', 'royal-stars'], ['abeokuta-city', 'warriors'], ['scholars', 'unity']];
const candidate = (ps = [0.45, 0.28, 0.27]) => pairs.map(([home_team_id, away_team_id], i) => ({
  slot: i + 1, home_team_id, away_team_id, home_probability: ps[0], draw_probability: ps[1], away_probability: ps[2],
}));

(async () => {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;`);
  for (const file of fs.readdirSync(path.join(__dirname, '../supabase/migrations')).sort()) await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations', file), 'utf8'));

  // Matchdays only open in the first 15 minutes of each 20-minute slot; wait out a closed window.
  const intoSlot = Number((await db.query('select (extract(epoch from now())::bigint % 1200) as s')).rows[0].s);
  if (intoSlot > 13 * 60) {
    const wait = 1200 - intoSlot + 2;
    console.log(`(waiting ${wait}s for the next matchday slot to open)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }

  const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b2';
  for (const [id, name] of [[A, 'Ada'], [B, 'Bolu']]) {
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    await db.query('insert into wallets(user_id,balance) values($1,1000)', [id]);
  }
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const sync = async (user, cand) => (await one('select campus_bet_sync_trusted($1,$2) as s', [user, cand ? JSON.stringify(cand) : null])).s;
  const place = async (user, round, stake, picks) => (await one('select campus_bet_place_trusted($1,$2,$3,$4) as r', [user, round, stake, JSON.stringify(picks)])).r;
  const balance = async (user) => Number((await one('select balance from wallets where user_id=$1', [user])).balance);
  const ledger = async (user) => (await db.query("select * from wallet_transactions where user_id=$1 and type like 'campus_bet%' order by created_at", [user])).rows;
  const closeCurrent = () => db.exec(`update campus_bet_rounds set slot_start=slot_start-interval '1 hour'*round_number,opens_at=now()-interval '16 minutes',closes_at=now()-interval '1 second' where status='OPEN'`);

  // ---------- Matchday generation ----------
  const first = await sync(A, null);
  assert.equal(first.needs_round, true, 'empty slot asks the Worker for fixtures');
  assert.deepEqual(first.recent_pairs, []);
  const bad = [
    ['4 fixtures', candidate().slice(0, 4)],
    ['club twice', candidate().map((f, i) => (i === 1 ? { ...f, home_team_id: 'falcons' } : f))],
    ['unknown club', candidate().map((f, i) => (i === 0 ? { ...f, home_team_id: 'real-madrid' } : f))],
    ['self pairing', candidate().map((f, i) => (i === 0 ? { ...f, away_team_id: 'falcons' } : f))],
    ['uncapped favourite', candidate([0.9, 0.05, 0.05])],
    ['sum ≠ 1', candidate([0.45, 0.3, 0.3])],
    ['not an array', { fixtures: candidate() }],
  ];
  for (const [label, c] of bad) await assert.rejects(() => sync(A, c), undefined, `rejects ${label}`);
  assert.equal(Number((await one('select count(*) n from campus_bet_rounds')).n), 0, 'rejected candidates leave no round');

  const opened = await sync(A, candidate());
  const round = opened.current;
  assert.equal(round.round_number, 1);
  assert.equal(round.status, 'OPEN');
  assert.equal(round.fixtures.length, 5, 'exactly 5 fixtures');
  const teams = round.fixtures.flatMap((f) => [f.home, f.away]);
  assert.equal(new Set(teams).size, 10, 'exactly 10 unique clubs');
  assert(round.fixtures.every((f) => !('home_probability' in f) && f.result === null), 'probabilities and results hidden');
  assert.equal((Date.parse(round.closes_at) - Date.parse(round.opens_at)) / 60000, 15, 'open for 15 minutes');
  const sums = (await db.query('select home_probability+draw_probability+away_probability s from campus_bet_fixtures')).rows;
  assert(sums.every((r) => Number(r.s) === 1), 'stored probabilities sum to 1');

  const again = await sync(B, candidate([0.3, 0.3, 0.4]));
  assert.equal(again.current.id, round.id, 'second Worker cannot replace the matchday');
  assert.equal(Number((await one('select count(*) n from campus_bet_rounds')).n), 1);
  assert.equal(Number((await one("select count(*) n from campus_bet_fixtures where home_probability=0.3")).n), 0);

  // ---------- Ticket ----------
  const picksA = ['HOME', 'DRAW', 'AWAY', 'HOME', 'HOME'];
  const placed = await place(A, round.id, 100, picksA);
  assert.equal(Number(placed.balance), 900, '₦1,000 − ₦100 stake');
  assert.equal(await balance(A), 900);
  assert.equal(placed.ticket.stake, 100);
  await assert.rejects(() => place(A, round.id, 100, picksA), /already have a ticket/, 'second ticket rejected');
  await assert.rejects(() => place(A, round.id, 200, ['AWAY', 'AWAY', 'AWAY', 'AWAY', 'AWAY']), /already have a ticket/);
  assert.equal(await balance(A), 900, 'rejected retries never charge');
  for (const [stake, picks, why] of [
    [100, picksA.slice(0, 4), 'partial ticket'], [100, [...picksA, 'HOME'], '6 picks'], [100, ['HOME', 'WIN', 'AWAY', 'HOME', 'HOME'], 'bad pick'],
    [100, { 1: 'HOME' }, 'object picks'], [40, picksA, 'below min'], [510, picksA, 'above max'], [105, picksA, 'not ₦10 step'],
  ]) await assert.rejects(() => place(B, round.id, stake, picks), undefined, `rejects ${why}`);
  await assert.rejects(() => place(B, '00000000-0000-4000-8000-000000000999', 100, picksA), /not found/);
  await db.query('update wallets set balance=30 where user_id=$1', [B]);
  await assert.rejects(() => place(B, round.id, 50, picksA), /Insufficient/, 'needs the stake in wallet');
  await db.query('update wallets set balance=1000 where user_id=$1', [B]);
  await place(B, round.id, 50, ['AWAY', 'AWAY', 'HOME', 'DRAW', 'AWAY']);
  assert.equal((await ledger(A)).length, 1);
  assert.equal(Number((await ledger(A))[0].amount), -100);
  assert.match((await ledger(A))[0].description, /Campus Bet ticket — Matchday 1/);

  const refreshed = await sync(A, null);
  assert.deepEqual(refreshed.my_ticket.picks, picksA, 'refresh restores the ticket');
  assert.equal(refreshed.my_ticket.settled_at, null);

  // ---------- RLS ----------
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${A}',false);`);
  await assert.rejects(() => sync(A, candidate()), undefined, 'players cannot run the lifecycle');
  await assert.rejects(() => place(A, round.id, 100, picksA), undefined, 'players cannot call trusted placement');
  await assert.rejects(() => db.query('select home_probability from campus_bet_fixtures'), undefined, 'hidden probabilities unreadable');
  assert.equal((await db.query('select id,home_team_id,result from campus_bet_fixtures')).rows.length, 5, 'public fixtures readable');
  assert.equal((await db.query('select * from campus_bet_tickets')).rows.length, 1, 'only own ticket visible');
  await assert.rejects(() => db.query("update campus_bet_fixtures set result='HOME'"), undefined, 'cannot write results');
  await assert.rejects(() => db.query("update campus_bet_tickets set payout=2500"), undefined, 'cannot write payouts');
  await assert.rejects(() => db.query("update campus_bet_rounds set status='SETTLED'"), undefined, 'cannot settle rounds');
  await assert.rejects(() => db.query('select campus_bet_settle_due()'), undefined, 'cannot trigger settlement');
  await db.exec('reset role;');

  // ---------- Settlement ----------
  await assert.rejects(() => (closeCurrent().then(() => place(B, round.id, 50, picksA))), /closed/, 'betting closes at closes_at');
  const lockedView = (await one('select campus_bet_round_json(r) j from campus_bet_rounds r where id=$1', [round.id])).j;
  assert.equal(lockedView.status, 'LOCKED', 'past close reads as LOCKED before settlement');
  const settled = await sync(null, null);
  assert.equal(settled.settled, 1, 'settles once');
  const r1 = await one('select * from campus_bet_rounds where id=$1', [round.id]);
  assert.equal(r1.status, 'SETTLED');
  const results = (await db.query('select * from campus_bet_fixtures where round_id=$1 order by slot', [round.id])).rows;
  for (const f of results) {
    assert(['HOME', 'DRAW', 'AWAY'].includes(f.result));
    const cmp = Math.sign(f.home_score - f.away_score);
    assert.equal(cmp, f.result === 'HOME' ? 1 : f.result === 'DRAW' ? 0 : -1, 'scoreline agrees with outcome');
  }
  const ticketA = await one('select * from campus_bet_tickets where user_id=$1', [A]);
  const expectCorrect = picksA.filter((p, i) => p === results[i].result).length;
  const table = [0, 0, 0.5, 1, 3, 5];
  assert.equal(ticketA.correct_count, expectCorrect);
  assert.equal(ticketA.payout, Math.floor(100 * table[expectCorrect]));
  assert.equal(await balance(A), 900 + ticketA.payout, 'payout credited');
  const ledgerAfter = (await ledger(A)).length;
  assert.equal(ledgerAfter, ticketA.payout > 0 ? 2 : 1);

  const snapshot = JSON.stringify(results.map((f) => [f.result, f.home_score, f.away_score]));
  for (let i = 0; i < 3; i++) assert.equal((await sync(A, null)).settled ?? 0, 0, 'settlement replay is a no-op');
  assert.equal(Number((await one('select campus_bet_settle_due() n')).n), 0);
  assert.equal(await balance(A), 900 + ticketA.payout, 'no duplicate payout');
  assert.equal((await ledger(A)).length, ledgerAfter, 'no duplicate ledger rows');
  const resultsAgain = (await db.query('select result,home_score,away_score from campus_bet_fixtures where round_id=$1 order by slot', [round.id])).rows;
  assert.equal(JSON.stringify(resultsAgain.map((f) => [f.result, f.home_score, f.away_score])), snapshot, 'refresh never rerolls');
  const viewA = await sync(A, null), viewB = await sync(B, null);
  assert.deepEqual(viewA.last_settled, viewB.last_settled, 'two users see identical results');
  assert.equal(viewA.last_ticket.correct_count, expectCorrect);
  assert.equal(viewA.history.length, 1);
  assert.equal(viewA.history[0].fixtures.length, 5);
  assert.equal(Object.keys(viewA.form).length, 10, 'form for all clubs');

  // ---------- Spec scenario: ₦1,000 → stake ₦100 → 4/5 → ₦1,200 ----------
  await db.query('update wallets set balance=1000 where user_id=$1', [A]);
  const needs = await sync(A, null);
  assert.equal(needs.needs_round, true);
  assert.equal(needs.recent_pairs.length, 5, 'recent pairings returned for repeat avoidance');
  const round2 = (await sync(A, candidate())).current;
  assert.equal(round2.round_number, 2);
  const forced = ['HOME', 'DRAW', 'AWAY', 'HOME', 'AWAY'];
  const scores = { HOME: [2, 1], DRAW: [1, 1], AWAY: [0, 2] };
  for (let i = 0; i < 5; i++) await db.query('update campus_bet_fixtures set result=$1,home_score=$2,away_score=$3 where round_id=$4 and slot=$5', [forced[i], ...scores[forced[i]], round2.id, i + 1]);
  await place(A, round2.id, 100, ['HOME', 'DRAW', 'AWAY', 'HOME', 'HOME']);
  assert.equal(await balance(A), 900);
  await closeCurrent();
  await sync(null, null);
  const t2 = await one('select * from campus_bet_tickets where user_id=$1 and round_id=$2', [A, round2.id]);
  assert.equal(t2.correct_count, 4);
  assert.equal(t2.payout, 300, '4/5 pays 3× stake');
  assert.equal(await balance(A), 1200, '₦900 → ₦1,200');
  const payoutRow = (await ledger(A)).at(-1);
  assert.equal(Number(payoutRow.amount), 300);
  assert.equal(Number(payoutRow.balance_after), 1200);
  assert.match(payoutRow.description, /Campus Bet Matchday 2 — 4\/5 correct/);
  await sync(null, null);
  assert.equal(await balance(A), 1200, 'settlement run again: no additional payout');

  console.log('CAMPUS BET DATABASE PASSED: lazy matchday creation, candidate validation, one matchday per slot, hidden probabilities, atomic stake debit, one ticket per round, input validation, RLS, close/lock, single settlement, consistent scorelines, idempotent payouts, identical results for all users and the ₦1,000→₦1,200 4/5 scenario.');
  await db.close();
})().catch((e) => { console.error(e); process.exit(1); });
