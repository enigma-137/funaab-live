import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useStudentStore } from '../stores/studentStore';
import { useSocialStore } from '../stores/socialStore';
import { normalizeAvatar } from '../config/avatar';
import { colleges, courses, courseById } from '../config/academics';
import {
  eligibleCourses,
  screeningQuestions,
  screenResult,
  simulateUtme,
  type JourneyDraft,
  type JourneyStage,
} from '../config/studentJourney';
import './student.css';
import { networkManager } from '../game/multiplayer/networkManager';
import type { CampusSummary } from '../config/campusSummary';

const AvatarEditor = lazy(() => import('./AvatarEditor'));
const Preview = lazy(() => import('./AvatarEditor').then((m) => ({ default: m.AvatarPreview })));
const AvatarPreview = ({ config }: { config: import('../types/game').AvatarConfig }) => (
  <Suspense fallback={<p>Opening your student…</p>}>
    <Preview config={config} />
  </Suspense>
);
const disclaimer = 'FUNAAB Life simulation — not an official university admission.';
export default function StudentEntry({ onEnter }: { onEnter: () => void }) {
  const user = useAuthStore((s) => s.user)!;
  const { journey, loading, saving, error, load, saveDraft, complete } = useStudentStore();
  const friends = useSocialStore((s) => s.friends);
  const [view, setView] = useState<'home' | 'profile' | 'avatar' | 'friends'>('home');
  const [draft, setDraft] = useState<JourneyDraft>({ stage: 'welcome', courseId: '' });
  const [college, setCollege] = useState(user.college);
  const [avatar, setAvatar] = useState(() => normalizeAvatar(user.avatarConfig));
  const [ready, setReady] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [summary, setSummary] = useState<CampusSummary | null>(null);
  useEffect(() => {
    if (!user.onboardingCompleted) return;
    const controller = new AbortController();
    const refresh = () =>
      networkManager
        .campusSummary(controller.signal)
        .then(setSummary)
        .catch(() => setSummary(null));
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [user.onboardingCompleted]);
  useEffect(() => {
    load(user.id);
  }, [user.id, load]);
  useEffect(() => {
    if (journey && !ready && !loading && useStudentStore.getState().journey === journey) {
      const saved = journey.draft;
      const courseId =
        saved.courseId ||
        user.courseId ||
        courses.find((c) => c.college === user.college)?.id ||
        courses[0].id;
      const allowed: JourneyStage[] = [
        'welcome',
        'profile',
        'application',
        'utme',
        'screening',
        'admission',
        'identity',
        'avatar',
      ];
      let stage = allowed.includes(saved.stage!)
        ? saved.stage!
        : journey.beta_player
          ? 'profile'
          : 'welcome';
      if (['utme', 'screening', 'admission'].includes(stage) && !saved.result)
        stage = 'application';
      setDraft({ stage, courseId, result: saved.result, answers: saved.answers || [] });
      setCollege(courseById(courseId)?.college || user.college);
      setReady(true);
    }
  }, [journey, ready, user, loading]);
  const next = async (stage: JourneyStage, patch: Partial<JourneyDraft> = {}) => {
    const value = { ...draft, ...patch, stage };
    if (stage === 'identity' && !(await useStudentStore.getState().accept(value.courseId))) return;
    if (await saveDraft(value)) {
      setDraft(value);
      document.querySelector('.student-entry')?.scrollTo(0, 0);
    }
  };
  const finish = async () => {
    if (await complete(draft.courseId, avatar, !journey?.beta_player)) setJustCompleted(true);
  };
  const course = courseById(user.onboardingCompleted ? user.courseId : draft.courseId);
  const shell = (content: React.ReactNode) => (
    <main className="student-entry">
      <div className="student-shell">
        <header>
          <a href="#" onClick={(e) => e.preventDefault()} className="student-wordmark">
            FUNAAB <strong>LIFE</strong>
          </a>
          <span>Your campus. Your story.</span>
        </header>
        {content}
        {error && (
          <p role="alert" className="student-error">
            {error}
          </p>
        )}
        <footer>
          <span>A multiplayer campus-life game.</span>
          <button type="button" onClick={() => useAuthStore.getState().logout()}>
            Sign out
          </button>
        </footer>
      </div>
    </main>
  );
  if (loading || !ready || !journey)
    return shell(
      <section className="student-card">
        <h1>Getting your student card ready.</h1>
        {!loading && (
          <button className="student-primary" onClick={() => load(user.id)}>
            Retry student setup
          </button>
        )}
      </section>,
    );
  if (justCompleted)
    return shell(
      <section className="student-card student-welcome">
        <p className="student-kicker">YOUR CAMPUS STORY STARTS NOW</p>
        <h1>You're in.</h1>
        <p>FUNAAB Life. Campus is online.</p>
        <div className="student-id">
          <strong>{user.username}</strong>
          <span>
            {course?.name} · {user.college}
          </span>
          <span>Game matric: {user.gameMatricNumber}</span>
        </div>
        <button className="student-primary" onClick={onEnter}>
          Enter Campus
        </button>
        <p className="student-disclaimer">{disclaimer}</p>
      </section>,
    );
  if (user.onboardingCompleted)
    return shell(
      <section className="student-card">
        {view === 'home' && (
          <>
            <p className="student-kicker">BACK TO CAMPUS LIFE</p>
            <h1>
              Welcome back,
              <br />
              {user.username}.
            </h1>
            <p>Your next class, Keke ride and campus conversation are waiting.</p>
            <div className="student-id">
              <strong>{user.college}</strong>
              <span>{course?.name}</span>
              <span>Game matric: {user.gameMatricNumber}</span>
            </div>
            <p className="student-muted">
              {summary
                ? `${summary.studentsOnline} students online`
                : 'Live campus activity is temporarily unavailable.'}
            </p>
            {summary && summary.popular.length > 0 && (
              <p>Popular now: {summary.popular.map((z) => `${z.name} · ${z.count}`).join(' / ')}</p>
            )}
            <button className="student-primary" onClick={onEnter}>
              Enter Campus
            </button>
            <nav className="student-actions">
              {(['profile', 'avatar', 'friends'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}>
                  {v}
                </button>
              ))}
            </nav>
          </>
        )}
        {view === 'profile' && (
          <>
            <h1>Your student card.</h1>
            <div className="student-avatar-layout">
              <AvatarPreview config={user.avatarConfig} />
              <div className="student-id">
                <strong>@{user.username}</strong>
                <span>{user.college}</span>
                <span>{course?.name}</span>
                <span>Game matric: {user.gameMatricNumber}</span>
                <span>
                  Not on campus yet · {friends.filter((f) => f.status === 'accepted').length}{' '}
                  friends
                </span>
                {journey.orientation_completed && <span>Campus Explorer badge earned</span>}
                <button onClick={() => setView('avatar')}>Edit Avatar</button>
              </div>
            </div>
            <p className="student-disclaimer">{disclaimer}</p>
          </>
        )}
        {view === 'friends' && (
          <>
            <h1>Your campus people.</h1>
            {friends.length ? (
              <ul className="student-friends">
                {friends.map((f) => (
                  <li key={f.id}>
                    <strong>@{f.username}</strong>
                    <span>
                      {f.college} · {f.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Your friends will appear here. Meet students on campus to add them.</p>
            )}
            <button className="student-primary" onClick={onEnter}>
              Find friends on campus
            </button>
          </>
        )}
        {view === 'avatar' && (
          <>
            <h1>Make it your look.</h1>
            <Suspense fallback={<p>Opening wardrobe…</p>}>
              <AvatarEditor value={avatar} onChange={(a) => setAvatar(normalizeAvatar(a))} />
            </Suspense>
            <button
              disabled={saving}
              className="student-primary"
              onClick={async () => {
                if (await complete(user.courseId!, avatar, false)) setView('profile');
              }}
            >
              {saving ? 'Saving…' : 'Save Avatar'}
            </button>
          </>
        )}
        {view !== 'home' && (
          <button className="student-back" onClick={() => setView('home')}>
            Back to home
          </button>
        )}
      </section>,
    );
  const stageIndex = [
    'welcome',
    'profile',
    'application',
    'utme',
    'screening',
    'admission',
    'identity',
    'avatar',
  ].indexOf(draft.stage);
  const admitted =
    !!draft.result &&
    (draft.result.aggregate ?? 0) >= (courseById(draft.courseId)?.gameCutoffRange[0] ?? 0);
  return shell(
    <section className="student-card">
      {draft.stage !== 'welcome' && (
        <p className="student-progress">
          {journey.beta_player
            ? 'COMPLETE YOUR STUDENT PROFILE'
            : `YOUR STORY · ${Math.min(stageIndex, 7)} / 7 · ${draft.stage.toUpperCase()}`}
        </p>
      )}
      {draft.stage === 'welcome' && (
        <div className="student-welcome">
          <p className="student-kicker">WELCOME TO FUNAAB LIFE</p>
          <h1>
            Your campus
            <br />
            story starts here.
          </h1>
          <p>Find your course. Create your student. Meet your people.</p>
          <button className="student-primary" disabled={saving} onClick={() => next('profile')}>
            Begin
          </button>
        </div>
      )}
      {draft.stage === 'profile' && (
        <>
          <h1>{journey.beta_player ? 'Still you. More campus life.' : 'First, your student.'}</h1>
          <p>
            {journey.beta_player
              ? 'Your wallet, friends and progress stay with you. Just choose your course and finish your look.'
              : 'Your signup username is already yours. Choose where your game story begins.'}
          </p>
          <label>
            Display name
            <input value={user.username} readOnly />
          </label>
          <div className="student-fields">
            <label>
              College preference
              <select
                value={college}
                onChange={(e) => {
                  setCollege(e.target.value);
                  setDraft({
                    ...draft,
                    courseId: courses.find((c) => c.college === e.target.value)!.id,
                  });
                }}
              >
                {colleges.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preferred course
              <select
                value={draft.courseId}
                onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}
              >
                {courses
                  .filter((c) => c.college === college)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="student-muted">
            Body presentation and style are yours to choose in the avatar step.
          </p>
          <button
            disabled={saving}
            className="student-primary"
            onClick={() => next(journey.beta_player ? 'identity' : 'application')}
          >
            Continue
          </button>
        </>
      )}
      {draft.stage === 'application' && (
        <>
          <h1>Apply to FUNAAB Life.</h1>
          <div className="student-id">
            <strong>{user.username}</strong>
            <span>{college}</span>
            <span>{course?.name}</span>
          </div>
          <p>No JAMB credentials needed. This is a short fictional game story.</p>
          <button
            disabled={saving}
            className="student-primary"
            onClick={() => next('utme', { result: simulateUtme(draft.courseId), answers: [] })}
          >
            Submit Application
          </button>
          <button className="student-back" disabled={saving} onClick={() => next('profile')}>
            Change preference
          </button>
        </>
      )}
      {draft.stage === 'utme' && draft.result && (
        <>
          <p>Application received.</p>
          <h1>Game UTME result.</h1>
          <div className="student-score">
            {draft.result.utme}
            <small> / 400</small>
          </div>
          <dl className="student-results">
            {draft.result.subjects.map((s) => (
              <div key={s.name}>
                <dt>{s.name}</dt>
                <dd>{s.score}</dd>
              </div>
            ))}
          </dl>
          <p className="student-disclaimer">
            Fictional game result — not an official admission score.
          </p>
          <button disabled={saving} className="student-primary" onClick={() => next('screening')}>
            Try the campus screening
          </button>
        </>
      )}
      {draft.stage === 'screening' && (
        <>
          <h1>A little campus sense.</h1>
          <p>Three quick choices. No timer, no pressure.</p>
          {screeningQuestions.map((q, i) => (
            <fieldset key={q.question} className="student-question">
              <legend>
                {i + 1}. {q.question}
              </legend>
              {q.choices.map((choice, j) => (
                <label key={choice}>
                  <input
                    type="radio"
                    name={`question-${i}`}
                    checked={draft.answers?.[i] === j}
                    onChange={() => {
                      const answers = [...(draft.answers || [])];
                      answers[i] = j;
                      setDraft({ ...draft, answers });
                    }}
                  />
                  {choice}
                </label>
              ))}
            </fieldset>
          ))}
          <button
            className="student-primary"
            disabled={
              saving || !screeningQuestions.every((_, i) => Number.isInteger(draft.answers?.[i]))
            }
            onClick={() =>
              next('admission', { result: screenResult(draft.result!, draft.answers!) })
            }
          >
            See my game offer
          </button>
        </>
      )}
      {draft.stage === 'admission' && (
        <>
          <p className="student-kicker">
            FEDERAL UNIVERSITY OF AGRICULTURE, ABEOKUTA · FUNAAB LIFE
          </p>
          <p className="student-disclaimer">{disclaimer}</p>
          <h1>{admitted ? 'Offer of Game Admission.' : 'A different door is open.'}</h1>
          <p>
            Game UTME: {draft.result?.utme} · Screening: {draft.result?.screening}% · Game
            aggregate: {draft.result?.aggregate}%
          </p>
          {admitted ? (
            <>
              <p>Dear {user.username}, your campus story begins in:</p>
              <div className="student-id">
                <strong>{course?.name}</strong>
                <span>{course?.college}</span>
                <span>Game session 2026/2027</span>
                <span>Your unique game matric is issued when you accept.</span>
              </div>
              <button
                disabled={saving}
                className="student-primary"
                onClick={() => next('identity')}
              >
                Accept Admission
              </button>
            </>
          ) : (
            <>
              <p>
                Your first choice didn't work out. Choose an available course and you're still
                coming to campus.
              </p>
              <label>
                Change Course
                <select
                  value=""
                  onChange={(e) => {
                    const c = courseById(e.target.value)!;
                    setCollege(c.college);
                    next('admission', { courseId: c.id });
                  }}
                >
                  <option value="" disabled>
                    Choose an alternative
                  </option>
                  {eligibleCourses(draft.result?.aggregate || 0).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.college}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <p className="student-muted">
            Game estimate for this course: {course?.gameCutoffRange[0]}% aggregate. These are
            invented game values.
          </p>
        </>
      )}
      {draft.stage === 'identity' && (
        <>
          <h1>Welcome to FUNAAB Life.</h1>
          <div className="student-id">
            <strong>{user.username}</strong>
            <span>
              {course?.college} · {course?.name}
            </span>
            <span>Game matric: {user.gameMatricNumber || 'Issuing your identity…'}</span>
          </div>
          <p>Now create your student.</p>
          <button disabled={saving} className="student-primary" onClick={() => next('avatar')}>
            Create my student
          </button>
        </>
      )}
      {draft.stage === 'avatar' && (
        <>
          <h1>
            Look like you.
            <br />
            Or try someone new.
          </h1>
          <Suspense fallback={<p>Opening wardrobe…</p>}>
            <AvatarEditor value={avatar} onChange={(a) => setAvatar(normalizeAvatar(a))} />
          </Suspense>
          <button disabled={saving} className="student-primary" onClick={finish}>
            {saving ? 'Saving your student…' : 'Save my student'}
          </button>
        </>
      )}
      <p className="student-disclaimer">{disclaimer}</p>
    </section>,
  );
}
