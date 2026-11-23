// Sound, all synthesised with WebAudio — no audio files, no network. An engine
// hum that follows the car's speed, a two-tone siren while police are near, a noise
// burst for a gunshot, blips for pickups and a short jingle when a mission pays out.
// Everything starts on the first user gesture (browsers block audio before that).

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      // Engine: a sawtooth through a low-pass filter, pitch follows speed.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a square wave whose pitch alternates on a slow LFO.
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 750;
      sirenLfo = context.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.7;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 190;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function blip(frequency, duration, type, volume, when) {
    if (!started || muted) return;
    try {
      const osc = context.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = frequency;
      const gain = context.createGain();
      const start = context.currentTime + (when || 0);
      gain.gain.setValueAtTime(volume || 0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    /** Call on the first gesture (start button, key press) to unlock audio. */
    unlock() {
      ensure();
      if (context && context.state === 'suspended') context.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Engine hum follows speed 0..1; 0 silences it (on foot). */
    setEngine(speed01) {
      if (!started) return;
      engineGain.gain.value = muted ? 0 : speed01 * 0.12;
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineFilter.frequency.value = 320 + speed01 * 900;
    },
    /** Siren on while police are close; off otherwise. */
    setSiren(on) {
      if (!started) return;
      sirenGain.gain.value = on && !muted ? 0.045 : 0;
    },
    gunshot() {
      if (!started || muted) return;
      try {
        const length = Math.floor(context.sampleRate * 0.12);
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        const source = context.createBufferSource();
        source.buffer = buffer;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        const gain = context.createGain();
        gain.gain.value = 0.5;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();
      } catch {
        // Ignore audio errors.
      }
    },
    pickup() {
      blip(880, 0.09, 'sine', 0.3);
      blip(1318, 0.14, 'sine', 0.25, 0.08);
    },
    crash() {
      blip(90, 0.25, 'sawtooth', 0.4);
    },
    missionDone() {
      blip(523, 0.12, 'triangle', 0.3);
      blip(659, 0.12, 'triangle', 0.3, 0.11);
      blip(784, 0.22, 'triangle', 0.3, 0.22);
    },
    busted() {
      blip(392, 0.3, 'sawtooth', 0.3);
      blip(311, 0.5, 'sawtooth', 0.3, 0.25);
    },
  };
}
