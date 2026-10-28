import { BreathPhase } from '../types/sanctuary';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      const saved = localStorage.getItem('prana_pond_muted');
      if (saved === 'true') {
        this.muted = true;
      }
    } catch {
      // ignore storage errors
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem('prana_pond_muted', String(mute));
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playBowlStrike(528, 0.35, 1.4);
    }
    return this.muted;
  }

  /**
   * Synthesizes a warm Tibetan singing bowl strike with natural inharmonic partials
   */
  public playBowlStrike(baseFreq = 432, volume = 0.22, duration = 2.4): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const partials = [
      { ratio: 1.0, amp: 1.0, decay: duration },
      { ratio: 2.756, amp: 0.35, decay: duration * 0.65 },
      { ratio: 5.404, amp: 0.14, decay: duration * 0.4 },
    ];

    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * p.ratio, now);

      const peakGain = Math.max(0.001, volume * p.amp);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + p.decay + 0.05);
    });
  }

  /**
   * Gentle cue when transitioning breath phases
   */
  public playBreathPhaseCue(phase: BreathPhase): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (phase === 'INHALE') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(256, now);
      osc.frequency.exponentialRampToValueAtTime(384, now + 0.75);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    } else if (phase === 'HOLD_IN') {
      this.playBowlStrike(512, 0.12, 1.1);
    } else if (phase === 'EXHALE') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(384, now);
      osc.frequency.exponentialRampToValueAtTime(256, now + 0.85);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.13, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.95);
    } else {
      this.playBowlStrike(320, 0.09, 0.9);
    }
  }

  /**
   * Triggered when player releases a Harmonic Exhale Pulse wave
   */
  public playHarmonicPulse(chargeRatio: number): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const base = 288 + Math.round(chargeRatio * 144);
    this.playBowlStrike(base, 0.18 + chargeRatio * 0.1, 1.8);
    if (chargeRatio > 0.65) {
      setTimeout(() => {
        this.playBowlStrike(base * 1.5, 0.14, 1.5);
      }, 65);
    }
  }

  /**
   * Weight-scaled purification chord when a mental distraction hazard is dissolved
   */
  public playPurifyImpact(combo = 1): void {
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const noteIdx = Math.min(scale.length - 1, (combo - 1) % scale.length);
    const freq = scale[noteIdx];
    this.playBowlStrike(freq, 0.24, 1.9);
    this.playBowlStrike(freq * 1.5, 0.12, 1.3);
  }

  /**
   * Celebratory chord arpeggio when a dormant Lotus Shrine blooms
   */
  public playLotusBloom(): void {
    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playBowlStrike(freq, 0.18, 2.2);
      }, idx * 80);
    });
  }

  /**
   * Subtle low dissonance when a mental distraction collides with the Koi
   */
  public playDisruptionHit(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.32);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }
}

export const soundEngine = new SoundEngine();
