// A tiny original 8-bit style music engine using the Web Audio API.
// No external audio files — everything is synthesized live with
// oscillators, in the spirit of a triumphant college fight song (an
// original composition, not a reproduction of any existing song).

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Original fanfare melody (MIDI note numbers; null = rest)
const MELODY = [72, 72, 72, 79, 76, 72, 67, null, 72, 74, 76, 77, 79, 76, 72, 67];
const MELODY_DUR = [0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1];

// Root-fifth "oom-pah" march bass line, one note per beat
const BASS = [48, 55, 48, 55, 53, 60, 55, 48, 55, 48];

export function createChiptunePlayer() {
  let ctx = null;
  let masterGain = null;
  let muted = false;
  let mode = null; // "menu" | "gameplay" | null
  let timer = null;
  let generation = 0; // invalidates stale scheduled loops when mode changes

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.18;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone(freq, startTime, duration, type, peak) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.92);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  function hat(startTime) {
    const bufferSize = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.03);
    noise.connect(gain);
    gain.connect(masterGain);
    noise.start(startTime);
  }

  function scheduleLoop(theMode, myGeneration) {
    if (!ctx || generation !== myGeneration) return;
    const bpm = theMode === "gameplay" ? 150 : 128;
    const secPerBeat = 60 / bpm;
    const start = ctx.currentTime + 0.05;

    let t = start;
    for (let i = 0; i < MELODY.length; i++) {
      const dur = MELODY_DUR[i] * secPerBeat;
      if (MELODY[i] != null) tone(midiToFreq(MELODY[i]), t, dur, "square", 0.5);
      t += dur;
    }
    const melodyEnd = t;

    let tb = start;
    let bi = 0;
    while (tb < melodyEnd - 0.001) {
      tone(midiToFreq(BASS[bi % BASS.length]), tb, secPerBeat * 0.9, "triangle", 0.35);
      if (theMode === "gameplay") hat(tb + secPerBeat / 2);
      tb += secPerBeat;
      bi++;
    }

    const loopLenMs = (melodyEnd - start) * 1000;
    timer = setTimeout(() => scheduleLoop(theMode, myGeneration), loopLenMs);
  }

  return {
    start(newMode) {
      const context = ensureContext();
      if (!context) return;
      if (mode === newMode && timer) return; // already running this mode
      mode = newMode;
      generation += 1;
      if (timer) clearTimeout(timer);
      scheduleLoop(newMode, generation);
    },
    stop() {
      generation += 1;
      if (timer) clearTimeout(timer);
      timer = null;
      mode = null;
    },
    setMuted(value) {
      muted = value;
      if (masterGain) masterGain.gain.value = muted ? 0 : 0.18;
    },
    unlock() {
      ensureContext();
    },
  };
}
