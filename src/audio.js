// Fully procedural audio (no asset files).
export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const loop = (type, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master); src.start();
      return { f, g };
    };
    this.wind = loop('bandpass', 500, 0.6);
    this.carve = loop('highpass', 2500, 0.5);
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7; }

  // speed in m/s, slip 0..1, grounded bool
  update(speed, slip, grounded) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = Math.min(1, speed / 40);
    this.wind.g.gain.setTargetAtTime(0.03 + k * k * 0.35, t, 0.1);
    this.wind.f.frequency.setTargetAtTime(350 + k * 900, t, 0.1);
    this.carve.g.gain.setTargetAtTime(grounded ? Math.min(0.28, 0.02 * k + slip * 0.3) : 0, t, 0.05);
  }

  tone(freq, dur = 0.15, type = 'sine', vol = 0.2, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur);
  }

  thump(vol = 0.5) {
    if (!this.ctx) return;
    this.tone(110, 0.22, 'sine', vol, -70);
    const t = this.ctx.currentTime, src = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    src.buffer = this.noise; f.type = 'lowpass'; f.frequency.value = 1400;
    g.gain.setValueAtTime(vol * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(f).connect(g).connect(this.master); src.start(t); src.stop(t + 0.32);
  }

  trick(level = 1) { [0, 1, 2].slice(0, Math.min(3, level + 1)).forEach((i) => setTimeout(() => this.tone(660 * Math.pow(1.26, i), 0.18, 'triangle', 0.18), i * 70)); }
  gate() { this.tone(880, 0.12, 'triangle', 0.16); setTimeout(() => this.tone(1320, 0.2, 'triangle', 0.16), 80); }
  crash() { this.thump(0.8); this.tone(220, 0.4, 'sawtooth', 0.12, -150); }
  jump() { this.tone(260, 0.16, 'sine', 0.12, 240); }
}
