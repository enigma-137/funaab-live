// Academic career UI on phones: record sheet, post-lecture quiz, weekend exam, level in the status strip.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openStudent, phonesUnderTest } from './browserHarness';

const out = path.resolve(process.env.STUDENT_TEST_OUTPUT || 'test-results/academics', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const TOLU = { id: '00000000-0000-4000-8000-0000000000c7', username: 'Tolu', college: 'COLPHYS' };
const q = (id: string, question: string, options: string[]) => ({ id, question, options });

(async () => {
  const browser = await launch();
  try {
    for (const [width, height] of phonesUnderTest()) {
      const errors: string[] = [];
      const calls: Array<{ name: string; body: any }> = [];
      let examSubmitted = false;
      const state = () => ({
        level: 200, semesters_passed: 2, cgpa: 4.25, graduated: false, class_of_degree: null,
        semester: { number: 3, ends_at: new Date(Date.now() + 86400000).toISOString(), exam_open: true, exam_opens_at: new Date(Date.now() - 3600000).toISOString(),
          lectures: 3, lectures_needed: 3, coursework: 66.67, quizzes: 2, exam: examSubmitted ? { started_at: new Date().toISOString(), submitted: true, score: 8, total: 10 } : null },
        results: [
          { semester: 2, level: 100, lectures: 4, coursework: 80, exam: 70, score: 74, grade: 'A', grade_point: 5, status: 'passed' },
          { semester: 1, level: 100, lectures: 3, coursework: 50, exam: 40, score: 44, grade: 'E', grade_point: 1, status: 'passed' },
        ],
      });
      const examQs = Array.from({ length: 10 }, (_, i) => q(`phy201-${(i % 4) + 1}-${i}`, `Exam question ${i + 1}?`, ['A', 'B', 'C', 'D']));
      const supabase = {
        academic_state: () => state(),
        lecture_quiz: (b: any) => ({ attendance_id: 'att-1', lecture_id: b.p_lecture, questions: [
          q('phy201-1', "Newton's second law: force equals the rate of change of…", ['Velocity', 'Momentum', 'Energy', 'Mass']),
          q('phy201-2', 'Momentum p equals…', ['m·a', 'm·v', '½mv²', 'F·t²']),
          q('phy201-3', 'With no external force in a collision, total momentum is…', ['Lost as heat', 'Conserved', 'Doubled', 'Zero']),
        ] }),
        submit_lecture_quiz: (b: any) => { calls.push({ name: 'quiz', body: b }); return { score: 2, total: 3, answers: { 'phy201-1': 1, 'phy201-2': 1, 'phy201-3': 1 } }; },
        start_semester_exam: () => ({ started_at: new Date().toISOString(), ends_at: new Date(Date.now() + 600000).toISOString(), questions: examQs }),
        submit_semester_exam: (b: any) => { calls.push({ name: 'exam', body: b }); examSubmitted = true; return { score: 8, total: 10 }; },
      };
      const { context, page } = await openStudent(browser, TOLU, { width, height, errors, supabase });
      try {
        // Level badge in the status strip.
        const strip = page.getByRole('status', { name: 'Your day' });
        await page.waitForFunction(() => document.querySelector('.campus-status-level')?.textContent === '200L');

        // Quiz offered after a lecture: 3 questions, Submit only when all answered, answers revealed.
        await page.evaluate(async () => (await import('/src/stores/academicStore.ts' as any)).useAcademicStore.getState().offerQuiz('funaab-phy-201'));
        const quiz = page.getByRole('dialog', { name: 'Quick quiz' });
        await quiz.waitFor();
        await page.waitForTimeout(400); // let the slide-up animation finish
        const qb = await quiz.boundingBox();
        assert(qb.width <= width - 12 && qb.height <= height * 0.9 && qb.y + qb.height <= height, `quiz fits the phone (${JSON.stringify(qb)})`);
        const submit = quiz.getByRole('button', { name: 'Submit' });
        assert(await submit.isDisabled(), 'cannot submit half a quiz');
        for (const [i, choice] of [[1, 'Momentum'], [2, 'm·v'], [3, 'Doubled']] as const)
          await quiz.getByRole('radiogroup', { name: `Question ${i}`, exact: true }).getByRole('radio', { name: choice }).click();
        await page.screenshot({ path: path.join(out, `academics-${width}-quiz.png`) });
        await submit.click();
        await quiz.getByText('2/3 correct').waitFor();
        assert.deepEqual(calls[0].body, { p_attendance: 'att-1', p_answers: { 'phy201-1': 1, 'phy201-2': 1, 'phy201-3': 2 } }, 'only option indexes are sent');
        assert.equal(await quiz.locator('button.is-wrong').count(), 1);
        assert.equal(await quiz.locator('button.is-correct').count(), 3);
        await quiz.getByRole('button', { name: 'Done' }).click();

        // Record sheet: level, CGPA, semester checklist, results, exam button.
        const record = page.getByRole('dialog', { name: 'Academic Record' });
        await record.waitFor();
        assert.match(await record.innerText(), /200L · CGPA 4\.25/);
        assert.match(await record.innerText(), /Lectures attended: 3\/3/);
        assert.match(await record.innerText(), /Sem 2 · 100L/);
        await page.screenshot({ path: path.join(out, `academics-${width}-record.png`) });
        await record.getByRole('button', { name: 'Start exam (10 min)' }).click();
        const exam = page.getByRole('dialog', { name: 'Semester exam' });
        await exam.waitFor();
        assert.match(await exam.innerText(), /⏱ (9|10):\d\d · 0\/10/);
        for (let i = 1; i <= 10; i++) await exam.getByRole('radiogroup', { name: `Question ${i}`, exact: true }).getByRole('radio', { name: 'B' }).click();
        const footer = await exam.getByRole('button', { name: 'Submit' }).boundingBox();
        assert(footer.y + footer.height <= height, 'Submit stays reachable while scrolling a long paper');
        await page.screenshot({ path: path.join(out, `academics-${width}-exam.png`) });
        await exam.getByRole('button', { name: 'Submit' }).click();
        await exam.getByText('Submitted: 8/10').waitFor();
        assert.equal(Object.keys(calls[1].body.p_answers).length, 10);
        await exam.getByRole('button', { name: 'Back to record' }).click();
        await record.getByText(/Exam: 8\/10/).waitFor();
        await page.keyboard.press('Escape');
        await record.waitFor({ state: 'hidden' });
        void strip;
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        console.log(`ACADEMICS BROWSER PASSED ${width}x${height}`);
      } catch (e) {
        await page.screenshot({ path: path.join(out, `failure-${width}.png`) }).catch(() => {});
        throw e;
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
