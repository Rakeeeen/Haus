/**
 * Plays short synthesized notes with the Web Audio API — no sound files. A note is a soft sine with a quiet octave and a
 * touch of a twelfth above it (the roundness of a glass or a marimba rather than a bell), a quick attack and a long
 * smooth fade, through a gentle room reverb so it doesn't sound dry. Nothing here knows what the notes are for.
 *
 * Browsers only let a page make sound after the person has touched it: `unlockAudio()` is called from the first
 * pointer/key event, and until then a chime is simply skipped (never queued to blare later).
 */
export interface Note { at: number; hz: number; length: number; gain: number }

const KEY = 'haus_sound';

let context: AudioContext | null = null;
let bus: { input: GainNode } | null = null;

export function isSoundOn(): boolean {
  try { return window.localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundOn(on: boolean) {
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* not remembered, still applied now */ }
}

/** A short, dark room: stereo noise that dies away smoothly. */
function impulse(ctx: AudioContext, seconds = 1.6): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
  }
  return buffer;
}

function buildBus(ctx: AudioContext) {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0.85;
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx);
  // A soft limiter, so two notes together never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 24;
  limiter.ratio.value = 6;
  input.connect(dry).connect(limiter);
  input.connect(room).connect(wet).connect(limiter);
  limiter.connect(ctx.destination);
  return { input };
}

/** Call from a user gesture (a click, a key): makes the audio context and wakes it if the browser put it to sleep. */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!context) {
    context = new Ctx();
    bus = buildBus(context);
  }
  if (context.state === 'suspended') void context.resume();
}

/** One note: the sound and its octave and twelfth, shaped by the same envelope. */
function voice(ctx: AudioContext, into: AudioNode, note: Note, startAt: number, volume: number) {
  const out = ctx.createGain();
  const peak = Math.max(0.0001, note.gain * volume);
  out.gain.setValueAtTime(0.0001, startAt);
  out.gain.linearRampToValueAtTime(peak, startAt + 0.006);
  out.gain.exponentialRampToValueAtTime(peak * 0.35, startAt + Math.min(0.18, note.length * 0.2));
  out.gain.exponentialRampToValueAtTime(0.0001, startAt + note.length);
  out.connect(into);
  for (const [multiple, level] of [[1, 1], [2, 0.2], [3, 0.05]] as const) {
    const osc = ctx.createOscillator();
    const level_ = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = note.hz * multiple;
    level_.gain.value = level;
    osc.connect(level_).connect(out);
    osc.start(startAt);
    osc.stop(startAt + note.length + 0.05);
  }
}

/** Plays the notes now. Skipped when sound is off or the page hasn't been touched yet. `volume` is 0–1. */
export function playNotes(notes: readonly Note[], volume = 0.5): boolean {
  if (!isSoundOn() || !context || !bus || context.state !== 'running') return false;
  const start = context.currentTime + 0.02;
  for (const note of notes) voice(context, bus.input, note, start + note.at, volume);
  return true;
}
