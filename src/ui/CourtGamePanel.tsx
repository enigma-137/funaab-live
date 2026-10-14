import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../stores/gameStore';
import { courtStores, isMeOnCourt, onCourt, stepUpToSpot, type CourtGameId } from '../stores/courtGameStore';
import { BASKETBALL_RULES, isBasket } from '../config/basketball';
import { VOLLEYBALL_RULES } from '../config/volleyball';
import type { ShootoutPlayer, ShootoutState, Shot } from '../config/shootout';
import { ShotControls } from './FootballPanel';
import { openRally, useRallyStore } from '../stores/rallyStore';
import './football.css';

/** Volleyball only: the way into 2v2 team play, with how many have joined so far. */
function RallyEntry() {
  const joined = useRallyStore((r) => r.state.teams.A.filter((p) => !p.bot).length + r.state.teams.B.filter((p) => !p.bot).length);
  const status = useRallyStore((r) => r.state.status);
  const label = status === 'ACTIVE' ? 'match on now' : status === 'FORMING' ? `${joined}/4 joined` : 'pick a team';
  return (
    <div className="fb-challenge">
      <span className="fb-grow">🏐 2v2 Team Rally · {label}</span>
      <button className="fb-btn fb-primary" onClick={openRally}>2v2 Rally</button>
    </div>
  );
}

type State = ShootoutState<string, { outcome: string }>;
type AnyShot = Shot<{ outcome: string }>;

// Per-court wording, verdicts and pad art. Both courts share the shootout flow.
const GAMES: Record<CourtGameId, {
  icon: string; title: string; resultTitle: string; shots: number; resultDelay: number; cooldown: number;
  verdict: Record<string, [text: string, tone: 'goal' | 'saved' | 'miss' | 'post']>; scores: (o: string) => boolean;
  /** Meter sweet spot as [left %, width %]. */
  sweet: [number, number]; pad: React.ReactNode;
  practice: string; yourTurn: string; theirTurn: string; create: string; per: string; busyNote: string;
}> = {
  basketball: {
    icon: '🏀', title: 'Free-Throw Challenge', resultTitle: 'FREE-THROW SHOOTOUT',
    shots: BASKETBALL_RULES.SHOTS_PER_PLAYER, resultDelay: 1100, cooldown: BASKETBALL_RULES.PRACTICE_COOLDOWN_MS,
    verdict: { SWISH: ['SWISH! 🏀', 'goal'], SCORE: ['BUCKET!', 'goal'], RIM: ['RIMMED OUT', 'post'], MISS: ['MISS', 'miss'] },
    scores: (o) => isBasket(o as never),
    // Power ≈ SWEET_POWER ± 0.07 drops cleanly through the rim.
    sweet: [(BASKETBALL_RULES.SWEET_POWER - 0.07) * 100, 14],
    pad: <><div className="bb-board" aria-hidden><div className="bb-square" /></div><div className="bb-rim" aria-hidden /></>,
    practice: '🏀 Practice Throw', yourTurn: 'Your throw', theirTurn: 'is shooting', create: 'Create Shootout',
    per: 'free throws each', busyNote: 'Shootout in progress — practise after the final buzzer.',
  },
  volleyball: {
    icon: '🏐', title: 'Serve Challenge', resultTitle: 'SERVE-OFF',
    shots: VOLLEYBALL_RULES.SHOTS_PER_PLAYER, resultDelay: 1300, cooldown: VOLLEYBALL_RULES.PRACTICE_COOLDOWN_MS,
    verdict: { ACE: ['ACE! 🏐', 'goal'], DUG: ['DUG!', 'saved'], NET: ['NET', 'miss'], OUT: ['OUT', 'post'] },
    scores: (o) => o === 'ACE',
    // The serve clears the net and lands in between these powers.
    sweet: [VOLLEYBALL_RULES.IN_POWER[0] * 100, (VOLLEYBALL_RULES.IN_POWER[1] - VOLLEYBALL_RULES.IN_POWER[0]) * 100],
    pad: <><div className="vb-court" aria-hidden /><div className="vb-net" aria-hidden /><div className="vb-receiver" aria-hidden>🧍</div></>,
    practice: '🏐 Practice Serve', yourTurn: 'Your serve', theirTurn: 'is serving', create: 'Create Serve-off',
    per: 'serves each', busyNote: 'Serve-off in progress — practise after it finishes.',
  },
};

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function useShotVerdict(game: CourtGameId, shot: AnyShot | null, relevant: (s: AnyShot) => boolean) {
  const cfg = GAMES[game];
  const [verdict, setVerdict] = useState<{ seq: number; text: string; tone: string } | null>(null);
  const seen = useRef(shot?.seq ?? 0);
  useEffect(() => {
    if (!shot || shot.seq <= seen.current) return;
    seen.current = shot.seq;
    if (!relevant(shot)) return;
    const [text, tone] = shot.reason === 'timeout' ? ['TIME UP — MISS', 'miss'] : cfg.verdict[shot.outcome] ?? [shot.outcome, 'miss'];
    const show = setTimeout(() => setVerdict({ seq: shot.seq, text, tone }), shot.reason ? 0 : cfg.resultDelay);
    const hide = setTimeout(() => setVerdict((v) => (v?.seq === shot.seq ? null : v)), cfg.resultDelay + 1900);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [shot?.seq]);
  return verdict;
}

function Dots({ game, outcomes }: { game: CourtGameId; outcomes: string[] }) {
  const cfg = GAMES[game];
  return (
    <span className="fb-dots" aria-label={outcomes.map((o) => o.toLowerCase()).join(', ') || 'no shots yet'}>
      {Array.from({ length: cfg.shots }, (_, i) => (
        <i key={i} className={outcomes[i] ? (cfg.scores(outcomes[i]) ? 'goal' : 'miss') : ''} />
      ))}
    </span>
  );
}

function Scoreboard({ game, s }: { game: CourtGameId; s: State }) {
  const side = (p: ShootoutPlayer | null) =>
    p && (
      <div className={`fb-side${s.turnUserId === p.userId ? ' is-turn' : ''}`}>
        <span className="fb-name">{isMeOnCourt(p) ? 'You' : `@${p.name}`}</span>
        <b>{s.score[p.userId] ?? 0}</b>
        <Dots game={game} outcomes={s.history[p.userId] ?? []} />
      </div>
    );
  return <div className="fb-score">{side(s.player1)}<span className="fb-vs">vs</span>{side(s.player2)}</div>;
}

export const CourtGamePanel: React.FC<{ game: CourtGameId }> = ({ game }) => {
  const cfg = GAMES[game];
  const setActiveModal = useGameStore((g) => g.setActiveModal);
  const { s, receivedAt, busy, error, act } = courtStores[game](useShallow((b) => ({ s: b.state as State, receivedAt: b.receivedAt, busy: b.busy, error: b.error, act: b.act })));
  const mine = onCourt(s);
  const me = isMeOnCourt(s.player1) ? s.player1 : isMeOnCourt(s.player2) ? s.player2 : null;
  const myTurn = mine && s.status === 'ACTIVE' && s.turnUserId === me?.userId;
  const now = useNow(s.status === 'ACTIVE');
  const [cooling, setCooling] = useState(false);
  const verdict = useShotVerdict(game, s.lastShot, (shot) => isMeOnCourt({ userId: shot.shooterUserId, connectionId: shot.shooterConnectionId, name: '' }) || (!shot.practice && mine));

  useEffect(() => {
    if (mine && s.status === 'ACTIVE') stepUpToSpot(game, myTurn);
  }, [s.id, s.turnUserId]);

  const shoot = async (op: 'practice' | 'shoot', aim: number, power: number) => {
    setCooling(true);
    await act(op, { aim, power });
    setTimeout(() => setCooling(false), op === 'practice' ? cfg.cooldown : 1400);
  };
  const close = () => setActiveModal(null);
  const leave = async () => { await act('leave'); close(); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  const secondsLeft = s.turnDeadline ? Math.max(0, Math.ceil((s.turnDeadline - s.updatedAt - (now - receivedAt)) / 1000)) : 0;
  const turnName = s.turnUserId === s.player1?.userId ? s.player1?.name : s.player2?.name;
  const winner = s.winnerUserId ? (s.player1?.userId === s.winnerUserId ? s.player1 : s.player2) : null;
  const opponent = me && (s.player1?.userId === me.userId ? s.player2 : s.player1);
  const controls = (label: string, op: 'practice' | 'shoot') => (
    <ShotControls disabled={busy || cooling} label={label} pad={cfg.pad} sweetSpot={cfg.sweet} onShoot={(a, p) => shoot(op, a, p)} />
  );

  let body: React.ReactNode;
  if (mine && s.status === 'ACTIVE') {
    body = (
      <>
        <Scoreboard game={game} s={s} />
        <p className="fb-turn" role="status">
          {myTurn ? <>{cfg.yourTurn} · <b>{secondsLeft}s</b></> : <>@{turnName} {cfg.theirTurn}… <b>{secondsLeft}s</b></>}
        </p>
        {myTurn && controls('Hold, release in the white band', 'shoot')}
      </>
    );
  } else if (mine && s.status === 'RESULT') {
    const voted = !!me && s.rematchVotes.includes(me.userId);
    const theyVoted = !!opponent && s.rematchVotes.includes(opponent.userId);
    const theyLeft = s.leftUserIds.length > 0;
    body = (
      <div className="fb-result">
        <h3>{cfg.resultTitle}</h3>
        <Scoreboard game={game} s={s} />
        <p className="fb-winner">
          {winner ? (isMeOnCourt(winner) ? 'You win! 🏆' : `@${winner.name} wins`) : 'It’s a draw'}
          {s.endReason === 'forfeit' && <small> · opponent left the court</small>}
        </p>
        {!theyLeft && (voted || theyVoted) && <p className="fb-note">{voted ? `Waiting for @${opponent?.name}…` : `@${opponent?.name} wants a rematch`}</p>}
        <div className="fb-row">
          <button className="fb-btn fb-primary" disabled={busy || voted || theyLeft || s.endReason === 'forfeit'} onClick={() => act('rematch')}>Play Again</button>
          <button className="fb-btn" disabled={busy} onClick={leave}>Leave</button>
        </div>
      </div>
    );
  } else {
    const waitingMine = mine && s.status === 'WAITING';
    const busyCourt = s.status === 'ACTIVE';
    body = (
      <>
        {busyCourt ? (
          <div className="fb-info">
            <Scoreboard game={game} s={s} />
            <p className="fb-note">{cfg.busyNote}</p>
          </div>
        ) : (
          controls(cfg.practice, 'practice')
        )}
        <div className="fb-challenge">
          {waitingMine ? (
            <>
              <span className="fb-spinner" aria-hidden /> <span className="fb-grow">Waiting for a challenger…</span>
              <button className="fb-btn" disabled={busy} onClick={() => act('cancel')}>Cancel</button>
            </>
          ) : s.status === 'WAITING' && s.player1 ? (
            <>
              <span className="fb-grow">@{s.player1.name} wants a 1v1</span>
              <button className="fb-btn fb-primary" disabled={busy} onClick={() => act('join', { matchId: s.id })}>Join</button>
            </>
          ) : !busyCourt ? (
            <>
              <span className="fb-grow">1v1 · {cfg.shots} {cfg.per}</span>
              <button className="fb-btn fb-primary" disabled={busy} onClick={() => act('create')}>{cfg.create}</button>
            </>
          ) : null}
        </div>
        {game === 'volleyball' && <RallyEntry />}
      </>
    );
  }

  return (
    <div className="fb-wrap">
      <section className="fb-sheet" role="dialog" aria-labelledby={`${game}-title`}>
        <header>
          <span aria-hidden>{cfg.icon}</span>
          <h2 id={`${game}-title`}>{cfg.title}</h2>
          <button className="fb-close" aria-label={`Close ${cfg.title.toLowerCase()}`} onClick={close}><X size={18} /></button>
        </header>
        {verdict && <div className={`fb-verdict fb-v-${verdict.tone}`} role="status">{verdict.text}</div>}
        {error && <p className="fb-error" role="alert">{error}</p>}
        {body}
      </section>
    </div>
  );
};
