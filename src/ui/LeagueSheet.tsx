import React, { useEffect } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useLeagueStore } from '../stores/leagueStore';
import { LEAGUE, LEAGUE_SOURCES } from '../config/collegeLeague';

const until = (iso: string) => {
  const ms = Math.max(0, Date.parse(iso) - Date.now()), h = Math.floor(ms / 3600000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor(ms / 60000) % 60}m`;
};

/** This week's College League table: your college, your points, and how to earn more. */
export function LeagueSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { state, load } = useLeagueStore();
  useEffect(() => { void load(); }, []);
  const s = state;
  let rank = 0;
  return (
    <Sheet title="College League" subtitle={s ? `This week ends in ${until(s.week_ends_at)}` : 'Weekly college rivalry'} icon="🏆" accent="#ca8a04" onClose={() => setModal(null)}>
      <div className="academic-body">
        {!s ? <p className="academic-note">Loading the table…</p> : (
          <>
            {s.last_champion && <p className="league-champ">🏆 Last week’s champions: <b>{s.last_champion}</b></p>}
            <section className="hustle-card">
              <h3>Your contribution <small>{s.my_college}</small></h3>
              <div className="academic-progress-head"><b>{s.my_points} pts</b><span>weekly cap {s.cap}</span></div>
              <div className="academic-bar"><i style={{ width: `${Math.min(100, (s.my_points / s.cap) * 100)}%` }} /></div>
            </section>
            <ol className="league-table" aria-label="College standings">
              {s.table.length === 0 && <li className="academic-note">No points yet this week. Be the first!</li>}
              {s.table.map((r) => (
                <li key={r.college} className={`${r.college === s.my_college ? 'is-mine' : ''} ${r.ranked ? '' : 'is-unranked'}`}>
                  <span className="league-rank">{r.ranked ? `#${++rank}` : '—'}</span>
                  <b>{r.college}</b>
                  <span>{Number(r.average).toFixed(1)} avg</span>
                  <small>{r.active} active · {r.total} pts</small>
                </li>
              ))}
            </ol>
            <details className="academic-how" open>
              <summary>How your college scores</summary>
              <ul className="league-sources">
                {LEAGUE_SOURCES.map((x) => <li key={x.key}>{x.icon} {x.label} <b>+{LEAGUE.POINTS[x.key]}</b></li>)}
              </ul>
              <p>Colleges are ranked by average points per active student, so small colleges can win. Each student counts up to {LEAGUE.STUDENT_WEEKLY_CAP} points; a college needs {LEAGUE.MIN_ACTIVE}+ active students to rank. The winner’s banner flies at the main gate all next week.</p>
            </details>
          </>
        )}
      </div>
    </Sheet>
  );
}
