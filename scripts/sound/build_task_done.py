#!/usr/bin/env python3
"""
Renders the sound a finished task makes: src/assets/sounds/task-done.wav.      python3 scripts/sound/build_task_done.py
Pure Python, no libraries; 48 kHz, 24-bit. Every number below can be tuned by ear.

The brief: short, dry (no echo, ever), never harsh, and it must feel expensive. Expensive interface sounds are not loud or
long — they are *layered*: several quiet, precise things that the ear hears as one object. This one is five layers:

  1. The body — two felt-mallet marimba bars, D5 then A5 (a rising fifth: open, resolved, "done"), modelled on a real
     bar's vibration modes (1 : 4 : 10) so they are round and woody. Each strike starts a few cents sharp and settles in
     30 ms, as a struck bar really does; that tiny settle is much of what makes it sound physical rather than synthetic.
  2. The jewel — over each note, a soft glass-like partial an octave up that blooms and fades quickly: the sheen.
  3. The colour — a whisper of E6 just after the second note, making the pair a D-add9: the open, "premium" chord colour
     used by high-end product sounds. It is quiet enough to be felt more than heard.
  4. The touch — a 5 ms felt tap, filtered dark, under the first note: the sense of a real thing being pressed.
  5. The air — a breath of band-limited noise that swells and vanishes in 120 ms, giving it space without any echo.

Width comes from pairs of voices a couple of cents apart (left and right), never from delays. Nothing above ~3.5 kHz
carries any real energy. Every layer decays to silence on its own, and the last 300 ms also ease to exact zero, so it
never stops — it finishes. Mastered to -7 dBFS peak; the app plays it at a modest volume on top.
"""
import math, os, random, struct, wave

SR = 48000
TAU = 2 * math.pi
LENGTH = 0.95
N = int(SR * LENGTH)

def gains(pan):
    a = (pan + 1) * math.pi / 4
    return math.cos(a), math.sin(a)

def raised(t, attack):
    return 0.5 - 0.5 * math.cos(math.pi * min(1.0, t / attack))

def bar(freq, start, amp, decay, L, R, spread=0.4, cents=2.2):
    """Felt-mallet bar, two voices a few cents apart, each strike settling from a little sharp."""
    modes = ((1.0, 1.0, decay), (4.0, 0.06, decay * 0.18), (9.92, 0.008, decay * 0.05))
    first = int(start * SR)
    for pan, detune in ((-spread, 1 - cents / 1200), (spread, 1 + cents / 1200)):
        gl, gr = gains(pan)
        f = freq * detune
        bend, bend_tau = 0.0045, 0.03                       # starts ~8 cents sharp, settles in ~30 ms
        for i in range(first, N):
            t = (i - first) / SR
            warp = t + bend * bend_tau * (1 - math.exp(-t / bend_tau))
            s = sum(g * math.exp(-t / d) * math.sin(TAU * f * r * warp) for r, g, d in modes)
            v = 0.5 * amp * raised(t, 0.006) * s
            L[i] += v * gl
            R[i] += v * gr
            if t > decay * 9:
                break

def jewel(freq, start, amp, decay, pan, L, R):
    """A glassy partial (an octave up, a hair inharmonic) that blooms in 3 ms and fades quickly."""
    gl, gr = gains(pan)
    first = int(start * SR)
    for i in range(first, N):
        t = (i - first) / SR
        v = amp * raised(t, 0.003) * math.exp(-t / decay) * math.sin(TAU * freq * 2.003 * t)
        L[i] += v * gl
        R[i] += v * gr
        if t > decay * 9:
            break

def biquad_bandpass(x, f0, q):
    w = TAU * f0 / SR
    alpha = math.sin(w) / (2 * q)
    b0, b2 = alpha, -alpha
    a0, a1, a2 = 1 + alpha, -2 * math.cos(w), 1 - alpha
    b0, b2, a1, a2 = b0 / a0, b2 / a0, a1 / a0, a2 / a0
    y, x1, x2, y1, y2 = [], 0.0, 0.0, 0.0, 0.0
    for v in x:
        o = b0 * v + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, o
        y.append(o)
    return y

def touch(start, amp, L, R):
    """A 5 ms felt tap: noise, low-passed dark."""
    rnd = random.Random(11)
    first, lp = int(start * SR), 0.0
    for i in range(first, first + int(0.02 * SR)):
        t = (i - first) / SR
        lp += 0.12 * (rnd.uniform(-1, 1) - lp)
        v = amp * lp * raised(t, 0.0008) * math.exp(-t / 0.005)
        L[i] += v
        R[i] += v

def air(start, amp, L, R):
    """A breath: band-limited noise (around 1.8 kHz) that swells and is gone in ~120 ms. Different noise per side."""
    first, n = int(start * SR), int(0.16 * SR)
    for ch, seed in ((L, 3), (R, 5)):
        rnd = random.Random(seed)
        band = biquad_bandpass([rnd.uniform(-1, 1) for _ in range(n)], 1800, 0.9)
        for k in range(n):
            t = k / SR
            env = raised(t, 0.03) * math.exp(-t / 0.035)
            ch[first + k] += amp * env * band[k]

def master(L, R, peak_db=-7.0, k=0.5, tail=0.3):
    """Soften the very top (one-pole low-pass ~5.5 kHz at 48 kHz), ease the tail to exact zero, set the peak."""
    def lowpass(x):
        y, out = 0.0, []
        for v in x:
            y += k * (v - y)
            out.append(y)
        return out
    L, R = lowpass(L), lowpass(R)
    f = int(tail * SR)
    for ch in (L, R):
        for i in range(f):
            w = i / f
            ch[N - 1 - i] *= w * w * (3 - 2 * w)
    peak = max(max(abs(v) for v in L), max(abs(v) for v in R))
    g = (10 ** (peak_db / 20)) / peak
    return [v * g for v in L], [v * g for v in R]

def main():
    L, R = [0.0] * N, [0.0] * N
    touch(0.000, 0.10, L, R)
    air(0.000, 0.018, L, R)
    bar(587.33, 0.000, 0.55, 0.115, L, R)          # D5
    jewel(587.33, 0.002, 0.05, 0.06, -0.3, L, R)
    bar(880.00, 0.090, 0.70, 0.155, L, R)          # A5
    jewel(880.00, 0.092, 0.06, 0.07, 0.3, L, R)
    bar(1318.51, 0.150, 0.11, 0.12, L, R, spread=0.6)   # E6, the add9 whisper
    L, R = master(L, R)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'assets', 'sounds', 'task-done.wav')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
        def s24(v):
            return int(max(-1.0, min(1.0, v)) * 8388607).to_bytes(3, 'little', signed=True)
        w.writeframes(b''.join(s24(l) + s24(r) for l, r in zip(L, R)))
    print('wrote', os.path.normpath(out), f'({os.path.getsize(out) // 1024} KB, {LENGTH}s, 48 kHz / 24-bit)')

if __name__ == '__main__':
    main()
