import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Minus, Plus, Ticket, Trophy, History } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useWalletStore } from '../stores/walletStore';
import { useInputStore } from '../stores/inputStore';
import { useCampusBetStore } from '../stores/campusBetStore';
import {
  CAMPUS_BET_MULTIPLIERS, CAMPUS_BET_STAKE, campusBetPayout, isValidCampusBetStake,
  type CampusBetFixtureView, type CampusBetPick, type CampusBetRoundView, type CampusBetState, type CampusBetTicketView,
} from '../config/campusBet';
import './campusBet.css';

type Tab = 'bet' | 'results' | 'tickets';
const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const signed = (n: number) => (n > 0 ? `+${naira(n)}` : n < 0 ? `−${naira(-n)}` : naira(0));
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const SEEN_KEY = 'campus-bet-seen-results';
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const writeSeen = (id: string) => { try { localStorage.setItem(SEEN_KEY, id); } catch { /* private mode */ } };

const pickLabel = (state: CampusBetState, f: CampusBetFixtureView, pick: CampusBetPick) =>
  pick === 'DRAW' ? 'Draw' : state.teams[pick === 'HOME' ? f.home : f.away]?.shortName ?? (pick === 'HOME' ? 'Home' : 'Away');

function Form({ results }: { results?: Array<'W' | 'D' | 'L'> }) {
  if (!results?.length) return <span className="cb-form cb-form-empty">No form yet</span>;
  return <span className="cb-form" aria-label={`Recent form ${results.join(' ')}`}>
    {results.map((r, i) => <i key={i} className={`cb-form-${r}`}>{r}</i>)}
  </span>;
}

function ResultRows({ state, fixtures, picks }: { state: CampusBetState; fixtures: CampusBetFixtureView[]; picks?: CampusBetPick[] }) {
  return <ul className="cb-results">
    {fixtures.map((f, i) => {
      const pick = picks?.[i];
      const hit = pick && f.result ? pick === f.result : null;
      return <li key={f.slot}>
        <span className="cb-mark" aria-label={hit === null ? 'No pick' : hit ? 'Correct' : 'Wrong'}>{hit === null ? '•' : hit ? '✅' : '❌'}</span>
        <span className="cb-line">
          <b>{state.teams[f.home]?.shortName} {f.home_score ?? '–'}–{f.away_score ?? '–'} {state.teams[f.away]?.shortName}</b>
          {pick && <small>Your pick: {pickLabel(state, f, pick)}</small>}
        </span>
      </li>;
    })}
  </ul>;
}

function TicketSummary({ ticket }: { ticket: CampusBetTicketView }) {
  const correct = ticket.correct_count ?? 0, payout = ticket.payout ?? 0, net = payout - ticket.stake;
  const verdict = correct === 5 ? <><strong className="cb-big">5/5!</strong><span className="cb-cooked">YOU COOKED 🔥</span><span>Won {naira(payout)}</span></>
    : payout > ticket.stake ? <><strong className="cb-big">{correct}/5 🙌</strong><span>Nice one — {naira(payout)} back.</span></>
      : <><strong className="cb-big">{correct}/5</strong><span>See you next Matchday.</span></>;
  return <div className="cb-summary">
    <div className="cb-verdict">{verdict}</div>
    <dl>
      <div><dt>Correct</dt><dd>{correct} / 5</dd></div>
      <div><dt>Stake</dt><dd>{naira(ticket.stake)}</dd></div>
      <div><dt>Payout</dt><dd>{naira(payout)}</dd></div>
      <div><dt>Net</dt><dd className={net > 0 ? 'cb-pos' : net < 0 ? 'cb-neg' : ''}>{signed(net)}</dd></div>
    </dl>
  </div>;
}

function ResultsView({ state, round, ticket }: { state: CampusBetState; round: CampusBetRoundView | null; ticket: CampusBetTicketView | null }) {
  if (!round) return <p className="cb-empty">No results yet. The first Matchday settles 15 minutes after it opens.</p>;
  return <div>
    <h3 className="cb-section">Matchday {round.round_number} results</h3>
    <ResultRows state={state} fixtures={round.fixtures} picks={ticket?.picks} />
    {ticket ? <TicketSummary ticket={ticket} /> : <p className="cb-empty">You didn't play this Matchday.</p>}
  </div>;
}

function TicketsView({ state }: { state: CampusBetState }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!state.history.length) return <p className="cb-empty">No tickets yet.</p>;
  return <ul className="cb-history">
    {state.history.map((t) => {
      const settled = t.settled_at !== null;
      const net = (t.payout ?? 0) - t.stake;
      return <li key={t.round_id}>
        <button aria-expanded={open === t.round_id} onClick={() => setOpen(open === t.round_id ? null : t.round_id)}>
          <span>Matchday {t.round_number}</span>
          <span>{settled ? `${t.correct_count}/5` : 'Pending'}</span>
          <b className={settled ? (net > 0 ? 'cb-pos' : net < 0 ? 'cb-neg' : '') : ''}>{settled ? signed(net) : naira(t.stake)}</b>
        </button>
        {open === t.round_id && t.fixtures && <ResultRows state={state} fixtures={t.fixtures} picks={t.picks} />}
      </li>;
    })}
  </ul>;
}

export function CampusBetModal() {
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const balance = useWalletStore((s) => s.balance);
  const setIsInputFocused = useInputStore((s) => s.setIsInputFocused);
  const { state, clockOffset, loading, placing, error, stake, picks, load, setStake, pick, place } = useCampusBetStore();
  const [tab, setTab] = useState<Tab>('bet');
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  const [stakeText, setStakeText] = useState(String(stake));
  const closeRef = useRef<HTMLButtonElement>(null);
  const tabChosen = useRef(false);
  const close = () => setActiveModal(null);

  // Load, poll gently, and refresh right after the server's close/open boundaries.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    void load();
    const poll = setInterval(() => void load(true), 15000);
    const settled = () => void load(true);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('campus-bet-settled', settled);
    window.addEventListener('keydown', key);
    return () => { clearInterval(poll); window.removeEventListener('campus-bet-settled', settled); window.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + useCampusBetStore.getState().clockOffset), 1000);
    return () => clearInterval(tick);
  }, []);
  const current = state?.current ?? null;
  const closesAt = current ? Date.parse(current.closes_at) : 0;
  const nextOpensAt = state ? Date.parse(state.next_opens_at) : 0;
  useEffect(() => {
    if (!state) return;
    const timers = [closesAt, nextOpensAt].filter((t) => t > now).map((t) => setTimeout(() => void load(true), t - now + 1500));
    return () => timers.forEach(clearTimeout);
  }, [state?.current?.id, state?.current?.status, state?.next_opens_at]);

  // First load: jump to fresh results the player hasn't seen yet.
  useEffect(() => {
    if (!state || tabChosen.current) return;
    tabChosen.current = true;
    if (state.last_ticket?.settled_at && state.last_settled && readSeen() !== state.last_settled.id) setTab('results');
  }, [state]);
  useEffect(() => { if (tab === 'results' && state?.last_settled) writeSeen(state.last_settled.id); }, [tab, state?.last_settled?.id]);
  useEffect(() => { setStakeText(String(stake)); }, [stake]);

  const open = !!current && current.status === 'OPEN' && now < closesAt;
  const selected = picks.filter(Boolean).length;
  const affordable = balance >= stake;
  const canPlace = open && !state?.my_ticket && selected === 5 && isValidCampusBetStake(stake) && affordable && !placing;
  const multipliers = useMemo(() => CAMPUS_BET_MULTIPLIERS.map((m, k) => ({ k, m })).filter(({ m }) => m > 0), []);

  const commitStake = (raw: string) => {
    const n = Math.round(Number(raw) / CAMPUS_BET_STAKE.step) * CAMPUS_BET_STAKE.step;
    setStake(Number.isFinite(n) ? Math.min(CAMPUS_BET_STAKE.max, Math.max(CAMPUS_BET_STAKE.min, n)) : CAMPUS_BET_STAKE.default);
  };
  const submit = async () => { if (await place()) setTab('bet'); };

  let body: React.ReactNode;
  if (!state) body = <p className="cb-empty">{error ?? (loading ? 'Opening the shop…' : 'Connecting…')}</p>;
  else if (tab === 'results') body = <ResultsView state={state} round={state.last_settled} ticket={state.last_ticket} />;
  else if (tab === 'tickets') body = <TicketsView state={state} />;
  else if (!current || !open) {
    body = <div className="cb-closed">
      <strong>{current && current.status !== 'SETTLED' ? 'Betting closed — results are being drawn…' : 'Next Matchday opens soon'}</strong>
      <span>Next Matchday in <b>{clock(nextOpensAt - now)}</b></span>
      {state.last_settled && <button className="cb-link" onClick={() => setTab('results')}>See Matchday {state.last_settled.round_number} results</button>}
    </div>;
  } else if (state.my_ticket) {
    const t = state.my_ticket;
    body = <div>
      <div className="cb-placed"><Ticket size={18} /> <span>Ticket placed · {naira(t.stake)} stake · results in <b>{clock(closesAt - now)}</b></span></div>
      <ul className="cb-results">
        {current.fixtures.map((f, i) => <li key={f.slot}><span className="cb-mark">🎟️</span><span className="cb-line">
          <b>{state.teams[f.home]?.shortName} vs {state.teams[f.away]?.shortName}</b><small>Your pick: {pickLabel(state, f, t.picks[i])}</small></span></li>)}
      </ul>
      <p className="cb-note">One ticket per Matchday. Results are drawn once on the server when betting closes.</p>
    </div>;
  } else {
    body = <div>
      <ol className="cb-fixtures">
        {current.fixtures.map((f, i) => {
          const home = state.teams[f.home], away = state.teams[f.away];
          return <li key={f.slot}>
            <div className="cb-fixture-head">
              <span><b>{home?.name}</b><Form results={state.form[f.home]} /></span>
              <em>vs</em>
              <span><b>{away?.name}</b><Form results={state.form[f.away]} /></span>
            </div>
            <div className="cb-picks" role="radiogroup" aria-label={`${home?.name} vs ${away?.name}`}>
              {(['HOME', 'DRAW', 'AWAY'] as CampusBetPick[]).map((p) => (
                <button key={p} role="radio" aria-checked={picks[i] === p} className={picks[i] === p ? 'is-on' : ''} onClick={() => pick(i, p)}>
                  {pickLabel(state, f, p)}
                </button>
              ))}
            </div>
          </li>;
        })}
      </ol>
      <p className="cb-note">Payout by correct picks: {multipliers.map(({ k, m }) => `${k} → ${m === 0.5 ? '½' : m}×`).join(' · ')}. 0–1 correct pays nothing.</p>
    </div>;
  }

  const showBetFooter = tab === 'bet' && open && !state?.my_ticket;
  return (
    <div className="cb-backdrop" onClick={close}>
      <section className="cb-sheet" role="dialog" aria-modal="true" aria-labelledby="cb-title" onClick={(e) => e.stopPropagation()}>
        <header className="cb-header">
          <div>
            <small>CAMPUS BET · GAME NAIRA ONLY</small>
            <h2 id="cb-title">{current ? `Matchday ${current.round_number}` : 'Campus Bet'}</h2>
          </div>
          {open && <div className="cb-timer" aria-live="off"><span>Closes in</span><b>{clock(closesAt - now)}</b></div>}
          <button ref={closeRef} className="cb-close" aria-label="Close Campus Bet" onClick={close}><X size={18} /></button>
        </header>
        <nav className="cb-tabs" role="tablist">
          {([['bet', 'Bet', Ticket], ['results', 'Results', Trophy], ['tickets', 'My Tickets', History]] as const).map(([id, label, Icon]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={14} />{label}</button>
          ))}
        </nav>
        <div className="cb-body">{body}</div>
        {error && state && <p className="cb-error" role="alert">{error}</p>}
        {showBetFooter && (
          <footer className="cb-footer">
            <div className="cb-stake">
              <button aria-label="Lower stake" disabled={stake <= CAMPUS_BET_STAKE.min} onClick={() => setStake(Math.max(CAMPUS_BET_STAKE.min, stake - 50))}><Minus size={16} /></button>
              <label>
                <span>Stake ₦</span>
                <input inputMode="numeric" type="number" min={CAMPUS_BET_STAKE.min} max={CAMPUS_BET_STAKE.max} step={CAMPUS_BET_STAKE.step}
                  value={stakeText} onChange={(e) => setStakeText(e.target.value)}
                  onFocus={() => setIsInputFocused(true)} onBlur={(e) => { setIsInputFocused(false); commitStake(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label="Stake in game Naira" />
              </label>
              <button aria-label="Raise stake" disabled={stake >= CAMPUS_BET_STAKE.max} onClick={() => setStake(Math.min(CAMPUS_BET_STAKE.max, stake + 50))}><Plus size={16} /></button>
            </div>
            <div className="cb-presets">
              {CAMPUS_BET_STAKE.presets.map((p) => <button key={p} aria-pressed={stake === p} onClick={() => setStake(p)}>{naira(p)}</button>)}
            </div>
            <div className="cb-submit">
              <div>
                <span><b>{selected} / 5</b> selected</span>
                <span>Potential payout <b>{naira(campusBetPayout(stake, 5))}</b></span>
                {!affordable && <span className="cb-neg">Not enough game Naira ({naira(balance)})</span>}
              </div>
              <button className="cb-place" disabled={!canPlace} onClick={submit}>{placing ? 'Placing…' : 'Place bet'}</button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
