import { create } from 'zustand';

// Game sound, synthesised with the Web Audio API: a calm generative background pad plus a few
// soft effects. No audio files are shipped, so there is nothing to license or download.
// Browsers only allow audio after a user gesture, so the context starts on the first tap/key.

const STORAGE_KEY = 'funaab:sound';
const readSetting = (): boolean => {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { return true; }
};

interface SoundState {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  toggle: () => void;
}

export const useSoundStore = create<SoundState>()((set, get) => ({
  enabled: readSetting(),
  setEnabled: (on) => {
    try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
    set({ enabled: on });
    engine.apply(on);
  },
  toggle: () => get().setEnabled(!get().enabled),
}));

// Gentle chord loop (C major family) and a pentatonic for the occasional bell note.
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [
  [48, 55, 64, 71], // Cmaj7
  [45, 52, 60, 67], // Am7
  [41, 48, 57, 64], // Fmaj7
  [43, 50, 59, 65], // G7
];
const BELLS = [72, 74, 76, 79, 81, 84];
const CHORD_SECONDS = 7;
const MUSIC_LEVEL = 0.05;
const FX_LEVEL = 0.16;

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private fx: GainNode | null = null;
  private timer: number | null = null;
  private chord = 0;
  private unlocked = false;

  /** Create the audio graph on the first user gesture. */
  unlock() {
    if (this.unlocked || typeof window === 'undefined') return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.unlocked = true;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Music bus: lowpassed, with a soft feedback delay for space.
    this.music = ctx.createGain();
    this.music.gain.value = MUSIC_LEVEL;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    this.music.connect(lp);
    lp.connect(this.master);
    lp.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(this.master);

    this.fx = ctx.createGain();
    this.fx.gain.value = FX_LEVEL;
    this.fx.connect(this.master);

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.visibilityState === 'hidden') void this.ctx.suspend();
      else if (useSoundStore.getState().enabled) void this.ctx.resume();
    });
    this.apply(useSoundStore.getState().enabled);
  }

  /** Fade everything in or out and start/stop the music loop. */
  apply(on: boolean) {
    const ctx = this.ctx, master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(on ? 1 : 0, t + 0.6);
    if (on) {
      void ctx.resume();
      if (this.timer === null) {
        this.playChord();
        this.timer = window.setInterval(() => this.playChord(), CHORD_SECONDS * 1000);
      }
    } else {
      if (this.timer !== null) window.clearInterval(this.timer);
      this.timer = null;
      window.setTimeout(() => { if (!useSoundStore.getState().enabled) void ctx.suspend(); }, 700);
    }
  }

  private voice(freq: number, start: number, length: number, peak: number, type: OscillatorType, out: AudioNode) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(1.8, length * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain);
    gain.connect(out);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  private playChord() {
    const ctx = this.ctx, music = this.music;
    if (!ctx || !music || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.05;
    const notes = CHORDS[this.chord++ % CHORDS.length];
    notes.forEach((n, i) => {
      this.voice(midi(n), t + i * 0.06, CHORD_SECONDS + 1.5, i === 0 ? 0.5 : 0.28, i === 0 ? 'sine' : 'triangle', music);
    });
    // A couple of soft bell notes drifting over the pad.
    for (let k = 0; k < 2; k++) {
      if (Math.random() < 0.6) {
        const n = BELLS[Math.floor(Math.random() * BELLS.length)];
        this.voice(midi(n), t + 1.5 + Math.random() * (CHORD_SECONDS - 2.5), 2.6, 0.12, 'sine', music);
      }
    }
  }

  private blip(notes: number[], step: number, length: number, type: OscillatorType = 'sine', peak = 0.5) {
    const ctx = this.ctx, fx = this.fx;
    if (!ctx || !fx || !useSoundStore.getState().enabled || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01;
    notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = midi(n);
      gain.gain.setValueAtTime(0.0001, t + i * step);
      gain.gain.exponentialRampToValueAtTime(peak, t + i * step + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * step + length);
      osc.connect(gain);
      gain.connect(fx);
      osc.start(t + i * step);
      osc.stop(t + i * step + length + 0.05);
    });
  }

  /** New private message. */
  chime() { this.blip([79, 84], 0.12, 0.6); }
  /** Money arrived in the wallet. */
  coin() { this.blip([83, 88], 0.07, 0.25, 'triangle', 0.4); }
  /** Something good (goal, success). */
  success() { this.blip([72, 76, 79, 84], 0.08, 0.35, 'triangle', 0.45); }
  /** Something missed (save, miss). */
  soft() { this.blip([60, 55], 0.13, 0.4, 'sine', 0.35); }
}

export const engine = new GameAudio();
export const gameSound = {
  chime: () => engine.chime(),
  coin: () => engine.coin(),
  success: () => engine.success(),
  soft: () => engine.soft(),
};

/** Start audio on the first gesture anywhere on the page. */
export function installAudioUnlock() {
  if (typeof window === 'undefined') return;
  const go = () => {
    engine.unlock();
    window.removeEventListener('pointerdown', go);
    window.removeEventListener('keydown', go);
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}
