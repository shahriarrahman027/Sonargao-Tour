import { isValidAudioUrl, MUSIC_TRACKS, type MusicTrackKey } from '../config/music';

export interface MusicSnapshot {
  currentTrack: MusicTrackKey | null;
  isPlaying: boolean;
  userPaused: boolean;
  autoplayBlocked: boolean;
  hasError: boolean;
  isConfigured: boolean;
}

type Listener = (snapshot: MusicSnapshot) => void;

const TARGET_VOLUME = 0.36;
const FADE_OUT_MS = 260;
const FADE_IN_MS = 380;
const FADE_STEP_MS = 25;

export class GlobalMusicManager {
  private audio: HTMLAudioElement | null = null;
  private currentTrack: MusicTrackKey | null = null;
  private loadedSrc = '';
  private isPlaying = false;
  private userPaused = false;
  private autoplayBlocked = false;
  private hasError = false;
  private fadeTimer: number | null = null;
  private transitionId = 0;
  private listeners = new Set<Listener>();

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
    if (!this.audio) {
      const el = new Audio();
      el.loop = true;
      el.preload = 'metadata';
      el.volume = TARGET_VOLUME;
      el.addEventListener('error', this.handleAudioError);
      el.addEventListener('ended', this.handleAudioEnded);
      this.audio = el;
    }
    return this.audio;
  }

  private handleAudioError = () => {
    this.hasError = true;
    this.isPlaying = false;
    this.notify();
  };

  private handleAudioEnded = () => {
    // Fallback loop safety in case a browser ignores audio.loop
    if (this.audio && !this.userPaused && this.isPlaying) {
      this.audio.currentTime = 0;
      void this.audio.play().catch(() => {
        this.isPlaying = false;
        this.notify();
      });
    }
  };

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): MusicSnapshot {
    const track = this.currentTrack ? MUSIC_TRACKS[this.currentTrack] : null;
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      userPaused: this.userPaused,
      autoplayBlocked: this.autoplayBlocked,
      hasError: this.hasError,
      isConfigured: track ? isValidAudioUrl(track.url) : false,
    };
  }

  private notify() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private cancelFade() {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private fadeVolume(from: number, to: number, durationMs: number): Promise<void> {
    this.cancelFade();
    const audio = this.audio;
    if (!audio || durationMs <= 0) {
      if (audio) audio.volume = to;
      return Promise.resolve();
    }

    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
    let currentStep = 0;
    audio.volume = from;

    return new Promise((resolve) => {
      this.fadeTimer = window.setInterval(() => {
        currentStep += 1;
        const progress = Math.min(1, currentStep / steps);
        if (this.audio) {
          this.audio.volume = Math.max(0, Math.min(1, from + (to - from) * progress));
        }
        if (progress >= 1) {
          this.cancelFade();
          resolve();
        }
      }, FADE_STEP_MS);
    });
  }

  /**
   * Switches track when the active section changes.
   * - Never restarts if the same track is already active.
   * - Respects userPaused preference across page navigation.
   */
  async setActiveTrack(trackKey: MusicTrackKey): Promise<void> {
    if (this.currentTrack === trackKey) {
      // Same track on re-render or sibling page (e.g. Crew -> Photos): keep playback position untouched.
      return;
    }

    const myTransition = ++this.transitionId;
    const config = MUSIC_TRACKS[trackKey];
    this.currentTrack = trackKey;
    this.hasError = false;

    const validUrl = isValidAudioUrl(config.url);
    if (!validUrl) {
      this.cancelFade();
      if (this.audio) {
        this.audio.pause();
        this.loadedSrc = '';
      }
      this.isPlaying = false;
      this.notify();
      return;
    }

    const audio = this.ensureAudio();
    if (!audio) {
      this.notify();
      return;
    }

    // Fade out previous track smoothly if currently playing
    if (this.isPlaying && !audio.paused) {
      await this.fadeVolume(audio.volume, 0, FADE_OUT_MS);
      if (myTransition !== this.transitionId) return;
      audio.pause();
    }

    // Load new track if URL changed
    if (this.loadedSrc !== config.url) {
      audio.src = config.url;
      this.loadedSrc = config.url;
      audio.load();
    }

    if (this.userPaused) {
      this.isPlaying = false;
      audio.volume = TARGET_VOLUME;
      this.notify();
      return;
    }

    await this.attemptPlayback(myTransition, true);
  }

  private async attemptPlayback(expectedTransition: number, fadeIn: boolean): Promise<void> {
    const audio = this.ensureAudio();
    if (!audio || !this.currentTrack) return;

    const config = MUSIC_TRACKS[this.currentTrack];
    if (!isValidAudioUrl(config.url)) {
      this.isPlaying = false;
      this.notify();
      return;
    }

    if (this.loadedSrc !== config.url) {
      audio.src = config.url;
      this.loadedSrc = config.url;
      audio.load();
    }

    try {
      audio.volume = fadeIn ? 0.02 : TARGET_VOLUME;
      await audio.play();
      if (expectedTransition !== this.transitionId) return;
      this.isPlaying = true;
      this.autoplayBlocked = false;
      this.hasError = false;
      this.notify();
      if (fadeIn) {
        await this.fadeVolume(0.02, TARGET_VOLUME, FADE_IN_MS);
      }
    } catch (err) {
      if (expectedTransition !== this.transitionId) return;
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        this.autoplayBlocked = true;
      } else {
        this.hasError = true;
      }
      this.isPlaying = false;
      audio.volume = TARGET_VOLUME;
      this.notify();
    }
  }

  async play(): Promise<void> {
    this.userPaused = false;
    this.autoplayBlocked = false;
    this.hasError = false;

    if (!this.currentTrack) {
      this.currentTrack = 'login';
    }

    const myTransition = ++this.transitionId;
    await this.attemptPlayback(myTransition, true);
  }

  async pause(): Promise<void> {
    this.userPaused = true;
    const myTransition = ++this.transitionId;
    const audio = this.audio;
    if (audio && !audio.paused) {
      await this.fadeVolume(audio.volume, 0, FADE_OUT_MS);
      if (myTransition !== this.transitionId) return;
      audio.pause();
      audio.volume = TARGET_VOLUME;
    }
    this.isPlaying = false;
    this.notify();
  }

  async toggle(): Promise<void> {
    if (this.isPlaying) {
      await this.pause();
    } else {
      await this.play();
    }
  }

  /**
   * Releases audio resources cleanly on unmount/teardown.
   */
  dispose(): void {
    this.cancelFade();
    this.transitionId += 1;
    if (this.audio) {
      this.audio.removeEventListener('error', this.handleAudioError);
      this.audio.removeEventListener('ended', this.handleAudioEnded);
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      this.audio = null;
    }
    this.loadedSrc = '';
    this.isPlaying = false;
    this.currentTrack = null;
    this.notify();
  }
}

export const musicManager = new GlobalMusicManager();
