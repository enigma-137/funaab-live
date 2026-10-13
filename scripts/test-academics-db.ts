// Academic career (migration 016): quizzes, exam rules, lazy semester close, promotion,
// carryovers, incompletes, graduation, privacy and drift with src/config/academicCareer.ts.
// Run: PGLITE_MODULE=<path to pglite index.cjs> npm run test:academics:db
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ACADEMICS, GRADE_BANDS, DEGREE_CLASSES, levelFor, gradeFor, degreeClass } from '../src/config/academicCareer';
import { LECTURE_SCHEDULE } from '../src/config/lectureSchedule';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const rows = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as any[];
  const one = async (sql: string, p: unknown[] = []) => (await rows(sql, p))[0];
  const call = async (user: string | null, sql: string, p: unknown[] = []) => {
    await db.exec(user ? `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);` : `set role anon; select set_config('request.jwt.claim.sub','',false);`);
    try { return (await rows(sql, p))[0]; } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);"); }
  };
  const fails = (user: string | null, sql: string, re: RegExp, p: unknown[] = []) => assert.rejects(() => call(user, sql, p), re);
  let n = 0;
  const student = async (name: string) => {
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    await db.query('insert into auth.users values($1)', [id]);
    await db.query("insert into profiles(id,username,college) values($1,$2,'COLENG')", [id, name]);
    return id;
  };
  const answers = async (ids: string[]) => Object.fromEntries((await rows('select id,answer from lecture_questions where id=any($1)', [ids])).map((r) => [r.id, r.answer]));
  const examOpen = (open: boolean) => db.exec(`create or replace function public.academic_exam_open(p_day date) returns boolean language sql immutable as $$ select ${open} $$;`);
  const attend = async (u: string, lecture: string, at = 'now()') =>
    (await one(`insert into lecture_attendance(user_id,lecture_id,duration_seconds,reward_claimed,created_at) values($1,$2,60,100,${at}) returning id`, [u, lecture])).id;

  // ---------- Drift: rules, grade bands, classes, a question bank for every lecture ----------
  assert.equal((await one("select academic_semester(date '2026-01-05') s")).s, 0);
  assert.equal((await one("select academic_semester(date '2026-01-11') s")).s, 0, 'Sunday is still week 0');
  assert.equal((await one("select academic_semester(date '2026-01-12') s")).s, 1);
  assert.equal(ACADEMICS.EPOCH_DAY, '2026-01-05');
  for (const passed of [0, 1, 2, 3, 8, 9, 10, 12]) assert.equal((await one('select academic_level($1) l', [passed])).l, levelFor(passed));
  for (const score of [100, 70, 69.99, 60, 50, 45, 44.9, 40, 39.99, 0]) {
    const g = await one('select * from academic_grade($1)', [score]);
    assert.deepEqual([g.grade, g.grade_point], [gradeFor(score).grade, gradeFor(score).point], `grade ${score}`);
  }
  for (const c of [5, 4.5, 4.49, 3.5, 2.4, 2.39, 1.5, 1, 0]) assert.equal((await one('select academic_class($1) c', [c])).c, degreeClass(c));
  assert.equal(GRADE_BANDS.length, 6); assert.equal(DEGREE_CLASSES.length, 5);
  for (const l of LECTURE_SCHEDULE) {
    const qs = await rows('select options,answer from lecture_questions where lecture_id=$1', [l.id]);
    assert(qs.length >= ACADEMICS.QUIZ_QUESTIONS, `${l.id} has a question bank`);
    for (const q of qs) assert(q.answer < q.options.length, 'answer index in range');
  }

  // ---------- Privacy: questions/answers unreadable; RPCs need sign-in ----------
  const ada = await student('Ada');
  await fails(ada, 'select * from lecture_questions', /permission denied/);
  await fails(null, 'select academic_state() s', /permission denied|Authentication/);
  await fails(ada, "select academic_close('" + ada + "')", /permission denied/);

  // ---------- Fresh student: 100L, semester 1 ----------
  let st = (await call(ada, 'select academic_state() s')).s;
  assert.equal(st.level, 100); assert.equal(st.semester.number, 1); assert.equal(st.semester.lectures, 0); assert.equal(st.cgpa, null);

  // ---------- Quiz after a lecture: 3 questions, no answers, once, within 30 minutes ----------
  await fails(ada, "select lecture_quiz('funaab-phy-201') q", /Attend this lecture first/);
  const att = await attend(ada, 'funaab-phy-201');
  const quiz = (await call(ada, "select lecture_quiz('funaab-phy-201') q")).q;
  assert.equal(quiz.questions.length, 3);
  assert(!JSON.stringify(quiz).includes('"answer"'), 'answers are not sent with the quiz');
  assert.deepEqual((await call(ada, "select lecture_quiz('funaab-phy-201') q")).q, quiz, 'same quiz on reload');
  const ids = quiz.questions.map((q: any) => q.id);
  const right = await answers(ids);
  const graded = (await call(ada, 'select submit_lecture_quiz($1,$2) r', [att, JSON.stringify({ ...right, [ids[2]]: (right[ids[2]] + 1) % 4, extra: 1 })])).r;
  assert.deepEqual([graded.score, graded.total], [2, 3]);
  assert.deepEqual(graded.answers, right, 'answers revealed after submitting');
  await fails(ada, 'select submit_lecture_quiz($1,$2) r', /already taken/, [att, JSON.stringify(right)]);
  const bob = await student('Bob');
  await fails(bob, 'select submit_lecture_quiz($1,$2) r', /Attend this lecture first/, [att, JSON.stringify(right)]);
  const stale = await attend(ada, 'funaab-cyb-201', "now()-interval '31 minutes'");
  await fails(ada, 'select submit_lecture_quiz($1,$2) r', /closed/, [stale, '{}']);
  await fails(ada, "select lecture_quiz('funaab-cyb-201') q", /Attend this lecture first/);

  // ---------- Exam: weekend only, 3+ lectures, 10 questions from attended lectures, once ----------
  await examOpen(false);
  await fails(ada, 'select start_semester_exam() e', /Saturday and Sunday/);
  await examOpen(true);
  await fails(ada, 'select start_semester_exam() e', /at least 3 lectures/, []); // phy + cyb so far = 2
  await attend(ada, 'funaab-cve-201');
  const exam = (await call(ada, 'select start_semester_exam() e')).e;
  assert.equal(exam.questions.length, ACADEMICS.EXAM_QUESTIONS);
  assert(exam.questions.every((q: any) => /^(phy201|cyb201|cve201)-/.test(q.id)), 'only from lectures you attended');
  assert(!JSON.stringify(exam).includes('"answer"'));
  assert.deepEqual((await call(ada, 'select start_semester_exam() e')).e.questions, exam.questions, 'reopening resumes the same paper');
  const examRight = await answers(exam.questions.map((q: any) => q.id));
  const eight = Object.fromEntries(Object.entries(examRight).slice(0, 8));
  assert.deepEqual((await call(ada, 'select submit_semester_exam($1) r', [JSON.stringify(eight)])).r, { score: 8, total: 10 });
  await fails(ada, 'select submit_semester_exam($1) r', /already sat/, [JSON.stringify(examRight)]);
  await fails(ada, 'select start_semester_exam() e', /already sat/);
  // Overtime: nothing counts after 10 minutes + 30 s.
  const late = await student('Late');
  for (const l of ['funaab-phy-201', 'funaab-cyb-201', 'funaab-cve-201']) await attend(late, l);
  await call(late, 'select start_semester_exam() e');
  await db.query("update exam_attempts set started_at=now()-interval '11 minutes' where user_id=$1", [late]);
  const lateRight = await answers((await one('select questions from exam_attempts where user_id=$1', [late])).questions);
  assert.equal((await call(late, 'select submit_semester_exam($1) r', [JSON.stringify(lateRight)])).r.score, 0, 'late answers are void');

  // ---------- Lazy semester close: pass, carryover, incomplete, promotion ----------
  // Move Ada's whole current week into the past by pretending she enrolled 1 week earlier and
  // shifting her rows back 7 days.
  const shift = async (u: string, days: number) => {
    await db.query(`update lecture_attendance set created_at=created_at-interval '${days} days' where user_id=$1`, [u]);
    await db.query(`update quiz_attempts set created_at=created_at-interval '${days} days' where user_id=$1`, [u]);
    await db.query(`update exam_attempts set semester=semester-${days / 7},started_at=started_at-interval '${days} days',submitted_at=submitted_at-interval '${days} days' where user_id=$1`, [u]);
    await db.query(`update academic_records set start_semester=start_semester-${days / 7} where user_id=$1`, [u]);
    await db.query(`update semester_results set semester=semester-${days / 7} where user_id=$1`, [u]);
  };
  await shift(ada, 7);
  st = (await call(ada, 'select academic_state() s')).s;
  const r1 = st.results[0];
  // Coursework: quizzes 2/3 = 66.67%. Exam 8/10 = 80%. Score = 0.4·66.67 + 0.6·80 = 74.67 → A.
  assert.equal(r1.status, 'passed'); assert.equal(r1.grade, 'A'); assert.equal(Number(r1.score), 74.67); assert.equal(r1.lectures, 3);
  assert.equal(st.semesters_passed, 1); assert.equal(st.level, 100, 'one pass is still 100L'); assert.equal(Number(st.cgpa), 5);
  assert.equal(st.semester.number, 2);
  assert.equal((await call(ada, 'select academic_state() s')).s.results.length, 1, 'closing is idempotent');

  // A week with no exam is incomplete: no promotion, CGPA unchanged.
  await shift(ada, 7);
  st = (await call(ada, 'select academic_state() s')).s;
  assert.equal(st.results[0].status, 'incomplete'); assert.equal(st.semesters_passed, 1); assert.equal(Number(st.cgpa), 5);

  // A failed exam is a carryover: counts in CGPA, no promotion, never expelled.
  for (const l of ['funaab-phy-201', 'funaab-cyb-201', 'funaab-cve-201']) await attend(ada, l);
  await call(ada, 'select start_semester_exam() e');
  await call(ada, 'select submit_semester_exam($1) r', ['{}']);
  await shift(ada, 7);
  st = (await call(ada, 'select academic_state() s')).s;
  assert.equal(st.results[0].status, 'failed'); assert.equal(st.results[0].grade, 'F');
  assert.equal(st.semesters_passed, 1); assert.equal(Number(st.cgpa), 2.5, '(5 + 0) / 2');

  // Second pass → 200L.
  for (const l of ['funaab-phy-201', 'funaab-cyb-201', 'funaab-cve-201']) await attend(ada, l);
  await call(ada, 'select start_semester_exam() e');
  await call(ada, 'select submit_semester_exam($1) r', [JSON.stringify(await answers((await one('select questions from exam_attempts where user_id=$1 and semester=academic_semester(lagos_today())', [ada])).questions))]);
  await shift(ada, 7);
  st = (await call(ada, 'select academic_state() s')).s;
  assert.equal(st.results[0].status, 'passed'); assert.equal(st.semesters_passed, 2); assert.equal(st.level, 200);

  // ---------- Graduation after 10 passes, with a class of degree ----------
  const grad = await student('Grad');
  await call(grad, 'select academic_state() s');
  const sem = Number((await one('select academic_semester(lagos_today()) s')).s);
  await db.query('update academic_records set start_semester=$2,semesters_passed=9 where user_id=$1', [grad, sem - 10]);
  for (let s = sem - 10; s < sem - 1; s++)
    await db.query("insert into semester_results(user_id,semester,lectures,coursework,exam,score,grade,grade_point,status,level) values($1,$2,3,80,80,80,'A',5,'passed',100)", [grad, s]);
  await db.query(`insert into lecture_attendance(user_id,lecture_id,duration_seconds,reward_claimed,created_at) select $1,l,60,100,academic_semester_from($2)+interval '1 day' from unnest(array['funaab-phy-201','funaab-cyb-201','funaab-cve-201']) l`, [grad, sem - 1]);
  // Final semester: no quizzes (coursework 0) but a perfect exam → 0.6 × 100 = 60 → B (4 points).
  await db.query("insert into exam_attempts(user_id,semester,questions,started_at,submitted_at,answers,score,total) values($1,$2,'{}',now()-interval '3 days',now()-interval '3 days','{}',10,10)", [grad, sem - 1]);
  st = (await call(grad, 'select academic_state() s')).s;
  assert.equal(st.results[0].grade, 'B'); assert.equal(Number(st.results[0].score), 60);
  assert.equal(st.graduated, true); assert.equal(st.semesters_passed, ACADEMICS.SEMESTERS_TO_GRADUATE); assert.equal(st.level, 500);
  assert.equal(Number(st.cgpa), 4.9, '(9 × 5 + 4) / 10'); assert.equal(st.class_of_degree, 'First Class');
  await fails(grad, 'select start_semester_exam() e', /graduated/);
  const before = (await call(grad, 'select academic_state() s')).s;
  assert.equal(before.results.length, 10, 'no more semesters are added after graduation');

  // ---------- What other students see ----------
  const stranger = (await call(bob, 'select academic_public($1) p', [grad])).p;
  assert.deepEqual(stranger, { level: 500, graduated: true, class_of_degree: 'First Class', cgpa: null }, 'CGPA hidden from non-friends');
  await db.query("insert into friends(user_id,friend_id,status) values($1,$2,'accepted')", [grad, bob]);
  assert.equal(Number((await call(bob, 'select academic_public($1) p', [grad])).p.cgpa), 4.9, 'friends see CGPA');
  console.log('ACADEMICS DB PASSED: drift, question privacy, quiz once/30 min, exam weekend/3 lectures/10 q/once/time limit, lazy close, pass/carryover/incomplete, 200L promotion, graduation + class, public view');
}
main().catch((e) => { console.error(e); process.exit(1); });
