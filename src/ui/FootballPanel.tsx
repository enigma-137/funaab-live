import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../stores/gameStore';
import { amParticipant, isMe, stepUpToBall, useFootballStore } from '../stores/footballStore';
import { FOOTBALL_PITCH, FOOTBALL_RULES, type FootballMatchState, type FootballPlayer, type FootballShot, type ShotOutcome } from '../config/football';
import './football.css';

// The pad spans aim -1..1; the posts sit where the shot model puts them (aim × 2.85 m).
const POST_AT = FOOTBALL_PITCH.goalHalfWidth / 2.85;
const CHARGE_MS = 900; // one sweep 0 → 1; the meter ping-pongs while held
const RESULT_DELAY_MS = 650; // let the ball reach the goal before the verdict
const OUTCOME_TEXT: Record<ShotOutcome, string> = { GOAL: 'GOAL!', SAVED: 'SAVED', MISS: 'MISS', POST: 'POST!' };

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Verdict banner for the newest shot that concerns this student. */
function useShotVerdict(shot: FootballShot | null, relevant: (s: FootballShot) => boolean) {
  const [verdict, setVerdict] = useState<{ seq: number; text: string; outcome: ShotOutcome } | null>(null);
  const seen = useRef(shot?.seq ?? 0);
  useEffect(() => {
    if (!shot || shot.seq <= seen.current) return;
    seen.current = shot.seq;
    if (!relevant(shot)) return;
    const text = shot.reason === 'timeout' ? 'TIME UP — MISS' : OUTCOME_TEXT[shot.outcome];
    const show = setTimeout(() => setVerdict({ seq: shot.seq, text, outcome: shot.outcome }), shot.reason ? 0 : RESULT_DELAY_MS);
    const hide = setTimeout(() => setVerdict((v) => (v?.seq === shot.seq ? null : v)), 2600);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [shot?.seq]);
  return verdict;
}

function ShotControls({ disabled, label, onShoot }: { disabled: boolean; label: string; onShoot: (aim: number, power: number) => void }) {
  const [aim, setAim] = useState(0);
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const chargeStart = useRef(0);
  const frame = useRef(0);
  const padRef = useRef<HTMLDivElement>(null);
  const aimRef = useRef(0);
  aimRef.current = aim;

  const aimFrom = (clientX: number) => {
    const r = padRef.current?.getBoundingClientRect();
    if (!r) return;
    setAim(Math.max(-1, Math.min(1, ((clientX - r.left) / r.width) * 2 - 1)));
  };
  const powerAt = (t: number) => {
    const phase = ((t - chargeStart.current) / CHARGE_MS) % 2;
    return phase <= 1 ? phase : 2 - phase;
  };
  // A ref, not state: pointerup and pointerleave arrive back-to-back and must not both shoot.
  const chargingRef = useRef(false);
  const startCharge = () => {
    if (disabled || chargingRef.current) return;
    chargeStart.current = performance.now();
    chargingRef.current = true;
    setCharging(true);
    const tick = () => { setPower(powerAt(performance.now())); frame.current = requestAnimationFrame(tick); };
    frame.current = requestAnimationFrame(tick);
  };
  const stopCharge = () => {
    cancelAnimationFrame(frame.current);
    chargingRef.current = false;
    setCharging(false);
  };
  const release = () => {
    if (!chargingRef.current) return;
    stopCharge();
    const p = Number(powerAt(performance.now()).toFixed(3));
    setPower(p);
    if (!disabled) onShoot(Number(aimRef.current.toFixed(3)), p);
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => { if (disabled && chargingRef.current) stopCharge(); }, [disabled]);

  // Desktop: ←/→ aim, hold Space to power, release to shoot.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); setAim((a) => Math.max(-1, a - 0.1)); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setAim((a) => Math.min(1, a + 0.1)); }
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startCharge(); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space' && chargingRef.current) { e.preventDefault(); release(); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  });

  return (
    <div className="fb-controls">
      <div
        ref={padRef}
        className="fb-aim"
        role="slider"
        aria-label="Aim left or right"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={Number(aim.toFixed(1))}
        tabIndex={0}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); aimFrom(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons) aimFrom(e.clientX); }}
      >
        <div className="fb-goal" style={{ left: `${50 - POST_AT * 50}%`, right: `${50 - POST_AT * 50}%` }} />
        <div className="fb-keeper" aria-hidden>🧤</div>
        <div className="fb-target" style={{ left: `${50 + aim * 50}%` }} aria-hidden />
        <span className="fb-aim-hint">Drag to aim</span>
      </div>
      <button
        className={`fb-shoot${charging ? ' is-charging' : ''}`}
        disabled={disabled}
        onPointerDown={(e) => { e.preventDefault(); startCharge(); }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={stopCharge}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="fb-meter" aria-hidden><i style={{ width: `${power * 100}%` }} /><b /></span>
        <span className="fb-shoot-label">{charging ? 'Release to SHOOT' : label}</span>
      </button>
    </div>
  );
}

function Dots({ outcomes }: { outcomes: ShotOutcome[] }) {
  return (
    <span className="fb-dots" aria-label={outcomes.map((o) => o.toLowerCase()).join(', ') || 'no shots yet'}>
      {Array.from({ length: FOOTBALL_RULES.SHOTS_PER_PLAYER }, (_, i) => (
        <i key={i} className={outcomes[i] ? (outcomes[i] === 'GOAL' ? 'goal' : 'miss') : ''} />
      ))}
    </span>
  );
}

function Scoreboard({ s }: { s: FootballMatchState }) {
  const side = (p: FootballPlayer | null) =>
    p && (
      <div className={`fb-side${s.turnUserId === p.userId ? ' is-turn' : ''}`}>
        <span className="fb-name">{isMe(p) ? 'You' : `@${p.name}`}</span>
        <b>{s.score[p.userId] ?? 0}</b>
        <Dots outcomes={s.history[p.userId] ?? []} />
      </div>
    );
  return <div className="fb-score">{side(s.player1)}<span className="fb-vs">vs</span>{side(s.player2)}</div>;
}

export const FootballPanel: React.FC = () => {
  const setActiveModal = useGameStore((g) => g.setActiveModal);
  const { s, receivedAt, busy, error, act } = useFootballStore(useShallow((f) => ({ s: f.state, receivedAt: f.receivedAt, busy: f.busy, error: f.error, act: f.act })));
  const mine = amParticipant(s);
  const me = isMe(s.player1) ? s.player1 : isMe(s.player2) ? s.player2 : null;
  const myTurn = mine && s.status === 'ACTIVE' && s.turnUserId === me?.userId;
  const now = useNow(s.status === 'ACTIVE');
  const [cooling, setCooling] = useState(false);
  const verdict = useShotVerdict(s.lastShot, (shot) => isMe({ userId: shot.shooterUserId, connectionId: shot.shooterConnectionId, name: '' }) || (!shot.practice && mine));

  // Shooter steps behind the ball; the other player stands just aside.
  useEffect(() => {
    if (mine && s.status === 'ACTIVE') stepUpToBall(myTurn);
  }, [s.id, s.turnUserId]);

  const shoot = async (op: 'practice' | 'shoot', aim: number, power: number) => {
    setCooling(true);
    await act(op, { aim, power });
    setTimeout(() => setCooling(false), op === 'practice' ? FOOTBALL_RULES.PRACTICE_COOLDOWN_MS : 1200);
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

  let body: React.ReactNode;
  if (mine && s.status === 'ACTIVE') {
    body = (
      <>
        <Scoreboard s={s} />
        <p className="fb-turn" role="status">
          {myTurn ? <>Your shot · <b>{secondsLeft}s</b></> : <>@{turnName} is shooting… <b>{secondsLeft}s</b></>}
        </p>
        {myTurn && <ShotControls disabled={busy || cooling} label="Hold to power" onShoot={(a, p) => shoot('shoot', a, p)} />}
      </>
    );
  } else if (mine && s.status === 'RESULT') {
    const voted = !!me && s.rematchVotes.includes(me.userId);
    const theyVoted = !!opponent && s.rematchVotes.includes(opponent.userId);
    const theyLeft = s.leftUserIds.length > 0;
    body = (
      <div className="fb-result">
        <h3>FOOTBALL CHALLENGE</h3>
        <Scoreboard s={s} />
        <p className="fb-winner">
          {winner ? (isMe(winner) ? 'You win! 🏆' : `@${winner.name} wins`) : 'It’s a draw'}
          {s.endReason === 'forfeit' && <small> · opponent left the pitch</small>}
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
    const busyPitch = s.status === 'ACTIVE';
    body = (
      <>
        {busyPitch ? (
          <div className="fb-info">
            <Scoreboard s={s} />
            <p className="fb-note">Match in progress — practice after the final whistle.</p>
          </div>
        ) : (
          <ShotControls disabled={busy || cooling} label="⚽ Practice Shot" onShoot={(a, p) => shoot('practice', a, p)} />
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
          ) : !busyPitch ? (
            <>
              <span className="fb-grow">1v1 · {FOOTBALL_RULES.SHOTS_PER_PLAYER} shots each</span>
              <button className="fb-btn fb-primary" disabled={busy} onClick={() => act('create')}>Create Football Challenge</button>
            </>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div className="fb-wrap">
      <section className="fb-sheet" role="dialog" aria-labelledby="fb-title">
        <header>
          <span aria-hidden>⚽</span>
          <h2 id="fb-title">Penalty Challenge</h2>
          <button className="fb-close" aria-label="Close penalty challenge" onClick={close}><X size={18} /></button>
        </header>
        {verdict && <div className={`fb-verdict fb-v-${verdict.outcome.toLowerCase()}`} role="status">{verdict.text}</div>}
        {error && <p className="fb-error" role="alert">{error}</p>}
        {body}
      </section>
    </div>
  );
};
