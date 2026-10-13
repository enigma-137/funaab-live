import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { useSoundStore } from '../game/audio/gameAudio';
import { AppTile } from './phoneIcons';

/** Quick mute/unmute, stacked under the feedback launcher. The choice is remembered on this device. */
export function SoundToggle() {
  const activeModal = useGameStore((s) => s.activeModal);
  const user = useAuthStore((s) => s.user);
  const enabled = useSoundStore((s) => s.enabled);
  const toggle = useSoundStore((s) => s.toggle);
  if (!user || activeModal) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Mute game sound' : 'Turn game sound on'}
      title={enabled ? 'Sound on' : 'Sound off'}
      className="campus-launcher-mini flex h-10 w-10 items-center justify-center rounded-xl border border-[#c7d6c9] bg-[#f8faf7] shadow-lg transition active:scale-95"
    >
      <AppTile glyph={enabled ? 'soundOn' : 'soundOff'} colors={enabled ? ['#818cf8', '#4338ca'] : ['#94a3b8', '#475569']} />
    </button>
  );
}
