#!/usr/bin/env python3
"""
Renders the sound a finished task makes.
    python3 scripts/sound/build_task_done.py [felt|bowl] [--out PATH]
With no argument it renders the chosen one (`felt`) to src/assets/sounds/task-done.wav. Pure Python, no libraries, so every
number can be tuned by ear.

What it is, and why (the aim: a reward that is certain and small, and that the ear never has to brace for):

  * Open, rising notes. A stack of fifths (A4 - E5 - B5) climbing in three soft steps: up reads as "done, forward";
    fifths are stable and open — no tension to resolve, nothing sweet or sharp. It lives between 440 Hz and 1 kHz, the
    range the ear finds most comfortable. High, bright sounds (above ~2 kHz) are what make a chime irritating, so there
    is almost no energy up there.
  * The timbre is a felt-mallet vibraphone bar, modelled by its real vibration modes (1 : 4 : 10) rather than by added
    harmonics: round and woody, with no metallic ring. A 9 ms soft attack (no click, no tick) so it is never startling.
  * A slow, dark "bloom" underneath (A3/E4, 250 ms to swell): the breath that makes a short sound feel satisfying.
  * A long, soft room (eight damped combs, four all-passes, different on each side) so it ends by dissolving, not stopping.
  * Quiet: mastered to -9 dBFS peak, and the app plays it at a modest volume on top.

`bowl` is the calmer alternative: one glass-bowl note (E5) whose two slightly detuned strings beat slowly.
"""
import math, os, struct, sys, wave

SR = 44100
TAU = 2 * math.pi

def new(length):
    n = int(SR * length)
    return n, [0.0] * n, [0.0] * n

def pan_gains(pan):
    a = (pan + 1) * math.pi / 4
    return math.cos(a), math.sin(a)

def bar(freq, start, amp, decay, pan, L, R, attack=0.009):
    """A felt-mallet vibraphone bar: modes at 1 : 4 : 10, the upper ones quieter and much shorter-lived."""
    gl, gr = pan_gains(pan)
    n = len(L)
    first = int(start * SR)
    modes = ((1.0, 1.0, decay), (4.0, 0.085, decay * 0.22), (10.0, 0.012, decay * 0.06))
    for i in range(first, n):
        t = (i - first) / SR
        a = 0.5 - 0.5 * math.cos(math.pi * min(1.0, t / attack))          # raised-cosine: no click
        s = sum(g * math.exp(-t / d) * math.sin(TAU * freq * r * t) for r, g, d in modes)
        v = amp * a * s
        L[i] += v * gl
        R[i] += v * gr
        if t > decay * 6:
            break

def bloom(freq, start, amp, rise, decay, L, R):
    first = int(start * SR)
    for i in range(first, len(L)):
        t = (i - first) / SR
        v = amp * (1 - math.exp(-t / rise)) * math.exp(-t / decay) * math.sin(TAU * freq * t)
        L[i] += v
        R[i] += v

def glass(freq, start, amp, decay, pan, L, R):
    """A glass bowl: two strings a little apart (so it slowly shimmers), a soft inharmonic mode, a slow attack."""
    gl, gr = pan_gains(pan)
    first = int(start * SR)
    for i in range(first, len(L)):
        t = (i - first) / SR
        a = 0.5 - 0.5 * math.cos(math.pi * min(1.0, t / 0.04))
        body = math.exp(-t / decay)
        s = (math.sin(TAU * freq * t) + math.sin(TAU * (freq + 0.65) * t)) * 0.5
        s += 0.16 * math.sin(TAU * freq * 2.71 * t) * math.exp(-t / (decay * 0.35))
        s += 0.03 * math.sin(TAU * freq * 5.2 * t) * math.exp(-t / (decay * 0.12))
        v = amp * a * body * s
        L[i] += v * gl
        R[i] += v * gr
        if t > decay * 6:
            break

def room(dry_l, dry_r, wet, predelay=0.018, rt=1.5):
    """Eight damped combs and four all-passes per side (different delays each side), darker with every pass."""
    n = len(dry_l)
    def side(src, delays, aps):
        out = [0.0] * n
        for d in delays:
            g = 10 ** (-3 * d / (rt * SR))     # feedback that gives the chosen decay time
            buf, damp, pos = [0.0] * d, 0.0, 0
            for i in range(n):
                y = buf[pos]
                damp += 0.30 * (y - damp)
                buf[pos] = src[i] + g * damp
                out[i] += y * 0.125
                pos = (pos + 1) % d
        for d in aps:
            buf, pos = [0.0] * d, 0
            for i in range(n):
                x = out[i]
                y = buf[pos]
                buf[pos] = x + 0.5 * y
                out[i] = y - 0.5 * x
                pos = (pos + 1) % d
        return out
    pd = int(predelay * SR)
    pad = [0.0] * pd
    wl = side(pad + dry_l[:n - pd], (1687, 1747, 1823, 1901, 1999, 2053, 2137, 2213), (347, 113, 37, 211))
    wr = side(pad + dry_r[:n - pd], (1699, 1759, 1831, 1913, 2011, 2063, 2143, 2221), (359, 127, 41, 223))
    return [a + wet * b for a, b in zip(dry_l, wl)], [a + wet * b for a, b in zip(dry_r, wr)]

def master(L, R, peak_db=-9.0, k=0.5, fade=0.2):
    """Soften the top (one-pole low-pass ~4.5 kHz), fade out, set the peak."""
    def lowpass(x):
        y, out = 0.0, []
        for v in x:
            y += k * (v - y)
            out.append(y)
        return out
    L, R = lowpass(L), lowpass(R)
    n, f = len(L), int(fade * SR)
    for ch in (L, R):
        for i in range(f):
            w = i / f
            ch[n - 1 - i] *= w * w * (3 - 2 * w)      # smoothstep
    peak = max(max(abs(v) for v in L), max(abs(v) for v in R))
    g = (10 ** (peak_db / 20)) / peak
    return [v * g for v in L], [v * g for v in R]

def felt():
    n, L, R = new(2.2)
    bloom(220.00, 0.00, 0.040, 0.25, 0.55, L, R)     # A3
    bloom(329.63, 0.05, 0.030, 0.28, 0.50, L, R)     # E4
    bar(440.00, 0.00, 0.62, 0.55, -0.30, L, R)        # A4
    bar(659.25, 0.15, 0.62, 0.62, 0.00, L, R)         # E5
    bar(987.77, 0.31, 0.58, 0.78, 0.30, L, R)         # B5
    L, R = room(L, R, wet=0.34)
    return master(L, R)

def bowl():
    n, L, R = new(2.6)
    bloom(164.81, 0.00, 0.035, 0.30, 0.80, L, R)     # E3
    glass(659.25, 0.00, 0.60, 0.95, -0.12, L, R)      # E5
    glass(987.77, 0.20, 0.30, 0.80, 0.18, L, R)       # B5, a quiet fifth above
    L, R = room(L, R, wet=0.38, rt=1.9)
    return master(L, R, peak_db=-10.0, fade=0.3)

def write(path, L, R):
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<hh', int(l * 32767), int(r * 32767)) for l, r in zip(L, R)))

if __name__ == '__main__':
    args = sys.argv[1:]
    variant = next((a for a in args if a in ('felt', 'bowl')), 'felt')
    here = os.path.dirname(os.path.abspath(__file__))
    out = args[args.index('--out') + 1] if '--out' in args else os.path.join(here, '..', '..', 'src', 'assets', 'sounds', 'task-done.wav')
    left, right = {'felt': felt, 'bowl': bowl}[variant]()
    write(out, left, right)
    print(f'{variant}: wrote {os.path.normpath(out)} ({os.path.getsize(out) // 1024} KB, {len(left) / SR:.1f}s)')
