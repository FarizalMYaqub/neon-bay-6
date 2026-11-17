// Synthesized WebAudio sound for Neon Bay: no audio files, everything is
// oscillators and filtered noise. Safe to call before any user gesture; the
// context is created lazily and every method guards against a missing one.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return true;
    } catch { return false; }
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ensure() || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ensure() || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } catch { /* audio is best-effort */ }
  }

  gunshot() { this._noise(0.18, 0.5, 1800); this._tone(160, 0.12, 'square', 0.25, 60); }
  punch() { this._noise(0.08, 0.35, 900); }
  pickup() { this._tone(660, 0.12, 'sine', 0.3); this._tone(990, 0.18, 'sine', 0.3); }
  cash() { this._tone(880, 0.1, 'triangle', 0.3); setTimeout(() => this._tone(1320, 0.16, 'triangle', 0.3), 90); }
  crash() { this._noise(0.3, 0.45, 500); }
  denied() { this._tone(180, 0.18, 'sawtooth', 0.25, 120); }

  // Continuous engine hum; call with a 0..1 throttle value, 0 to stop.
  engine(throttle) {
    if (!this.ensure()) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 400;
        this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const target = this.muted ? 0 : throttle * 0.12;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + throttle * 90, this.ctx.currentTime, 0.1);
    } catch { /* best effort */ }
  }

  // Two-tone police siren loop while wanted; call with false to stop.
  siren(on) {
    if (!this.ensure()) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.05;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.7;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
        this.sirenOsc.frequency.value = 800;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start(); lfo.start();
        this._sirenLfo = lfo;
      } else if (!on && this.sirenOsc) {
        const o = this.sirenOsc, l = this._sirenLfo;
        this.sirenOsc = null; this._sirenLfo = null;
        try { o.stop(); l.stop(); } catch { /* already stopped */ }
      }
    } catch { /* best effort */ }
  }

  // Simple synthwave loop: a minor-key bass arpeggio + pad, scheduled in steps.
  startMusic() {
    if (!this.ensure() || this.musicTimer) return;
    const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42]; // A1 A1 C2 G1 ...
    const lead = [220, 261.63, 329.63, 440, 329.63, 261.63, 220, 196];
    let step = 0;
    const stepDur = 240;
    this.musicTimer = setInterval(() => {
      if (this.muted || document.hidden) { step++; return; }
      const i = step % 8;
      this._tone(bass[i], stepDur / 1000 * 0.9, 'sawtooth', 0.07);
      if (step % 2 === 0) this._tone(lead[i], stepDur / 1000 * 1.8, 'triangle', 0.05);
      step++;
    }, stepDur);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
