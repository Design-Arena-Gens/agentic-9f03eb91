export function createAudioEngine() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  // Ambient city hum: filtered brown noise + subtle hiss
  const ambientGain = ctx.createGain();
  ambientGain.gain.value = 0.18;
  ambientGain.connect(master);

  const brownNoise = createBrownNoise(ctx);
  const ambientFilter = ctx.createBiquadFilter();
  ambientFilter.type = "lowpass";
  ambientFilter.frequency.value = 800;
  brownNoise.connect(ambientFilter).connect(ambientGain);

  const hiss = createWhiteNoise(ctx);
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.02;
  hiss.connect(hissGain).connect(master);

  // Tiger growl: low noise through bandpass + slow LFO
  const tigerNoise = createBrownNoise(ctx);
  const tigerBand = ctx.createBiquadFilter();
  tigerBand.type = "bandpass";
  tigerBand.frequency.value = 120;
  tigerBand.Q.value = 1.2;
  const tigerGain = ctx.createGain();
  tigerGain.gain.value = 0.0;
  tigerNoise.connect(tigerBand).connect(tigerGain).connect(master);

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 1.2;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 60;
  lfo.connect(lfoDepth).connect(tigerBand.frequency);

  // Dog barks: bursty noise with envelope
  const dogNoise = createWhiteNoise(ctx);
  const dogBand = ctx.createBiquadFilter();
  dogBand.type = "bandpass";
  dogBand.frequency.value = 900;
  dogBand.Q.value = 0.8;
  const dogGain = ctx.createGain();
  dogGain.gain.value = 0.0;
  dogNoise.connect(dogBand).connect(dogGain).connect(master);

  let started = false;
  let intervals: number[] = [];

  function scheduleTiger() {
    const now = ctx.currentTime;
    const g = tigerGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0.0, now);
    g.linearRampToValueAtTime(0.5, now + 0.3);
    g.linearRampToValueAtTime(0.0, now + 1.8);
  }

  function scheduleDog() {
    const now = ctx.currentTime;
    const g = dogGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0.0, now);
    g.linearRampToValueAtTime(0.45, now + 0.02);
    g.linearRampToValueAtTime(0.0, now + 0.18);
  }

  function start() {
    if (started) return;
    started = true;
    if (ctx.state === "suspended") ctx.resume();
    lfo.start();
    // start noise sources by connecting to destination
    (brownNoise as any).start?.();
    (hiss as any).start?.();
    (tigerNoise as any).start?.();
    (dogNoise as any).start?.();

    // schedule randomized events over ~10s
    scheduleTiger();
    const tigerId = window.setInterval(() => {
      if (Math.random() < 0.55) scheduleTiger();
    }, 1400);
    const dogId = window.setInterval(() => {
      if (Math.random() < 0.45) scheduleDog();
    }, 900);
    intervals.push(tigerId, dogId);
  }

  function stop() {
    intervals.forEach((id) => window.clearInterval(id));
    intervals = [];
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.0, t + 0.3);
    // allow tail before closing
    window.setTimeout(() => {
      ctx.close();
    }, 400);
  }

  function dispose() {
    try { ctx.close(); } catch {}
  }

  return { start, stop, dispose };
}

function createWhiteNoise(ctx: AudioContext) {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const node = ctx.createGain();
  src.connect(node);
  src.start();
  return node;
}

function createBrownNoise(ctx: AudioContext) {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5; // gain
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const node = ctx.createGain();
  src.connect(node);
  src.start();
  return node;
}
