import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../stores/gameStore';
import { isMeOnCourt, onCourt, stepUpToLine, useBasketballStore } from '../stores/basketballStore';
import { BASKETBALL_RULES, isBasket, type BasketballMatchState, type BasketballPlayer, type BasketballShot, type HoopOutcome } from '../config/basketball';
import { ShotControls } from './FootballPanel';
import './football.css';

// Meter band where the ball drops on the rim (power ≈ SWEET_POWER ± 0.07 is a clean make).
const SWEET: [number, number] = [(BASKETBALL_RULES.SWEET_POWER - 0.07) * 100, 14];
const RESULT_DELAY_MS = 1100; // the ball is in the air a little longer than a penalty
const OUTCOME_TEXT: Record<HoopOutcome, string> = { SWISH: 'SWISH! 🏀', SCORE: 'BUCKET!', RIM: 'RIMMED OUT', MISS: 'MISS' };
const VERDICT_CLASS: Record<HoopOutcome, string> = { SWISH: 'goal', SCORE: 'goal', RIM: 'post', MISS: 'miss' };

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function useShotVerdict(shot: BasketballShot | null, relevant: (s: BasketballShot) => boolean) {
  const [verdict, setVerdict] = useState<{ seq: number; text: string; outcome: HoopOutcome } | null>(null);
  const seen = useRef(shot?.seq ?? 0);
  useEffect(() => {
    if (!shot || shot.seq <= seen.current) return;
    seen.current = shot.seq;
    if (!relevant(shot)) return;
    const text = shot.reason === 'timeout' ? 'TIME UP — MISS' : OUTCOME_TEXT[shot.outcome];
    const show = setTimeout(() => setVerdict({ seq: shot.seq, text, outcome: shot.outcome }), shot.reason ? 0 : RESULT_DELAY_MS);
    const hide = setTimeout(() => setVerdict((v) => (v?.seq === shot.seq ? null : v)), 3000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [shot?.seq]);
  return verdict;
}

const HoopPad = () => (
  <>
    <div className="bb-board" aria-hidden><div className="bb-square" /></div>
    <div className="bb-rim" aria-hidden />
  </>
);

function Dots({ outcomes }: { outcomes: HoopOutcome[] }) {
  return (
    <span className="fb-dots" aria-label={outcomes.map((o) => o.toLowerCase()).join(', ') || 'no shots yet'}>
      {Array.from({ length: BASKETBALL_RULES.SHOTS_PER_PLAYER }, (_, i) => (
        <i key={i} className={outcomes[i] ? (isBasket(outcomes[i]) ? 'goal' : 'miss') : ''} />
      ))}
    </span>
  );
}

function Scoreboard({ s }: { s: BasketballMatchState }) {
  const side = (p: BasketballPlayer | null) =>
    p && (
      <div className={`fb-side${s.turnUserId === p.userId ? ' is-turn' : ''}`}>
        <span className="fb-name">{isMeOnCourt(p) ? 'You' : `@${p.name}`}</span>
        <b>{s.score[p.userId] ?? 0}</b>
        <Dots outcomes={s.history[p.userId] ?? []} />
      </div>
    );
  return <div className="fb-score">{side(s.player1)}<span className="fb-vs">vs</span>{side(s.player2)}</div>;
}

export const BasketballPanel: React.FC = () => {
  const setActiveModal = useGameStore((g) => g.setActiveModal);
  const { s, receivedAt, busy, error, act } = useBasketballStore(useShallow((b) => ({ s: b.state, receivedAt: b.receivedAt, busy: b.busy, error: b.error, act: b.act })));
  const mine = onCourt(s);
  const me = isMeOnCourt(s.player1) ? s.player1 : isMeOnCourt(s.player2) ? s.player2 : null;
  const myTurn = mine && s.status === 'ACTIVE' && s.turnUserId === me?.userId;
  const now = useNow(s.status === 'ACTIVE');
  const [cooling, setCooling] = useState(false);
  const verdict = useShotVerdict(s.lastShot, (shot) => isMeOnCourt({ userId: shot.shooterUserId, connectionId: shot.shooterConnectionId, name: '' }) || (!shot.practice && mine));

  useEffect(() => {
    if (mine && s.status === 'ACTIVE') stepUpToLine(myTurn);
  }, [s.id, s.turnUserId]);

  const shoot = async (op: 'practice' | 'shoot', aim: number, power: number) => {
    setCooling(true);
    await act(op, { aim, power });
    setTimeout(() => setCooling(false), op === 'practice' ? BASKETBALL_RULES.PRACTICE_COOLDOWN_MS : 1400);
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
    <ShotControls disabled={busy || cooling} label={label} pad={<HoopPad />} sweetSpot={SWEET} onShoot={(a, p) => shoot(op, a, p)} />
  );

  let body: React.ReactNode;
  if (mine && s.status === 'ACTIVE') {
    body = (
      <>
        <Scoreboard s={s} />
        <p className="fb-turn" role="status">
          {myTurn ? <>Your throw · <b>{secondsLeft}s</b></> : <>@{turnName} is shooting… <b>{secondsLeft}s</b></>}
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
        <h3>FREE-THROW SHOOTOUT</h3>
        <Scoreboard s={s} />
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
            <Scoreboard s={s} />
            <p className="fb-note">Shootout in progress — practise after the final buzzer.</p>
          </div>
        ) : (
          controls('🏀 Practice Throw', 'practice')
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
              <span className="fb-grow">1v1 · {BASKETBALL_RULES.SHOTS_PER_PLAYER} free throws each</span>
              <button className="fb-btn fb-primary" disabled={busy} onClick={() => act('create')}>Create Shootout</button>
            </>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className="fb-wrap">
      <section className="fb-sheet" role="dialog" aria-labelledby="bb-title">
        <header>
          <span aria-hidden>🏀</span>
          <h2 id="bb-title">Free-Throw Challenge</h2>
          <button className="fb-close" aria-label="Close free-throw challenge" onClick={close}><X size={18} /></button>
        </header>
        {verdict && <div className={`fb-verdict fb-v-${VERDICT_CLASS[verdict.outcome]}`} role="status">{verdict.text}</div>}
        {error && <p className="fb-error" role="alert">{error}</p>}
        {body}
      </section>
    </div>
  );
};
