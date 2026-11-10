#!/usr/bin/env python3
"""
Renders the sound a finished task makes: src/assets/sounds/task-done.wav.   python3 scripts/sound/build_task_done.py

Pure Python (no libraries), so it runs anywhere and every number below can be tuned by ear. What it is made of, and why:

  * A small rising interval, G5 -> D6 (a perfect fifth). A rise reads as "up, forward, done"; a fifth is open and
    resolved without the sweetness of a major third or the brashness of an octave. Two notes only, so it is a
    confirmation, not a fanfare — rewards that are short and certain are the ones that never get tiresome.
  * The second note is a little louder and lands 120 ms after the first: the ear hears the arrival, not the start.
  * Each note is a soft pluck (sine body, a quiet 2nd harmonic, a trace of wood in the first milliseconds) — warm,
    with no metallic ringing and no harsh edge. 4 ms attack so nothing clicks; a 9 ms filtered tick gives the
    tactile "press" feeling of the tick being ticked.
  * Underneath, a very quiet G3/D4 swell: the low "weight" that makes a small sound feel satisfying rather than thin.
  * The two notes sit slightly left and right, and a short, dark reverb lets it bloom into the room and end by itself.
  * Everything is low-passed at 7 kHz and mastered to -3 dBFS peak; the app plays it at a modest volume on top of that.
"""
import math, random, struct, wave, os

SR = 44100
LENGTH = 1.5  # seconds, including the tail
N = int(SR * LENGTH)
TAU = 2 * math.pi

def pluck(freq, start, amp, decay, pan, left, right):
    """A warm pluck: sine body + soft 2nd harmonic + a short inharmonic 'wood' strike."""
    first = int(start * SR)
    gl, gr = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    for i in range(first, N):
        t = (i - first) / SR
        attack = min(1.0, t / 0.004)
        body = math.exp(-t / decay)
        s = math.sin(TAU * freq * t) * body
        s += 0.22 * math.sin(TAU * freq * 2 * t) * math.exp(-t / (decay * 0.55))
        s += 0.05 * math.sin(TAU * freq * 3.01 * t) * math.exp(-t / (decay * 0.3))
        s += 0.09 * math.sin(TAU * freq * 3.9 * t) * math.exp(-t / 0.035)   # the wood
        v = amp * attack * s
        left[i] += v * gl
        right[i] += v * gr
        if body < 0.0008:
            break

def swell(freq, start, amp, rise, decay, left, right):
    first = int(start * SR)
    for i in range(first, N):
        t = (i - first) / SR
        v = amp * (1 - math.exp(-t / rise)) * math.exp(-t / decay) * math.sin(TAU * freq * t)
        left[i] += v
        right[i] += v

def tick(start, amp, left, right):
    """The press: a few ms of noise, filtered dark."""
    rnd = random.Random(7)
    first = int(start * SR)
    lp = 0.0
    for i in range(first, first + int(0.009 * SR)):
        t = (i - first) / SR
        lp += 0.18 * (rnd.uniform(-1, 1) - lp)
        v = amp * lp * math.exp(-t / 0.002)
        left[i] += v
        right[i] += v

def reverb(dry_l, dry_r, wet=0.24, predelay=0.012):
    """A small Schroeder room: four damped combs and two all-passes per side, the right side a touch different."""
    def side(src, offset):
        out = [0.0] * N
        for delay, g in ((1557, 0.80), (1617, 0.79), (1491, 0.81), (1422, 0.80)):
            d = delay + offset
            buf, damp, pos = [0.0] * d, 0.0, 0
            for i in range(N):
                x = src[i]
                y = buf[pos]
                damp += 0.35 * (y - damp)       # darker with every pass
                buf[pos] = x + g * damp
                out[i] += y * 0.25
                pos = (pos + 1) % d
        for delay, g in ((225 + offset, 0.5), (556 + offset, 0.5)):
            buf, pos = [0.0] * delay, 0
            for i in range(N):
                x = out[i]
                y = buf[pos]
                buf[pos] = x + g * y
                out[i] = y - g * x
                pos = (pos + 1) % delay
        return out
    pd = int(predelay * SR)
    wl = side([0.0] * pd + dry_l[:N - pd], 0)
    wr = side([0.0] * pd + dry_r[:N - pd], 23)
    return [a + wet * b for a, b in zip(dry_l, wl)], [a + wet * b for a, b in zip(dry_r, wr)]

def master(left, right):
    """Dark-ish low-pass, a hair of soft saturation for cohesion, a 90 ms fade, then -3 dBFS."""
    def lowpass(x, k=0.62):
        y, out = 0.0, []
        for v in x:
            y += k * (v - y)
            out.append(y)
        return out
    left, right = lowpass(left), lowpass(right)
    fade = int(0.09 * SR)
    for ch in (left, right):
        for i in range(N):
            ch[i] = math.tanh(1.1 * ch[i])
        for i in range(fade):
            ch[N - 1 - i] *= i / fade
    peak = max(max(abs(v) for v in left), max(abs(v) for v in right))
    gain = (10 ** (-3 / 20)) / peak
    return [v * gain for v in left], [v * gain for v in right]

def main():
    left, right = [0.0] * N, [0.0] * N
    tick(0.000, 0.10, left, right)
    swell(196.00, 0.00, 0.045, 0.10, 0.34, left, right)   # G3
    swell(293.66, 0.02, 0.030, 0.12, 0.30, left, right)   # D4
    pluck(783.99, 0.000, 0.50, 0.30, -0.25, left, right)   # G5
    pluck(1174.66, 0.120, 0.62, 0.38, 0.25, left, right)   # D6
    left, right = reverb(left, right)
    left, right = master(left, right)
    out = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'sounds', 'task-done.wav')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<hh', int(l * 32767), int(r * 32767)) for l, r in zip(left, right)))
    print('wrote', os.path.normpath(out), f'({os.path.getsize(out) // 1024} KB, {LENGTH}s)')

if __name__ == '__main__':
    main()
