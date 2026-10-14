import React from 'react';
import { Sheet } from './Sheet';
import { useGameStore } from '../stores/gameStore';
import { useInputStore } from '../stores/inputStore';
import { useGraphicsStore } from '../stores/graphicsStore';
import { PREF_LABELS, type QualityPref } from '../config/quality';

/** Choose how to move on a touch screen. Saved on this device. */
export function ControlsSheet() {
  const setModal = useGameStore((s) => s.setActiveModal);
  const mode = useInputStore((s) => s.controlMode);
  const setMode = useInputStore((s) => s.setControlMode);
  const { pref, tier, setPref } = useGraphicsStore();
  const options = [
    { id: 'tap' as const, icon: '👆', title: 'Tap to move', text: 'Tap anywhere on the ground and your character walks there. Keeps the screen clear.' },
    { id: 'joystick' as const, icon: '🕹️', title: 'Joystick', text: 'A stick at the bottom-left. Drag to walk, push to the edge to jog. More exact. Swipe the rest of the screen to look around.' },
  ];
  return (
    <Sheet title="Controls" subtitle="How do you want to move?" icon="🎮" accent="#10b981" onClose={() => setModal(null)}>
      <div className="academic-body">
        {options.map((o) => (
          <button key={o.id} type="button" className={`controls-option${mode === o.id ? ' is-on' : ''}`} aria-pressed={mode === o.id} onClick={() => setMode(o.id)}>
            <span>{o.icon}</span>
            <span><b>{o.title}{mode === o.id ? ' ✓' : ''}</b><small>{o.text}</small></span>
          </button>
        ))}
        <h3 className="academic-h" style={{ marginTop: 14 }}>Graphics</h3>
        <p className="academic-note">If the game lags or heats up your phone, pick Battery saver.{pref === 'auto' ? ` Auto is using “${PREF_LABELS[tier].title}” right now.` : ''}</p>
        {(['auto', 'low', 'medium', 'high'] as QualityPref[]).map((id) => (
          <button key={id} type="button" className={`controls-option${pref === id ? ' is-on' : ''}`} aria-pressed={pref === id} onClick={() => setPref(id)}>
            <span>{id === 'auto' ? '✨' : id === 'low' ? '🔋' : id === 'medium' ? '⚖️' : '🎨'}</span>
            <span><b>{PREF_LABELS[id].title}{pref === id ? ' ✓' : ''}</b><small>{PREF_LABELS[id].text}</small></span>
          </button>
        ))}
        <p className="academic-note">Sharpness (smooth edges) changes the next time you open the game.</p>
        <p className="academic-note">On a computer, use W A S D or the arrow keys (hold Shift to run).</p>
      </div>
    </Sheet>
  );
}
