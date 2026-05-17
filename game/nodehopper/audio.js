// Node Hopper — Web Audio synthesis (no external files)
(() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { window.SFX = new Proxy({}, { get: () => () => {} }); return; }
  const ctx = new AC();
  let master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  function ensure() { if (ctx.state === 'suspended') ctx.resume(); }

  // Single oscillator blip with frequency sweep + envelope
  function blip(opts) {
    ensure();
    const t0 = ctx.currentTime;
    const {
      freq = 440, freqEnd = null, type = 'square',
      dur = 0.1, vol = 0.15, attack = 0.005, delay = 0,
      sweep = 'exp', filterFreq = null,
    } = opts;
    const t = t0 + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd !== null) {
      const end = Math.max(1, freqEnd);
      if (sweep === 'lin') osc.frequency.linearRampToValueAtTime(end, t + dur);
      else osc.frequency.exponentialRampToValueAtTime(end, t + dur);
    }
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = gain;
    if (filterFreq !== null) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      gain.connect(f);
      last = f;
    }
    osc.connect(gain);
    last.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // White noise burst (for landing thuds, hits)
  function noise(opts) {
    ensure();
    const t = ctx.currentTime;
    const { dur = 0.1, vol = 0.1, filterFreq = 800, filterQ = 1 } = opts;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    f.Q.value = filterQ;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function seq(notes, gap = 0.06) {
    notes.forEach((n, i) => blip({ ...n, delay: i * gap }));
  }

  window.SFX = {
    jump: () => blip({ freq: 280, freqEnd: 720, type: 'square', dur: 0.11, vol: 0.09 }),
    land: () => noise({ dur: 0.06, vol: 0.05, filterFreq: 500 }),
    pickup: () => seq([
      { freq: 880,  freqEnd: 1320, type: 'square', dur: 0.07, vol: 0.1 },
      { freq: 1320, freqEnd: 1980, type: 'square', dur: 0.09, vol: 0.1 },
    ], 0.05),
    hit: () => {
      blip({ freq: 220, freqEnd: 40, type: 'sawtooth', dur: 0.35, vol: 0.18 });
      noise({ dur: 0.25, vol: 0.12, filterFreq: 1200 });
    },
    flip: () => blip({ freq: 660, freqEnd: 220, type: 'triangle', dur: 0.22, vol: 0.12, sweep: 'lin' }),
    dissolve: () => blip({ freq: 1200, freqEnd: 300, type: 'sawtooth', dur: 0.15, vol: 0.08 }),
    clear: () => seq([
      { freq: 523, type: 'square', dur: 0.1, vol: 0.1 },
      { freq: 659, type: 'square', dur: 0.1, vol: 0.1 },
      { freq: 784, type: 'square', dur: 0.1, vol: 0.1 },
      { freq: 1047,type: 'square', dur: 0.22, vol: 0.12 },
    ], 0.08),
    gameOver: () => seq([
      { freq: 392, type: 'sawtooth', dur: 0.22, vol: 0.15 },
      { freq: 311, type: 'sawtooth', dur: 0.22, vol: 0.15 },
      { freq: 247, type: 'sawtooth', dur: 0.22, vol: 0.15 },
      { freq: 196, type: 'sawtooth', dur: 0.45, vol: 0.16 },
    ], 0.18),
    start: () => seq([
      { freq: 440, type: 'square', dur: 0.08, vol: 0.1 },
      { freq: 660, type: 'square', dur: 0.08, vol: 0.1 },
      { freq: 880, type: 'square', dur: 0.16, vol: 0.11 },
    ], 0.07),
    menu: () => blip({ freq: 660, type: 'square', dur: 0.05, vol: 0.06 }),
    setVolume: (v) => { master.gain.value = Math.max(0, Math.min(1, v)); },
    resume: () => ensure(),
  };
})();
