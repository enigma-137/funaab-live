import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../stores/gameStore';
import { isMyMove, mySeat, useRallyStore } from '../stores/rallyStore';
import { RALLY_RULES, timingAt, type PointReason, type RallyPlayer, type RallyState, type Team } from '../config/volleyRally';
import { VOLLEYBALL_RULES } from '../config/volleyball';
import { ShotControls } from './FootballPanel';
import './football.css';

const REASON: Record<PointReason, string> = {
  ace: 'Ace!', kill: 'Kill!', net: 'Into the net', out: 'Out', drop: 'Ball dropped', timeout: 'Serve clock ran out', error: 'Handling error',
};
const SERVE_SWEET: [number, number] = [VOLLEYBALL_RULES.IN_POWER[0] * 100, (VOLLEYBALL_RULES.IN_POWER[1] - VOLLEYBALL_RULES.IN_POWER[0]) * 100];
const SERVE_PAD = <><div className="vb-court" aria-hidden /><div className="vb-net" aria-hidden /></>;

/** Re-render every animation frame while `active` (timing bar, countdowns). */
function useFrameNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return now;
}

const name = (p: RallyPlayer | undefined, mine: boolean) => (!p ? 'Open' : mine ? 'You' : p.bot ? 'CPU' : `@${p.name}`);

function TeamCard({ s, team, me }: { s: RallyState; team: Team; me: string | null }) {
  const serving = s.status === 'ACTIVE' && s.servingTeam === team;
  return (
    <div className={`vr-team vr-team-${team.toLowerCase()}${me === team ? ' is-mine' : ''}`}>
      <div className="vr-team-head">
        <span>Team {team}{serving ? ' 🏐' : ''}</span>
        {s.status !== 'FORMING' && s.status !== 'LOBBY' && <b>{s.score[team]}</b>}
      </div>
      {Array.from({ length: RALLY_RULES.TEAM_SIZE }, (_, i) => {
        const p = s.teams[team][i];
        const mine = me === team && mySeat(s)?.slot === i;
        const toMove = s.pending?.team === team && s.pending.slot === i && s.status === 'ACTIVE';
        return <span key={i} className={`vr-player${p ? '' : ' is-open'}${toMove ? ' is-turn' : ''}`}>{name(p, mine)}</span>;
      })}
    </div>
  );
}

/** Timing bar for a touch: the marker sweeps; tap as it crosses the white band (when the ball arrives). */
function TouchControls({ s, barStart, now, onTouch, disabled }: { s: RallyState; barStart: number; now: number; onTouch: (action: 'pass' | 'attack', timing: number) => void; disabled: boolean }) {
  const p = s.pending!;
  const u = (now - barStart) / RALLY_RULES.BAR_MS;
  const live = u >= 0 && u <= 1.15 && !disabled;
  const mate = s.teams[p.team][1 - p.slot];
  const fire = (action: 'pass' | 'attack') => { if (live) onTouch(action, timingAt(Math.max(0, u))); };
  // Desktop: Space = pass (or spike on the third touch), Enter = send it over.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); fire(p.touch >= 3 ? 'attack' : 'pass'); }
      if (e.key === 'Enter') { e.preventDefault(); fire('attack'); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const sweetLeft = (RALLY_RULES.BAR_SWEET - 0.1) * 100;
  return (
    <div className="vr-touch">
      <div className="vr-bar" aria-hidden>
        <b style={{ left: `${sweetLeft}%`, width: '20%' }} />
        <i style={{ left: `${Math.min(100, Math.max(0, u * 100))}%`, opacity: u < 0 ? 0.3 : 1 }} />
      </div>
      <p className="fb-note" role="status">{u < 0 ? 'Ball coming to you… get ready' : u > 1.15 ? 'Too slow…' : 'Tap as the marker hits the white band!'}</p>
      <div className="fb-row">
        {p.touch < 3 && (
          <button className="fb-btn fb-primary" disabled={!live} onClick={() => fire('pass')}>
            {p.touch === 1 ? 'Bump' : 'Set'} to {mate?.bot ? 'CPU' : `@${mate?.name ?? 'mate'}`}
          </button>
        )}
        <button className={`fb-btn${p.touch >= 3 ? ' fb-primary vr-spike' : ''}`} disabled={!live} onClick={() => fire('attack')}>
          {p.touch >= 3 ? 'SPIKE!' : 'Send it over'}
        </button>
      </div>
    </div>
  );
}

export const RallyPanel: React.FC = () => {
  const setActiveModal = useGameStore((g) => g.setActiveModal);
  const { s, eventAt, busy, error, act } = useRallyStore(useShallow((r) => ({ s: r.state, eventAt: r.eventAt, busy: r.busy, error: r.error, act: r.act })));
  const seat = mySeat(s);
  const myTeam = seat?.team ?? null;
  const myMove = s.status === 'ACTIVE' && isMyMove(s);
  const ev = s.lastEvent;
  const landsAt = eventAt + (ev?.flightMs ?? 0);
  const now = useFrameNow(s.status === 'ACTIVE');
  const close = () => setActiveModal(null);
  const leave = async () => { await act('leave'); close(); };
  // A touch is sent once per pending move, even if the bar times out and a tap lands together.
  const sentFor = useRef('');
  const moveKey = `${s.id}:${s.seq}:${s.phase}`;
  const touch = (action: 'pass' | 'attack', timing: number) => {
    if (sentFor.current === moveKey) return;
    sentFor.current = moveKey;
    void act('touch', { action, timing });
  };
  // Out of time on the bar: whiff (the Worker would drop it anyway a moment later).
  useEffect(() => {
    if (!myMove || s.phase !== 'TOUCH') return;
    const at = landsAt + RALLY_RULES.BAR_MS * 1.2 - Date.now();
    const t = setTimeout(() => touch(s.pending!.touch >= 3 ? 'attack' : 'pass', 0), Math.max(0, at));
    return () => clearTimeout(t);
  }, [moveKey, myMove]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // Flash the latest touch label while the ball flies, then the point verdict.
  const flying = ev && now < landsAt + 600;
  const pointNow = s.lastPoint && s.lastPoint.seq === ev?.seq && now >= landsAt;
  const banner = pointNow
    ? { text: `Point ${s.lastPoint!.team === myTeam ? 'us' : `Team ${s.lastPoint!.team}`} · ${REASON[s.lastPoint!.reason]}`, tone: s.lastPoint!.team === myTeam ? 'goal' : myTeam ? 'miss' : 'saved' }
    : flying && ev && ev.label !== 'SERVE' ? { text: `${ev.label} · ${ev.byUserId && seat && s.teams[seat.team][seat.slot]?.userId === ev.byUserId ? 'You' : ev.byName}`, tone: ev.label === 'SPIKE!' ? 'post' : 'saved' } : null;
  const secondsLeft = s.wakeAt ? Math.max(0, Math.ceil((s.wakeAt - s.updatedAt - (now - useRallyStore.getState().receivedAt)) / 1000)) : 0;
  const pendingPlayer = s.pending ? s.teams[s.pending.team][s.pending.slot] : undefined;

  let body: React.ReactNode;
  if (s.status === 'ACTIVE' && myTeam) {
    let action: React.ReactNode;
    if (myMove && s.phase === 'SERVE') {
      action = (
        <>
          <p className="fb-turn" role="status">Your serve · <b>{secondsLeft}s</b></p>
          <ShotControls disabled={busy} label="Hold to power, release in the band" pad={SERVE_PAD} sweetSpot={SERVE_SWEET} onShoot={(aim, power) => act('serve', { aim, power })} />
        </>
      );
    } else if (myMove && s.phase === 'TOUCH') {
      action = <TouchControls s={s} barStart={landsAt} now={now} onTouch={touch} disabled={busy || sentFor.current === moveKey} />;
    } else {
      const who = pendingPlayer ? (pendingPlayer.bot ? `CPU (Team ${s.pending!.team})` : `@${pendingPlayer.name}`) : '';
      action = (
        <p className="fb-note" role="status">
          {s.phase === 'POINT' ? 'Next serve coming up…' : s.phase === 'SERVE' ? `${who} to serve` : `Ball to ${who}…`}
        </p>
      );
    }
    body = (
      <>
        <div className="vr-teams"><TeamCard s={s} team="A" me={myTeam} /><span className="fb-vs">vs</span><TeamCard s={s} team="B" me={myTeam} /></div>
        {action}
        <div className="fb-row"><button className="fb-btn" disabled={busy} onClick={leave}>Leave match</button></div>
      </>
    );
  } else if (s.status === 'RESULT') {
    body = (
      <div className="fb-result">
        <h3>2V2 VOLLEYBALL</h3>
        <div className="vr-teams"><TeamCard s={s} team="A" me={myTeam} /><span className="fb-vs">vs</span><TeamCard s={s} team="B" me={myTeam} /></div>
        <p className="fb-winner">
          {s.winner === myTeam ? 'Your team wins! 🏆' : `Team ${s.winner} wins`}
          {s.endReason === 'forfeit' && <small> · the other team left</small>}
        </p>
        <div className="fb-row">
          {myTeam && <button className="fb-btn fb-primary" disabled={busy} onClick={() => act('again')}>Play Again</button>}
          {myTeam ? <button className="fb-btn" disabled={busy} onClick={leave}>Leave</button>
            : <><button className="fb-btn fb-primary" disabled={busy} onClick={() => act('join', { team: 'A' })}>Join Team A</button><button className="fb-btn fb-primary" disabled={busy} onClick={() => act('join', { team: 'B' })}>Join Team B</button></>}
        </div>
      </div>
    );
  } else if (s.status === 'ACTIVE') {
    body = (
      <>
        <div className="vr-teams"><TeamCard s={s} team="A" me={null} /><span className="fb-vs">vs</span><TeamCard s={s} team="B" me={null} /></div>
        <p className="fb-note">Match in progress — join the next one.</p>
      </>
    );
  } else {
    const full = (t: Team) => s.teams[t].length >= RALLY_RULES.TEAM_SIZE;
    body = (
      <>
        <div className="vr-teams"><TeamCard s={s} team="A" me={myTeam} /><span className="fb-vs">vs</span><TeamCard s={s} team="B" me={myTeam} /></div>
        <p className="fb-note">Starts automatically when it’s 2v2 · first to {RALLY_RULES.POINTS_TO_WIN}, win by {RALLY_RULES.WIN_BY}</p>
        <div className="fb-row">
          {(['A', 'B'] as const).map((t) => (
            <button key={t} className="fb-btn fb-primary" disabled={busy || myTeam === t || full(t)} onClick={() => act('join', { team: t })}>
              {myTeam === t ? `On Team ${t}` : full(t) ? `Team ${t} full` : myTeam ? `Switch to ${t}` : `Join Team ${t}`}
            </button>
          ))}
        </div>
        <div className="fb-row">
          {myTeam && <button className="fb-btn" disabled={busy} onClick={() => act('leave')}>Leave team</button>}
          <button className="fb-btn" onClick={() => setActiveModal('volleyball')}>Serve challenge</button>
        </div>
      </>
    );
  }

  return (
    <div className="fb-wrap">
      <section className="fb-sheet" role="dialog" aria-labelledby="rally-title">
        <header>
          <span aria-hidden>🏐</span>
          <h2 id="rally-title">2v2 Volleyball</h2>
          <button className="fb-close" aria-label="Close 2v2 volleyball" onClick={close}><X size={18} /></button>
        </header>
        {banner && <div className={`fb-verdict fb-v-${banner.tone} vr-banner`} role="status">{banner.text}</div>}
        {error && <p className="fb-error" role="alert">{error}</p>}
        {body}
      </section>
    </div>
  );
};
