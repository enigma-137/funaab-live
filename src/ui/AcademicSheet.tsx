import React, { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { levelLabel, useAcademicStore, type Question } from '../stores/academicStore';
import { ACADEMICS } from '../config/academicCareer';
import { LECTURE_SCHEDULE } from '../config/lectureSchedule';

const pct = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(Number(n))}%`);
const until = (iso: string, now: number) => {
  const ms = Math.max(0, Date.parse(iso) - now), h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${Math.floor(ms / 60000) % 60}m` : `${Math.ceil(ms / 60000)}m`;
};

function Questions({ questions }: { questions: Question[] }) {
  const { answers, revealed, pick, result } = useAcademicStore();
  return (
    <ol className="academic-questions">
      {questions.map((q, i) => (
        <li key={q.id}>
          <p><b>{i + 1}.</b> {q.question}</p>
          <div role="radiogroup" aria-label={`Question ${i + 1}`}>
            {q.options.map((o, k) => {
              const chosen = answers[q.id] === k, correct = revealed?.[q.id] === k;
              return (
                <button key={k} role="radio" aria-checked={chosen} disabled={!!result}
                  className={`${chosen ? 'is-chosen' : ''} ${revealed ? (correct ? 'is-correct' : chosen ? 'is-wrong' : '') : ''}`}
                  onClick={() => pick(q.id, k)}>{o}</button>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AcademicSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { state, view, quiz, exam, answers, result, busy, error, startExam, submit, back, load } = useAcademicStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { void load(); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const close = () => { back(); setModal(null); };

  if (view === 'quiz' && quiz) {
    const lecture = LECTURE_SCHEDULE.find((l) => l.id === quiz.lecture_id);
    const all = quiz.questions.every((q) => answers[q.id] !== undefined);
    return (
      <Sheet title="Quick quiz" subtitle={`${lecture?.courseCode ?? 'Lecture'} · counts toward coursework`} icon="📝" accent="#7c3aed" onClose={close} closeOnBackdrop={false}
        footer={result
          ? <div className="academic-footer"><b>{result.score}/{result.total} correct</b><button className="academic-primary" onClick={back}>Done</button></div>
          : <div className="academic-footer"><span>{Object.keys(answers).length}/{quiz.questions.length} answered</span><button className="academic-primary" disabled={!all || busy} onClick={submit}>Submit</button></div>}>
        <div className="academic-body">
          <p className="academic-note">What did the lecturer just teach? One try, no time limit (closes 30 min after class).</p>
          <Questions questions={quiz.questions} />
          {error && <p className="academic-error" role="alert">{error}</p>}
        </div>
      </Sheet>
    );
  }

  if (view === 'exam' && exam) {
    const left = Math.max(0, Date.parse(exam.ends_at) - now);
    const answered = Object.keys(answers).length;
    return (
      <Sheet title="Semester exam" subtitle={`${exam.questions.length} questions · ${ACADEMICS.EXAM_MINUTES} minutes`} icon="🖊️" accent="#dc2626" onClose={close} closeOnBackdrop={false}
        footer={result
          ? <div className="academic-footer"><b>Submitted: {result.score}/{result.total}</b><button className="academic-primary" onClick={back}>Back to record</button></div>
          : <div className="academic-footer"><span className={left < 60000 ? 'academic-urgent' : ''}>⏱ {Math.floor(left / 60000)}:{String(Math.floor(left / 1000) % 60).padStart(2, '0')} · {answered}/{exam.questions.length}</span>
              <button className="academic-primary" disabled={busy} onClick={() => { if (answered === exam.questions.length || window.confirm('Submit with unanswered questions?')) void submit(); }}>Submit</button></div>}>
        <div className="academic-body">
          <p className="academic-note">Questions come from the lectures you attended this semester. Closing this keeps your paper open until time runs out.</p>
          <Questions questions={exam.questions} />
          {error && <p className="academic-error" role="alert">{error}</p>}
        </div>
      </Sheet>
    );
  }

  const s = state;
  const sem = s?.semester;
  const eligible = !!sem && sem.lectures >= sem.lectures_needed;
  const examDone = !!sem?.exam?.submitted;
  return (
    <Sheet title="Academic Record" subtitle={s ? `${levelLabel(s)} · CGPA ${s.cgpa != null ? Number(s.cgpa).toFixed(2) : '—'}${s.graduated ? ` · ${s.class_of_degree}` : ''}` : 'Loading…'} icon="🎓" accent="#2563eb" onClose={close}>
      {!s ? <p className="academic-body academic-note">Loading your record…</p> : (
        <div className="academic-body">
          <section className="academic-progress" aria-label="Progress to graduation">
            <div className="academic-progress-head"><b>{s.graduated ? 'Graduated 🎓' : `${s.level} Level`}</b><span>{s.semesters_passed}/{ACADEMICS.SEMESTERS_TO_GRADUATE} semesters passed</span></div>
            <div className="academic-bar"><i style={{ width: `${(s.semesters_passed / ACADEMICS.SEMESTERS_TO_GRADUATE) * 100}%` }} /></div>
            {s.graduated && <p className="academic-note">Congratulations, graduate! You finished with <b>{s.class_of_degree}</b>.</p>}
          </section>

          {!s.graduated && sem && (
            <section className="academic-card">
              <h3>Semester {sem.number} <small>ends in {until(sem.ends_at, now)}</small></h3>
              <ul className="academic-checks">
                <li className={eligible ? 'is-done' : ''}>🎓 Lectures attended: <b>{sem.lectures}/{sem.lectures_needed}</b> needed</li>
                <li>📝 Quizzes: <b>{sem.quizzes}</b> · coursework <b>{pct(sem.coursework)}</b></li>
                <li className={examDone ? 'is-done' : ''}>🖊️ Exam: <b>{examDone ? `${sem.exam!.score}/${sem.exam!.total}` : sem.exam_open ? 'open now' : `opens in ${until(sem.exam_opens_at, now)}`}</b></li>
              </ul>
              {!examDone && sem.exam_open && (
                <button className="academic-primary academic-wide" disabled={busy || !eligible} onClick={startExam}>
                  {sem.exam ? 'Continue exam' : eligible ? 'Start exam (10 min)' : `Attend ${sem.lectures_needed - sem.lectures} more lecture${sem.lectures_needed - sem.lectures === 1 ? '' : 's'} first`}
                </button>
              )}
              {error && <p className="academic-error" role="alert">{error}</p>}
            </section>
          )}

          {s.results.length > 0 && (
            <section>
              <h3 className="academic-h">Results</h3>
              <ul className="academic-results">
                {s.results.map((r) => (
                  <li key={r.semester} className={`is-${r.status}`}>
                    <span>Sem {r.semester} · {r.level}L</span>
                    <span>{r.status === 'incomplete' ? 'Incomplete' : `${r.grade} · ${Math.round(Number(r.score))}%`}</span>
                    <span>{r.status === 'passed' ? '✅' : r.status === 'failed' ? 'Carryover' : '—'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="academic-how">
            <summary>How it works</summary>
            <p>Each semester is one week (Mon–Sun). Attend lectures (at least {ACADEMICS.LECTURES_NEEDED}) and take the quick quiz after each one. Sit the {ACADEMICS.EXAM_MINUTES}-minute exam on Saturday or Sunday.</p>
            <p>Score = {ACADEMICS.COURSEWORK_WEIGHT * 100}% quizzes + {ACADEMICS.EXAM_WEIGHT * 100}% exam. {ACADEMICS.PASS_MARK}+ passes. Two passed semesters move you up a level; {ACADEMICS.SEMESTERS_TO_GRADUATE} to graduate. A fail is a carryover, and missing the exam just doesn't count. Nobody gets expelled.</p>
          </details>
        </div>
      )}
    </Sheet>
  );
}
