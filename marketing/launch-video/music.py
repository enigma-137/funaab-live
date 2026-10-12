"""Original 120 BPM afrobeats-style bed for the FUNAAB Life launch video (numpy only)."""
import numpy as np, wave, sys
SR = 44100; BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
TOTAL = float(sys.argv[1]) if len(sys.argv) > 1 else 48.5
INTRO_END = 4.0            # drums drop when gameplay starts
BREAK = (22.0, 24.0)       # half-time breakdown for the "stay off the lawn" gag
OUTRO = TOTAL - 5.0        # last 5 s: outro card
N = int(SR * (TOTAL + 1.5))
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i >= N: return
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

def env(n, a=0.002, d=0.3):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)

def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.16) * 1.1

def clap():
    n = int(0.25 * SR); x = rng.standard_normal(n)
    x = np.diff(x, prepend=0)  # crude highpass
    e = env(n, 0.001, 0.06) + 0.5 * np.concatenate([np.zeros(int(0.012 * SR)), env(n - int(0.012 * SR), 0.001, 0.05)])
    return x * e * 0.35

def shaker(acc):
    n = int(0.07 * SR); x = np.diff(np.diff(rng.standard_normal(n + 2)))
    return x[:n] * env(n, 0.004, 0.018) * (0.10 if acc else 0.05)

def tone(freq, dur, harm, decay, a=0.003):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(amp * np.sin(2 * np.pi * freq * k * t) * np.exp(-t * (k ** 0.5) / decay) for k, amp in harm)
    return s * np.minimum(1, t / a)

def kalimba(freq): return tone(freq, 0.9, [(1, 1.0), (2.0, 0.08), (5.4, 0.12)], 0.32) * 0.22
def logdrum(freq):
    n = int(0.5 * SR); t = np.arange(n) / SR
    f = freq * (1 + 0.6 * np.exp(-t * 40))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return np.tanh(1.6 * s * env(n, 0.002, 0.22)) * 0.42
def pad(freqs, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * 0.3 * t)) + 0.3 * np.sin(2 * np.pi * 2 * f * t) for f in freqs)
    shape = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.5)
    return s * shape * 0.035

def hz(m): return 440 * 2 ** ((m - 69) / 12)
# vi-IV-I-V in C: Am F C G
chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
bass = [45, 41, 48, 43]
arp_steps = [0, 1, 2, 1, 2, 0, 1, 2]  # 8ths

bars = int(np.ceil(TOTAL / BAR)) + 1
for b in range(bars):
    t0 = b * BAR; ch = chords[b % 4]
    if t0 >= TOTAL: break
    in_outro = t0 >= OUTRO
    add(pad([hz(m) for m in ch], BAR + 0.3), t0, 1.0 if not in_outro else 0.8)
    for i, step in enumerate(arp_steps):
        tt = t0 + i * BEAT / 2
        if tt >= TOTAL - 0.2: break
        up = 12 if (i in (3, 6) and b % 2) else 0
        add(kalimba(hz(ch[step] + 12 + up)), tt, 0.9, pan=0.35 if i % 2 else -0.35)
    drums = INTRO_END - 0.01 <= t0 < OUTRO
    half = BREAK[0] <= t0 < BREAK[1]
    if drums:
        for beat in range(4):
            bt = t0 + beat * BEAT
            if bt >= OUTRO - 0.01: break
            if not half or beat == 0: add(kick(), bt, 0.9)
            if beat in (1, 3) and not half: add(clap(), bt, 1.0)
            for s16 in range(4):
                st = bt + s16 * BEAT / 4 + (0.012 if s16 % 2 else 0)
                if not half: add(shaker(s16 == 2), st, 1.0, pan=0.25)
        if not half and t0 + BAR <= OUTRO + 0.01:
            add(kick(), t0 + 2.5 * BEAT, 0.6)  # afro syncopation
            for pos, oct_ in [(0, 0), (0.75, 0), (1.5, 12), (2.5, 0), (3.25, 7)]:
                add(logdrum(hz(bass[b % 4] + oct_ - 12 + 12)), t0 + pos * BEAT, 0.9)
    elif b * BAR < INTRO_END:
        # intro: soft log drum pulse on beat 1
        add(logdrum(hz(bass[b % 4])), t0, 0.35)

# Riser into the drop and into the outro
def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.diff(rng.standard_normal(n + 1)) * (t / dur) ** 2 * 0.25
    return x
add(riser(1.5), INTRO_END - 1.5, 0.8); add(riser(2.0), OUTRO - 2.0, 0.9)
# Final hit on the outro
add(kick(), OUTRO, 1.0); add(logdrum(hz(45)), OUTRO, 0.8); add(pad([hz(m) for m in [57, 60, 64, 69]], 4.5), OUTRO, 1.6)

mix = np.stack([L, R], 1)[: int(TOTAL * SR)]
fade = int(1.5 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
mix = np.tanh(mix / np.abs(mix).max() * 1.4) * 0.89
with wave.open('music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote music.wav', TOTAL, 's')
