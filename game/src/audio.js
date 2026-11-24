// Solmar Bay v2 — all sound is synthesised with WebAudio: no audio files.
// Engine hum, gunshots, sirens, cash and mission stingers, plus three
// generative radio stations (a step sequencer with bass, chords and hats).
const STATIONS = [
  {
    name: 'Solmar FM',
    bpm: 96,
    bass: [0, 0, 7, 0, 5, 0, 7, 10],
    chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [5, 8, 12]],
    lead: [12, 15, 12, 10, 12, 19, 15, 12],
    root: 110,
  },
  {
    name: 'Bay Breeze',
    bpm: 76,
    bass: [0, 0, 0, 5, 0, 0, 3, 5],
    chords: [[0, 4, 7], [0, 4, 7], [5, 9, 12], [3, 7, 10]],
    lead: [7, 12, 7, 9, 12, 14, 12, 9],
    root: 98,
  },
  {
    name: 'Neon Nights',
    bpm: 122,
    bass: [0, 0, 12, 0, 0, 10, 0, 7],
    chords: [[0, 3, 7, 10], [0, 3, 7, 10], [8, 11, 15, 18], [5, 8, 12, 15]],
    lead: [12, 12, 15, 19, 24, 19, 15, 12],
    root: 123.5,
  },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let station = 0;
  let musicOn = true;
  let nextNoteTime = 0;
  let step = 0;
  let radioTimer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine whose pitch wails up and down.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'sine';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 320;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      nextNoteTime = ctx.currentTime + 0.1;
      step = 0;
      radioTimer = window.setInterval(scheduleMusic, 40);
      return true;
    } catch {
      return false;
    }
  }

  function noteFreq(semitones, root) {
    return root * Math.pow(2, semitones / 12);
  }

  function playTone(freq, time, dur, type, gainValue, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gainValue, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g);
    g.connect(dest || musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function playHat(time) {
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    src.connect(f);
    f.connect(g);
    g.connect(musicGain);
    src.start(time);
  }

  function scheduleMusic() {
    if (!ctx || !musicOn) return;
    const st = STATIONS[station];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    while (nextNoteTime < ctx.currentTime + 0.15) {
      const s = step % 8;
      const bassNote = st.bass[s];
      playTone(noteFreq(bassNote, st.root), nextNoteTime, stepDur * 0.9, 'triangle', 0.5);
      const chord = st.chords[Math.floor(step / 8) % st.chords.length];
      if (s % 2 === 0) {
        for (const n of chord) playTone(noteFreq(n, st.root * 2), nextNoteTime, stepDur * 1.6, 'sine', 0.08);
      }
      if (s % 4 === 2) playTone(noteFreq(st.lead[s], st.root * 2), nextNoteTime, stepDur, 'square', 0.05);
      if (s % 2 === 1) playHat(nextNoteTime);
      nextNoteTime += stepDur;
      step += 1;
    }
  }

  function blip(freq, dur, type, gainValue) {
    if (!ctx) return;
    playTone(freq, ctx.currentTime, dur, type || 'sine', gainValue || 0.3, master);
  }

  return {
    ensure,
    stationName() {
      return STATIONS[station].name;
    },
    stationCount() {
      return STATIONS.length;
    },
    setStation(i) {
      station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      step = 0;
      return STATIONS[station].name;
    },
    cycleStation() {
      return this.setStation(station + 1);
    },
    toggleMusic() {
      musicOn = !musicOn;
      return musicOn;
    },
    engine(on, speed01) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
    },
    siren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    shot(kind) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * (kind === 'shotgun' ? 0.22 : 0.09));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = kind === 'shotgun' ? 900 : 2200;
      const g = ctx.createGain();
      g.gain.value = kind === 'shotgun' ? 0.5 : 0.32;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
    },
    crash() {
      if (!ctx) return;
      blip(70, 0.3, 'sawtooth', 0.4);
      blip(50, 0.4, 'square', 0.25);
    },
    cash() {
      if (!ctx) return;
      blip(880, 0.12, 'sine', 0.3);
      window.setTimeout(() => blip(1318, 0.18, 'sine', 0.3), 90);
    },
    mission() {
      if (!ctx) return;
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => window.setTimeout(() => blip(n, 0.16, 'triangle', 0.3), i * 110));
    },
    fail() {
      if (!ctx) return;
      blip(220, 0.25, 'sawtooth', 0.25);
      window.setTimeout(() => blip(165, 0.35, 'sawtooth', 0.25), 160);
    },
    pickup() {
      if (!ctx) return;
      blip(660, 0.1, 'sine', 0.3);
      window.setTimeout(() => blip(990, 0.14, 'sine', 0.3), 70);
    },
    destroy() {
      if (radioTimer) window.clearInterval(radioTimer);
      if (ctx) ctx.close().catch(() => {});
    },
  };
}
