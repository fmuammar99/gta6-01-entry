// Synthesised sound: every effect is an oscillator or a noise burst from
// the Web Audio API — no audio files, no network. The context is created
// on the first user gesture (browsers block audio before that) and every
// call is a no-op until then. M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* audio is decoration, never fatal */ }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    click() { tone(660, 0.07, 'square', 0.12); },
    pickup() { tone(880, 0.09, 'sine', 0.2); tone(1320, 0.12, 'sine', 0.16); },
    cash() { tone(988, 0.08, 'triangle', 0.2); tone(1319, 0.14, 'triangle', 0.2); },
    punch() { noise(0.12, 0.3, 900); tone(120, 0.1, 'sine', 0.25, 60); },
    shot() { noise(0.14, 0.4, 3200); tone(220, 0.08, 'square', 0.14, 70); },
    hit() { tone(180, 0.12, 'sawtooth', 0.2, 90); },
    crash() { noise(0.3, 0.4, 700); },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110);
      });
    },
    fail() { tone(392, 0.25, 'sawtooth', 0.18, 196); tone(196, 0.5, 'sawtooth', 0.18, 98); },
    /** Engine hum that follows the car's speed; call every frame while driving. */
    engine(speed01, on) {
      if (!ensure()) return;
      try {
        if (!on) {
          if (engineOsc) { engineGain.gain.value = 0; }
          return;
        }
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.value = 0.05;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = muted ? 0 : 0.03 + speed01 * 0.05;
      } catch { /* ignore */ }
    },
    /** Two-tone siren while any police car is chasing; call every frame. */
    siren(on) {
      if (!ensure()) return;
      try {
        if (!on) {
          if (sirenGain) sirenGain.gain.value = 0;
          return;
        }
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 750;
          sirenLfo = ctx.createOscillator();
          sirenLfo.frequency.value = 1.4;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 260;
          sirenLfo.connect(lfoGain);
          lfoGain.connect(sirenOsc.frequency);
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          sirenLfo.start();
        }
        sirenGain.gain.value = muted ? 0 : 0.045;
      } catch { /* ignore */ }
    },
  };
}
