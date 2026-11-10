#!/usr/bin/env python3
"""
Renders the sound a finished task makes: src/assets/sounds/task-done.wav.      python3 scripts/sound/build_task_done.py
Pure Python, no libraries, so every number below can be tuned by ear.

What it is, and why (the aim: a reward that is small, certain, and that the ear never has to brace for):

  * Short and dry. About half a second you actually hear, and no reverb or echo at all — an echo is the first thing that
    makes a repeated sound tiring. Nothing is delayed; it is just two notes.
  * Two soft notes rising a fifth, D5 -> A5, the second a touch later (90 ms) and a touch longer. Up reads as "done,
    forward"; a fifth is open and stable, with no tension to resolve. It sits in the ear's most comfortable range and
    has almost no energy above 3 kHz, which is what makes chimes harsh.
  * The timbre is a felt-mallet marimba bar modelled by its real vibration modes (1 : 4 : 10), so it is round and woody,
    not metallic. A 6 ms soft attack: no click, no tick.
  * It is fuller than a single tone without any echo: each note is two voices a couple of cents apart, one a little left
    and one a little right (width, and a gentle shimmer), plus a very quiet low thump under the strike for body.
  * It ends by dying away, never by stopping: every note decays smoothly to well under -70 dB, and the last 350 ms also
    fades by a smooth curve, so the file's final samples are silence. (A clip that is still audible when it ends is
    what produces the abrupt "cut".)
  * Mastered to -7 dBFS peak; the app plays it at a modest volume on top.
"""
import math, os, struct, wave

SR = 44100
TAU = 2 * math.pi
LENGTH = 0.9                       # seconds; the last 350 ms are the tail
N = int(SR * LENGTH)

def gains(pan):
    a = (pan + 1) * math.pi / 4
    return math.cos(a), math.sin(a)

def bar(freq, start, amp, decay, L, R, spread=0.35, cents=2.5):
    """A felt-mallet marimba bar, as two voices a few cents apart, one leaning left and one right."""
    modes = ((1.0, 1.0, decay), (4.0, 0.07, decay * 0.20), (9.9, 0.010, decay * 0.05))
    first = int(start * SR)
    for pan, detune in ((-spread, 1 - cents / 1200), (spread, 1 + cents / 1200)):
        gl, gr = gains(pan)
        f = freq * detune
        for i in range(first, N):
            t = (i - first) / SR
            attack = 0.5 - 0.5 * math.cos(math.pi * min(1.0, t / 0.006))      # raised cosine: no click
            s = sum(g * math.exp(-t / d) * math.sin(TAU * f * r * t) for r, g, d in modes)
            v = 0.5 * amp * attack * s
            L[i] += v * gl
            R[i] += v * gr
            if t > decay * 8:
                break

def thump(freq, start, amp, L, R):
    """A very quiet low pulse under the strike, for body."""
    first = int(start * SR)
    for i in range(first, N):
        t = (i - first) / SR
        a = (0.5 - 0.5 * math.cos(math.pi * min(1.0, t / 0.012))) * math.exp(-t / 0.045)
        v = amp * a * math.sin(TAU * freq * t)
        L[i] += v
        R[i] += v
        if t > 0.4:
            break

def master(L, R, peak_db=-7.0, k=0.55, tail=0.35):
    """Soften the top (one-pole low-pass, ~5 kHz), fade the tail to true silence, set the peak."""
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
            ch[N - 1 - i] *= w * w * (3 - 2 * w)      # smoothstep: eases to exactly zero
    peak = max(max(abs(v) for v in L), max(abs(v) for v in R))
    g = (10 ** (peak_db / 20)) / peak
    return [v * g for v in L], [v * g for v in R]

def main():
    L, R = [0.0] * N, [0.0] * N
    thump(146.83, 0.000, 0.05, L, R)                    # D3
    bar(587.33, 0.000, 0.55, 0.115, L, R)               # D5
    bar(880.00, 0.090, 0.70, 0.150, L, R)               # A5
    L, R = master(L, R)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'assets', 'sounds', 'task-done.wav')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<hh', int(l * 32767), int(r * 32767)) for l, r in zip(L, R)))
    print('wrote', os.path.normpath(out), f'({os.path.getsize(out) // 1024} KB, {LENGTH}s)')

if __name__ == '__main__':
    main()
