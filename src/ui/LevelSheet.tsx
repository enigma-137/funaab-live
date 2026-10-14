import React, { useEffect } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useLevelStore } from '../stores/levelStore';
import { XP_GUIDE, levelProgress } from '../config/levels';

export function LevelSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const { state, load } = useLevelStore();
  useEffect(() => { void load(); }, [load]);
  const p = state ? levelProgress(state.xp) : null;
  return (
    <Sheet title="Your Level" subtitle={p ? `Level ${p.level} · ${p.xp.toLocaleString()} XP` : 'Loading…'} icon="⭐" accent="#d97706" onClose={() => setModal(null)}>
      {!state || !p ? <p className="academic-body academic-note">Loading your level…</p> : (
        <div className="academic-body">
          <section className="academic-progress" aria-label="Progress to the next level">
            <div className="academic-progress-head"><b>Level {p.level}</b><span>{p.into}/{p.needed} XP to Level {p.level + 1}</span></div>
            <div className="academic-bar"><i style={{ width: `${Math.min(100, (p.into / p.needed) * 100)}%` }} /></div>
            <p className="academic-note">Today: <b>{state.today}/{state.cap} XP</b>{state.today >= state.cap ? ' — that’s the most for today. Come back tomorrow!' : ''}</p>
          </section>
          <section className="academic-card">
            <h3>Earn XP by playing</h3>
            <ul className="academic-checks">
              {XP_GUIDE.map((g) => <li key={g.label}>{g.icon} {g.label} <b>+{g.xp}</b></li>)}
            </ul>
          </section>
          <p className="academic-note">Everyone starts at Level 1 and moves up by what they do on campus, not by the calendar.</p>
        </div>
      )}
    </Sheet>
  );
}
