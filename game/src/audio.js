// Synthesized WebAudio sound effects and a simple music loop. No audio files.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.step = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Short blip: a sine/triangle tone sliding from f0 to f1.
  blip(f0, f1, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Burst of filtered noise (gunshot, punch, crash).
  noise(dur, vol, freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.4;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  gunshot() { this.noise(0.16, 0.5, 2600); this.blip(160, 40, 0.12, 'square', 0.2); }
  punch() { this.noise(0.09, 0.35, 900); }
  pickup() { this.blip(660, 990, 0.14, 'sine', 0.3); this.blip(990, 1320, 0.16, 'sine', 0.22); }
  cash() { this.blip(880, 880, 0.09, 'triangle', 0.28); setTimeout(() => this.blip(1174, 1174, 0.14, 'triangle', 0.28), 90); }
  crash() { this.noise(0.3, 0.45, 700); }
  sirenStart() {
    if (!this.ctx || this.sirenOsc) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 700;
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 0.7; lg.gain.value = 320;
    lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g); g.connect(this.master);
    o.start(); lfo.start();
    this.sirenOsc = o; this.sirenGain = g;
  }
  sirenStop() {
    if (this.sirenOsc) { try { this.sirenOsc.stop(); } catch (e) {} this.sirenOsc = null; }
  }
  engineStart() {
    if (!this.ctx || this.engineOsc) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 55;
    g.gain.value = 0.0;
    o.connect(g); g.connect(this.master);
    o.start();
    this.engineOsc = o; this.engineGain = g;
  }
  engineSet(speed01, on) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, t, 0.1);
  }
  engineStop() {
    if (this.engineOsc) { try { this.engineOsc.stop(); } catch (e) {} this.engineOsc = null; }
  }

  // A laid-back synthwave bassline loop, scheduled bar by bar.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 55, 65.41, 0, 55, 49, 58.27];
    const chords = [220, 174.61, 196, 146.83];
    const playBar = () => {
      if (!this.musicOn || !this.ctx) return;
      const beat = 0.42;
      bass.forEach((f, i) => {
        if (f) setTimeout(() => this.blip(f, f, beat * 0.9, 'triangle', 0.16), i * beat * 1000);
      });
      setTimeout(() => this.blip(chords[this.step % 4], chords[this.step % 4] * 1.5, beat * 3, 'sine', 0.05), 0);
      this.step++;
    };
    playBar();
    this.musicTimer = setInterval(playBar, bass.length * 0.42 * 1000);
  }
  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (!this.musicOn && this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    else if (this.musicOn) this.startMusic();
    return this.musicOn;
  }
}
