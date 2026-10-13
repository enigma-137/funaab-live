import React, { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useHostelStore } from '../stores/hostelStore';
import { useStudentStore } from '../stores/studentStore';
import { useBackgroundStore } from '../stores/backgroundStore';
import { BACKGROUNDS, type BackgroundId } from '../config/backgrounds';

const naira = (n: number) => `₦${n.toLocaleString()}`;

/** Loads the background, collects weekly money from home, and asks once "where are you from?". */
export function BackgroundGate() {
  const { state, deferred, load } = useBackgroundStore();
  const activeModal = useGameStore((s) => s.activeModal);
  const setModal = useGameStore((s) => s.setActiveModal);
  const onCampus = useHostelStore((s) => s.roomId === 'world:funaab:main');
  const orientationLoaded = useStudentStore((s) => !!s.journey);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 600000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (state && !state.chosen && !deferred && !activeModal && onCampus && orientationLoaded) setModal('background');
  }, [state?.chosen, deferred, activeModal, onCampus, orientationLoaded]);
  return activeModal === 'background' ? <BackgroundChooser /> : null;
}

function BackgroundChooser() {
  const { busy, error, choose, defer } = useBackgroundStore();
  const setModal = useGameStore((s) => s.setActiveModal);
  const [pick, setPick] = useState<BackgroundId | null>(null);
  const later = () => { defer(); setModal(null); };
  const confirm = async () => { if (pick && (await choose(pick))) setModal(null); };
  return (
    <Sheet title="Where are you from?" subtitle="Your home background · private, chosen once" icon="🏠" accent="#d97706" onClose={later} closeOnBackdrop={false}
      footer={<div className="academic-footer"><button className="bg-later" onClick={later}>Maybe later</button><button className="academic-primary" disabled={!pick || busy} onClick={confirm}>That's me</button></div>}>
      <div className="academic-body">
        <p className="academic-note">Every home is different. This sets how much comes from home and how hard your hustle pays. Nobody else can see it.</p>
        <div role="radiogroup" aria-label="Home background" className="bg-options">
          {BACKGROUNDS.map((b) => (
            <button key={b.id} role="radio" aria-checked={pick === b.id} className={pick === b.id ? 'is-picked' : ''} onClick={() => setPick(b.id)}>
              <span className="bg-icon" aria-hidden>{b.icon}</span>
              <span className="bg-text">
                <b>{b.title}</b>
                <span>{b.blurb}</span>
                <span className="bg-stats">
                  {b.welcome > 0 ? `${naira(b.welcome)} now · ` : ''}{naira(b.weekly)} every Sunday{b.hustleBonusPercent ? ` · +${b.hustleBonusPercent}% on jobs` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
        {error && <p className="academic-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
