import React, { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { useSugStore, type SugCandidate } from '../stores/sugStore';
import { SUG, SUG_PHASE_LABEL, sugPhaseEndsAt, sugTextProblem } from '../config/sug';

const until = (ms: number) => {
  const left = Math.max(0, ms - Date.now()), h = Math.floor(left / 3600000), d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${h % 24}h` : `${h}h ${Math.floor(left / 60000) % 60}m`;
};

function Candidate({ c, me, mine, onVote, canVote, showVotes, top }: {
  c: SugCandidate; me?: string; mine: boolean; onVote?: () => void; canVote: boolean; showVotes: boolean; top: boolean;
}) {
  return (
    <li className={`sug-candidate${mine ? ' is-mine' : ''}${top ? ' is-top' : ''}`}>
      <div>
        <b>{top && showVotes ? '👑 ' : ''}@{c.username}</b> <small>{c.college} · Lv {c.level}{c.user_id === me ? ' · you' : ''}</small>
        <p>“{c.manifesto}”</p>
      </div>
      {showVotes ? <span className="sug-votes">{Number(c.votes ?? 0)} vote{Number(c.votes) === 1 ? '' : 's'}</span>
        : onVote && <button className={mine ? 'academic-primary' : 'hustle-btn'} disabled={!canVote || mine} onClick={onVote}>{mine ? '✓ Your vote' : 'Vote'}</button>}
    </li>
  );
}

/** SUG elections: who's running, your vote, last week's results and the President's corner. */
export function SugSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const me = useAuthStore((s) => s.user?.id);
  const { state: s, busy, error, run, load } = useSugStore();
  const [manifesto, setManifesto] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { void load(); }, [load]);
  const problem = manifesto ? sugTextProblem(manifesto, SUG.MANIFESTO_MAX) : null;
  const noteProblem = note ? sugTextProblem(note, SUG.ANNOUNCEMENT_MAX) : null;
  if (!s) return <Sheet title="SUG Elections" icon="🗳️" accent="#0ea5e9" onClose={() => setModal(null)}><p className="academic-body academic-note">Loading the ballot…</p></Sheet>;
  const results = s.phase === 'results';
  const maxVotes = Math.max(0, ...s.candidates.map((c) => Number(c.votes ?? 0)));
  const lastMax = Math.max(0, ...(s.last_results ?? []).map((c) => Number(c.votes ?? 0)));
  return (
    <Sheet title="SUG Elections" subtitle={`${SUG_PHASE_LABEL[s.phase]} · ${results ? 'new week starts in' : 'closes in'} ${until(sugPhaseEndsAt(Date.now()))}`} icon="🗳️" accent="#0ea5e9" onClose={() => setModal(null)}>
      <div className="academic-body">
        <section className="academic-card">
          <h3>👑 SUG President</h3>
          {s.president ? <p className="academic-note"><b>@{s.president.username}</b> ({s.president.college}) leads campus this week.</p>
            : <p className="academic-note">The office is vacant. Win this week's vote to become President!</p>}
          {s.announcement && <p className="sug-announcement">📢 “{s.announcement.body}” — @{s.announcement.username}</p>}
          {s.can_announce && (
            <div className="sug-compose">
              <textarea maxLength={SUG.ANNOUNCEMENT_MAX} rows={2} placeholder="Make today's campus-wide announcement…" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="academic-primary" disabled={busy || !note || !!noteProblem} onClick={async () => { if (await run('sug_announce', { p_body: note }, 'Announcement posted for everyone on campus')) setNote(''); }}>Announce</button>
              {noteProblem && <small className="academic-error">{noteProblem}</small>}
            </div>
          )}
        </section>

        <section>
          <h3 className="academic-h">{results ? "This week's results" : `On the ballot (${s.candidates.length})`}</h3>
          {s.candidates.length === 0 ? <p className="academic-note">{s.phase === 'nominations' ? 'Nobody has declared yet. Be the first!' : 'Nobody ran this week.'}</p> : (
            <ul className="sug-list">
              {s.candidates.map((c) => (
                <Candidate key={c.user_id} c={c} me={me} mine={s.my_vote === c.user_id} showVotes={results} top={results && Number(c.votes) === maxVotes && maxVotes > 0}
                  canVote={s.phase === 'voting' && !busy && s.my_level >= SUG.MIN_LEVEL_TO_VOTE}
                  onVote={s.phase === 'voting' ? () => void run('sug_vote', { p_candidate: c.user_id }, `You voted for @${c.username}`) : undefined} />
              ))}
            </ul>
          )}
          {s.phase === 'voting' && s.my_level < SUG.MIN_LEVEL_TO_VOTE && <p className="academic-note">Reach Level {SUG.MIN_LEVEL_TO_VOTE} to vote (you're Level {s.my_level}).</p>}
          {s.phase === 'voting' && s.my_vote && <p className="academic-note">You can change your vote until the polls close on Saturday night. Results are counted on Sunday.</p>}
        </section>

        {s.phase === 'nominations' && (
          <section className="academic-card">
            <h3>Run for SUG President</h3>
            {s.am_candidate ? (
              <>
                <p className="academic-note">✅ You're on the ballot. Campaign! Voting opens on Thursday.</p>
                <button className="hustle-btn hustle-wide" disabled={busy} onClick={() => void run('sug_withdraw', undefined, 'You withdrew from the race')}>Withdraw</button>
              </>
            ) : s.my_level < SUG.MIN_LEVEL_TO_RUN ? (
              <p className="academic-note">Reach Level {SUG.MIN_LEVEL_TO_RUN} to run (you're Level {s.my_level}). Jobs, hustles and games all earn XP.</p>
            ) : (
              <>
                <textarea className="sug-manifesto" maxLength={SUG.MANIFESTO_MAX} rows={3} placeholder="Your manifesto: what will you do for students?" value={manifesto} onChange={(e) => setManifesto(e.target.value)} />
                {problem && <small className="academic-error">{problem}</small>}
                <button className="academic-primary academic-wide" disabled={busy || !manifesto || !!problem} onClick={() => void run('sug_nominate', { p_manifesto: manifesto }, "You're on the ballot!")}>
                  Declare candidacy · ₦{SUG.NOMINATION_FEE.toLocaleString()}
                </button>
              </>
            )}
          </section>
        )}

        {!results && s.last_results && s.last_results.length > 0 && (
          <details className="academic-how">
            <summary>Last week's results</summary>
            <ul className="sug-list">
              {s.last_results.map((c) => <Candidate key={c.user_id} c={c} me={me} mine={false} canVote={false} showVotes top={Number(c.votes) === lastMax && lastMax > 0} />)}
            </ul>
          </details>
        )}
        <details className="academic-how">
          <summary>How elections work</summary>
          <p>Every week: nominations Monday–Wednesday (Level {SUG.MIN_LEVEL_TO_RUN}+, ₦{SUG.NOMINATION_FEE.toLocaleString()} fee), voting Thursday–Saturday (Level {SUG.MIN_LEVEL_TO_VOTE}+, one vote), results on Sunday. The winner is SUG President for the next week, wears a 👑 badge and can make one campus-wide announcement a day. A tie goes to whoever declared first.</p>
        </details>
        {error && <p className="academic-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}

/** The President's announcement, shown once to everyone on campus until dismissed. */
export function SugBanner() {
  const a = useSugStore((s) => s.state?.announcement);
  const key = a ? `funaab:sug-seen:${a.created_at}` : '';
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    void useSugStore.getState().load();
    const t = setInterval(() => void useSugStore.getState().load(), 300000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { try { setHidden(!!key && localStorage.getItem(key) === '1'); } catch { setHidden(false); } }, [key]);
  if (!a || hidden) return null;
  return (
    <div className="sug-banner" role="status">
      <span>📢 <b>SUG President @{a.username}:</b> {a.body}</span>
      <button aria-label="Dismiss announcement" onClick={() => { try { localStorage.setItem(key, '1'); } catch { /* private mode */ } setHidden(true); }}>✕</button>
    </div>
  );
}
