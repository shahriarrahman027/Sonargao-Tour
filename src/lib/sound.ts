// Synthesized Web Audio sound effects & ambient travel drone.
// Strictly respects browser autoplay policy: only initializes on user gesture.

class TourSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private musicPlaying = false;
  private ambientGain: GainNode | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  private ambientTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted && this.musicPlaying) {
      this.stopAmbientMusic();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  playTick() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  playCoinChime() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = [880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = ctx.currentTime + idx * 0.08;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  playExpenseStamp() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  playCelebration() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = ctx.currentTime + i * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  toggleAmbientMusic(): boolean {
    if (this.musicPlaying) {
      this.stopAmbientMusic();
      return false;
    }
    if (this.muted) {
      this.muted = false;
    }
    this.startAmbientMusic();
    return true;
  }

  private startAmbientMusic() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.stopAmbientMusic();

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.2);
    masterGain.connect(ctx.destination);
    this.ambientGain = masterGain;

    // Gentle acoustic pentatonic pad (C4, G4, E5)
    const freqs = [261.63, 392.0];
    this.ambientOscillators = freqs.map((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      osc.connect(masterGain);
      osc.start();
      return osc;
    });

    const melodyNotes = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33];
    let step = 0;
    this.ambientTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicPlaying || this.muted) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(melodyNotes[step % melodyNotes.length], this.ctx.currentTime);
      g.gain.setValueAtTime(0.025, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0005, this.ctx.currentTime + 1.4);
      osc.connect(g).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.45);
      step += 1;
    }, 1800);

    this.musicPlaying = true;
  }

  stopAmbientMusic() {
    if (this.ambientTimer !== null) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    this.ambientOscillators.forEach((o) => {
      try {
        o.stop();
      } catch {
        // ignore already stopped
      }
    });
    this.ambientOscillators = [];
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
    this.musicPlaying = false;
  }
}

export const soundEngine = new TourSoundEngine();
