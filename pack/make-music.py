# Procedural meditation tracks for Chánh Điện Tịnh Tâm. Everything is synthesized here: no samples, no copyright.
# usage: python3 pack/make-music.py OUT_DIR [track names]   → WAV files; encode to mp3 (128k, ~-13 LUFS) into assets/music
import sys, os
import numpy as np
from scipy.signal import oaconvolve, butter, sosfilt

SR = 44100
DUR = 180.0
N = int(SR * DUR)
t_all = np.arange(N) / SR

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

# Vietnamese ngũ cung (hò xự xang xê cống) ~ C D F G A
NGU_CUNG = [0, 2, 5, 7, 9]
def scale_notes(root, lo, hi, steps=NGU_CUNG):
    return [m for m in range(lo, hi + 1) if (m - root) % 12 in steps]

def env_adsr(n, a, r, sus=1.0):
    e = np.full(n, sus)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, sus, na) ** 2 if na < n else np.linspace(0, sus, n)[:na]
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e

def place(buf, sig, t0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(sig)] += sig * l
    buf[1, i:i + len(sig)] += sig * r

def lowpass(x, f, order=2): return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x, axis=-1)
def highpass(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x, axis=-1)
def bandpass(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x, axis=-1)

# ---------------------------------------------------------------- voices
def pad(rng, freqs, t0, dur, amp=0.12, bright=6, pan_spread=0.6):
    """warm chord: detuned additive saws with soft harmonic roll-off, slow swell"""
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros((2, n))
    for k, f in enumerate(freqs):
        for d, pan in ((-0.0022, -pan_spread), (0.0, 0.0), (0.0019, pan_spread)):
            s = np.zeros(n)
            ph = rng.uniform(0, 6.28)
            for h in range(1, bright + 1):
                s += np.sin(2 * np.pi * f * (1 + d) * h * t + ph * h) / h ** 1.6
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            out[0] += s * l; out[1] += s * r
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * t / rng.uniform(7, 13) + rng.uniform(0, 6))
    out *= env_adsr(n, dur * 0.35, dur * 0.4) * lfo * amp / (len(freqs) * 2)
    return out

def place2(buf, sig2, t0):
    i = int(t0 * SR)
    if i >= N: return
    m = min(sig2.shape[1], N - i)
    buf[:, i:i + m] += sig2[:, :m]

def bowl(rng, f, dur=22, amp=0.25):
    """singing bowl: inharmonic partials, each a beating pair, long decay"""
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, a, dec in ((1, 1, 1.0), (2.76, .55, 1.6), (5.4, .28, 2.6), (8.9, .12, 4.0)):
        beat = rng.uniform(0.6, 2.2)
        s += a * (np.sin(2 * np.pi * f * ratio * t) + np.sin(2 * np.pi * (f * ratio + beat) * t)) * np.exp(-t * dec * 3.2 / dur)
    strike = np.minimum(1, t / 0.004)
    return s * strike * amp / 2

def pluck(rng, f, amp=0.2, decay=2.2, bend=0.0):
    """đàn tranh-like pluck: bright decaying harmonics, optional nhấn (pitch bend down onto the note)"""
    dur = decay * 2.2
    n = int(dur * SR); t = np.arange(n) / SR
    pitch = f * (1 + bend * np.exp(-t * 9))
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    s = np.zeros(n)
    for h in range(1, 11):
        s += np.sin(h * phase * (1 + 0.0007 * h * h)) / h ** 1.25 * np.exp(-t * (1 + h * 0.55) / decay)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / 0.6)
    return s * np.minimum(1, t / 0.003) * amp * vib

def kalimba(rng, f, amp=0.18):
    n = int(3.5 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 1.4) + 0.35 * np.sin(2 * np.pi * f * 5.95 * t) * np.exp(-t * 9) \
        + 0.15 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 3)
    return s * np.minimum(1, t / 0.002) * amp

def flute(rng, f, dur, amp=0.16):
    """sáo trúc: soft sine with breath noise, vibrato that grows into the note"""
    n = int(dur * SR); t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.35) / 0.8, 0, 1)
    phase = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(phase) + 0.22 * np.sin(2 * phase) + 0.06 * np.sin(3 * phase)
    breath = bandpass(rng.standard_normal(n), f * 0.9, min(f * 3.5, 16000)) * 0.12
    e = env_adsr(n, 0.18, min(0.6, dur * 0.4))
    return (tone + breath) * e * amp

def drone(freq, amp=0.08, beat=0.15):
    s = np.sin(2 * np.pi * freq * t_all) + np.sin(2 * np.pi * (freq + beat) * t_all) + 0.4 * np.sin(2 * np.pi * freq * 2 * t_all)
    swell = 0.75 + 0.25 * np.sin(2 * np.pi * t_all / 23)
    return s * swell * amp / 2.4

def noise_bed(rng, kind, amp):
    w = rng.standard_normal((2, N))
    if kind == 'rain':
        x = bandpass(w, 900, 9000) * 0.6
        drops = np.zeros((2, N))
        for _ in range(int(DUR * 25)):
            i = rng.integers(0, N - 2000); c = rng.integers(0, 2)
            drops[c, i:i + 2000] += rng.uniform(.2, 1) * np.exp(-np.arange(2000) / 120) * rng.standard_normal(2000)
        x += highpass(drops, 1500) * 0.5
    elif kind == 'stream':
        x = bandpass(w, 250, 3500)
        x *= 0.7 + 0.3 * np.sin(2 * np.pi * t_all / 3.1 + np.array([[0], [1.3]])) * np.sin(2 * np.pi * t_all / 0.83)
    else:  # wind
        x = lowpass(w, 600)
        x *= 0.5 + 0.5 * np.sin(2 * np.pi * t_all / 17 + np.array([[0], [2]])) ** 2
    return x * amp

def reverb(x, secs=4.0, mix=0.35, seed=1):
    rng = np.random.default_rng(seed)
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t * 6.9 / secs)
    ir = lowpass(ir, 5000); ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    wet = np.stack([oaconvolve(x[c], ir[c])[:N] for c in range(2)])
    return x * (1 - mix) + wet * mix * 1.6

def melody_walk(rng, notes, length, start=None, rest_p=0.18):
    i = len(notes) // 2 if start is None else start
    out = []
    for _ in range(length):
        if rng.random() < rest_p: out.append(None); continue
        i = int(np.clip(i + rng.choice([-2, -1, -1, 0, 1, 1, 2]), 0, len(notes) - 1))
        out.append(notes[i])
    return out

# ---------------------------------------------------------------- tracks
def t_chuong_xoay(rng):
    b = np.zeros((2, N))
    root = 50  # D3
    b += drone(hz(root - 12), 0.10)
    t = 1.0
    bowls = [hz(m) for m in (root + 12, root + 19, root + 24, root + 17)]
    while t < DUR - 8:
        place(b, bowl(rng, rng.choice(bowls), dur=rng.uniform(18, 26), amp=0.22), t, rng.uniform(-.6, .6))
        t += rng.uniform(7, 12)
    for k, t0 in enumerate(np.arange(0, DUR, 30)):
        place2(b, pad(rng, [hz(root), hz(root + 7), hz(root + 12 + (5 if k % 2 else 4))], t0, 34, amp=0.08, bright=4), t0)
    return reverb(b, 5.5, 0.45, 2)

def t_dan_tranh(rng):
    b = noise_bed(rng, 'stream', 0.035)
    root = 55  # G3
    notes = scale_notes(root, 55, 79)
    t = 2.0
    while t < DUR - 6:
        phrase = melody_walk(rng, notes, rng.integers(5, 9), rest_p=0.12)
        for m in phrase:
            step = rng.choice([0.55, 0.8, 1.1, 1.6])
            if m is not None:
                place(b, pluck(rng, hz(m), 0.17, decay=rng.uniform(1.8, 2.8), bend=rng.choice([0, 0, 0, -0.06, 0.06])), t, rng.uniform(-.3, .3))
            t += step
        t += rng.uniform(2.5, 4.5)
    for t0 in np.arange(0, DUR, 24):
        place2(b, pad(rng, [hz(root - 12), hz(root - 5), hz(root)], t0, 28, amp=0.06, bright=3), t0)
    return reverb(b, 3.5, 0.32, 3)

def t_sao_truc(rng):
    b = noise_bed(rng, 'wind', 0.02)
    root = 57  # A3
    notes = scale_notes(root, 69, 88)
    chords = [[0, 7, 12], [-3, 4, 9], [5, 9, 12], [-5, 2, 7]]
    for k, t0 in enumerate(np.arange(0, DUR, 16)):
        c = chords[k % len(chords)]
        place2(b, pad(rng, [hz(root - 12 + x) for x in c], t0, 20, amp=0.11, bright=5), t0)
    t = 4.0
    while t < DUR - 8:
        for m in melody_walk(rng, notes, rng.integers(4, 7), rest_p=0.1):
            d = rng.choice([0.9, 1.4, 2.0, 2.8])
            if m is not None: place(b, flute(rng, hz(m), d * 1.05, 0.14), t, 0.1)
            t += d
        t += rng.uniform(4, 7)
    return reverb(b, 4.5, 0.4, 4)

def t_mua_rung_truc(rng):
    b = noise_bed(rng, 'rain', 0.05)
    root = 52  # E3
    for k, t0 in enumerate(np.arange(0, DUR, 20)):
        top = [12, 14, 16, 19][k % 4]
        place2(b, pad(rng, [hz(root - 12), hz(root - 5), hz(root + top - 12)], t0, 26, amp=0.09, bright=3), t0)
    t = 6.0
    while t < DUR - 10:
        place(b, bowl(rng, hz(root + rng.choice([12, 19, 24])), dur=20, amp=0.12), t, rng.uniform(-.5, .5))
        t += rng.uniform(16, 26)
    t = 3.0
    notes = scale_notes(root, 64, 83)
    while t < DUR - 6:
        place(b, kalimba(rng, hz(rng.choice(notes)), 0.07), t, rng.uniform(-.7, .7))
        t += rng.uniform(1.5, 5)
    return reverb(b, 4.0, 0.4, 5)

def t_binh_minh(rng):
    b = np.zeros((2, N))
    root = 53  # F3
    prog = [[0, 7, 12, 16], [-3, 4, 9, 12], [-7, 0, 5, 9], [-5, 2, 7, 14]]
    for k, t0 in enumerate(np.arange(0, DUR, 12)):
        place2(b, pad(rng, [hz(root + x) for x in prog[k % 4]], t0, 16, amp=0.13, bright=7), t0)
    b += drone(hz(root - 12), 0.05, 0.1)
    shimmer = highpass(rng.standard_normal((2, N)), 7000) * 0.006 * (0.5 + 0.5 * np.sin(2 * np.pi * t_all / 9))
    b += shimmer
    notes = scale_notes(root, 72, 89)
    t = 8.0
    while t < DUR - 6:
        place(b, kalimba(rng, hz(rng.choice(notes)), 0.06), t, rng.uniform(-.6, .6))
        t += rng.choice([3, 4.5, 6])
    return reverb(b, 6.0, 0.5, 6)

def t_ho_sen(rng):
    b = noise_bed(rng, 'stream', 0.018)
    root = 48  # C3
    notes = scale_notes(root, 60, 84)
    for t0 in np.arange(0, DUR, 22):
        place2(b, pad(rng, [hz(root), hz(root + 7), hz(root + 14)], t0, 26, amp=0.08, bright=4), t0)
    t = 2.0
    while t < DUR - 6:
        base = rng.integers(2, len(notes) - 6)
        arp = [notes[base], notes[base + 2], notes[base + 4], notes[base + 2]]
        for rep in range(rng.integers(2, 4)):
            for m in arp:
                place(b, kalimba(rng, hz(m), 0.11), t, rng.uniform(-.4, .4)); t += 0.62
        t += rng.uniform(3, 6)
    t = 15.0
    while t < DUR - 10:
        place(b, bowl(rng, hz(root + 24), dur=18, amp=0.08), t, 0); t += rng.uniform(30, 45)
    return reverb(b, 4.0, 0.38, 7)

TRACKS = [
    ('Chuong-xoay-tinh-tam', t_chuong_xoay, 11),
    ('Dan-tranh-suoi-mat', t_dan_tranh, 22),
    ('Sao-truc-dem-trang', t_sao_truc, 33),
    ('Mua-rung-truc', t_mua_rung_truc, 44),
    ('Binh-minh-dinh-nui', t_binh_minh, 55),
    ('Ho-sen-an-nhien', t_ho_sen, 66),
]

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    only = sys.argv[2:]
    for name, fn, seed in TRACKS:
        if only and name not in only: continue
        x = fn(np.random.default_rng(seed))
        x = highpass(x, 35)
        fade = np.ones(N); fi, fo = int(4 * SR), int(8 * SR)
        fade[:fi] = np.linspace(0, 1, fi) ** 2; fade[-fo:] = np.linspace(1, 0, fo) ** 2
        x = x * fade
        x = x / (np.abs(x).max() + 1e-9) * 0.89
        pcm = (np.clip(x.T, -1, 1) * 32767).astype('<i2')
        import wave
        with wave.open(os.path.join(out, name + '.wav'), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
        print('ok', name, flush=True)
