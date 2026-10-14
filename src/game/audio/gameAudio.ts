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

  // ---------- The Arena: a synthesised dance groove while you're inside at night ----------
  private beat: GainNode | null = null;
  private beatTimer: number | null = null;
  private bar = 0;
  private noise: AudioBuffer | null = null;
  /** Kick on every beat, shaker on the off-beats, a log-drum bassline and chord stabs (~112 BPM). */
  setParty(on: boolean) {
    const ctx = this.ctx, master = this.master, music = this.music;
    if (!ctx || !master || !music || on === (this.beatTimer !== null)) return;
    const t = ctx.currentTime;
    music.gain.cancelScheduledValues(t);
    music.gain.setValueAtTime(music.gain.value, t);
    music.gain.linearRampToValueAtTime(on ? MUSIC_LEVEL * 0.1 : MUSIC_LEVEL, t + 1);
    if (!on) {
      window.clearInterval(this.beatTimer!);
      this.beatTimer = null;
      return;
    }
    if (!this.beat) {
      this.beat = ctx.createGain();
      this.beat.gain.value = 0.2;
      this.beat.connect(master);
      this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const barSeconds = (60 / 112) * 4;
    const schedule = () => { if (ctx.state === 'running') this.playBar(ctx.currentTime + 0.1, barSeconds / 4); };
    schedule();
    this.beatTimer = window.setInterval(schedule, barSeconds * 1000);
  }
  private playBar(t0: number, beat: number) {
    const ctx = this.ctx!, out = this.beat!;
    const BASS = [[33, 33, 36, 31], [33, 33, 38, 36], [29, 29, 31, 33], [31, 31, 36, 38]][this.bar % 4];
    const STAB = [[57, 60, 64], [62, 65, 69], [53, 57, 60], [55, 59, 62]][this.bar++ % 4];
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * beat;
      // Kick: a falling sine thump.
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.32);
      // Shaker on the off-beat (and a ghost on the "a").
      for (const [off, peak] of [[0.5, 0.25], [0.75, 0.1]] as const) {
        const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), sg = ctx.createGain();
        src.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 6500; sg.gain.value = peak;
        src.connect(hp); hp.connect(sg); sg.connect(out); src.start(t + off * beat);
      }
      // Log drum: a short pitched bass note gliding down.
      const b = ctx.createOscillator(), bg = ctx.createGain();
      b.type = 'sine';
      b.frequency.setValueAtTime(midi(BASS[i] + 12), t + beat * 0.5);
      b.frequency.exponentialRampToValueAtTime(midi(BASS[i]), t + beat * 0.5 + 0.08);
      bg.gain.setValueAtTime(0.0001, t + beat * 0.5);
      bg.gain.exponentialRampToValueAtTime(0.5, t + beat * 0.5 + 0.01);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.5 + 0.35);
      b.connect(bg); bg.connect(out); b.start(t + beat * 0.5); b.stop(t + beat * 0.5 + 0.4);
    }
    // Chord stabs on beats 2 and 4.
    for (const k of [1, 3]) STAB.forEach((n) => this.voice(midi(n), t0 + k * beat, 0.35, 0.08, 'triangle', out));
  }
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
