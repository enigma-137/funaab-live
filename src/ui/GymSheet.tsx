import React, { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useGymStore } from '../stores/gymStore';
import { useWalletStore } from '../stores/walletStore';
import './gym.css';
import { GYM, GYM_SESSIONS, GYM_STATIONS, gymHoursLabel, gymSession, gymStation } from '../config/gym';

/** The gym door: buy this session's pass (₦1,000) or come back when it opens. */
export function GymSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { busy, error, enter, hasPass } = useGymStore();
  useGymStore((s) => s.pass);
  const balance = useWalletStore((s) => s.balance);
  const now = Date.now();
  const session = gymSession(now);
  const pass = hasPass();
  return (
    <Sheet title={GYM.name} subtitle={`Campus gym · ${gymHoursLabel(now)}`} icon="🏋️" accent="#ea580c" onClose={() => setModal(null)}>
      <div className="academic-body">
        <section className="academic-card">
          <h3>Inside the gym</h3>
          <ul className="academic-checks">
            {[...new Map(GYM_STATIONS.map((s) => [s.kind, s])).values()].map((s) => (
              <li key={s.id}>{s.icon} {s.verb}</li>
            ))}
          </ul>
        </section>
        <p className="academic-note">
          Open {GYM_SESSIONS.map((s) => `${s.label.toLowerCase()}s ${s.hours}`).join(' and ')}. Each finished set earns XP once per station per session.
        </p>
        {!session ? (
          <p className="academic-note">The gym is closed right now. <b>{gymHoursLabel(now)}</b>.</p>
        ) : pass ? (
          <>
            <p className="academic-note">✅ You have a pass for this {session.label.toLowerCase()} session. Walk in and pick a station.</p>
            <button className="academic-primary academic-wide" onClick={() => setModal(null)}>Go in</button>
          </>
        ) : (
          <>
            <p className="academic-note">A pass is <b>₦{GYM.fee.toLocaleString()}</b> and covers the whole {session.label.toLowerCase()} session: leave and come back free until it closes.</p>
            <button className="academic-primary academic-wide" disabled={busy || balance < GYM.fee} onClick={() => void enter()}>
              {balance < GYM.fee ? 'Not enough money in your wallet' : busy ? 'Checking…' : `Pay ₦${GYM.fee.toLocaleString()} & enter`}
            </button>
          </>
        )}
        {error && <p className="academic-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}

/** While a set runs: what you're doing, a progress bar and a Stop button. */
export function GymWorkoutBar() {
  const workout = useGymStore((s) => s.workout);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!workout) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [workout]);
  if (!workout) return null;
  const station = gymStation(workout.station)!;
  const progress = Math.min(1, (Date.now() - workout.startedAt) / (GYM.setSeconds * 1000));
  return (
    <div className="gym-bar" role="status" aria-label="Workout">
      <span className="gym-bar-icon" aria-hidden>{station.icon}</span>
      <div className="gym-bar-body">
        <b>{station.verb}</b>
        <div className="gym-bar-track"><div className="gym-bar-fill" style={{ width: `${progress * 100}%` }} /></div>
      </div>
      <button onClick={() => useGymStore.getState().stop()}>Stop</button>
    </div>
  );
}
