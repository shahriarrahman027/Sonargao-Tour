import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidAudioUrl, MUSIC_TRACKS, resolveTrackKeyForSection } from '../../config/music';
import { GlobalMusicManager } from '../musicManager';

class MockAudioElement {
  src = '';
  loop = false;
  preload = 'auto';
  volume = 1;
  currentTime = 0;
  paused = true;
  loadCalls = 0;
  playCalls = 0;
  pauseCalls = 0;
  shouldRejectPlay: Error | null = null;
  private listeners = new Map<string, Set<() => void>>();

  addEventListener(event: string, fn: () => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }
  removeEventListener(event: string, fn: () => void) {
    this.listeners.get(event)?.delete(fn);
  }
  removeAttribute(attr: string) {
    if (attr === 'src') this.src = '';
  }
  load() {
    this.loadCalls += 1;
  }
  async play() {
    this.playCalls += 1;
    if (this.shouldRejectPlay) {
      throw this.shouldRejectPlay;
    }
    this.paused = false;
  }
  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
  emit(event: string) {
    this.listeners.get(event)?.forEach((fn) => fn());
  }
}

describe('Global Background Music System', () => {
  let createdAudios: MockAudioElement[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    createdAudios = [];

    const AudioMock = function () {
      const inst = new MockAudioElement();
      createdAudios.push(inst);
      return inst;
    };
    vi.stubGlobal('window', {
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
    vi.stubGlobal('Audio', AudioMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('configures the 5 local MP3 paths and maps every route accurately', () => {
    expect(MUSIC_TRACKS.login.url).toBe('/audio/login.mp3');
    expect(MUSIC_TRACKS.home.url).toBe('/audio/home.mp3');
    expect(MUSIC_TRACKS.journey.url).toBe('/audio/journey.mp3');
    expect(MUSIC_TRACKS.money.url).toBe('/audio/money.mp3');
    expect(MUSIC_TRACKS.explore.url).toBe('/audio/explore.mp3');

    expect(resolveTrackKeyForSection(false, 'home')).toBe('login');
    expect(resolveTrackKeyForSection(true, 'home')).toBe('home');
    expect(resolveTrackKeyForSection(true, 'journey')).toBe('journey');
    expect(resolveTrackKeyForSection(true, 'money')).toBe('money');

    const remaining = ['explore', 'crew', 'photos', 'social', 'checklist', 'report', 'admin'] as const;
    for (const tab of remaining) {
      expect(resolveTrackKeyForSection(true, tab)).toBe('explore');
    }
  });

  it('uses a single HTMLAudioElement, switches tracks with fade, and preserves position on same track', async () => {
    const manager = new GlobalMusicManager();

    // 1. Start on Login
    const p1 = manager.setActiveTrack('login');
    await vi.runAllTimersAsync();
    await p1;

    expect(createdAudios).toHaveLength(1);
    const audio = createdAudios[0];
    expect(audio.src).toBe('/audio/login.mp3');
    expect(manager.getSnapshot().isPlaying).toBe(true);

    // Simulate playback progress & re-render calling same track
    audio.currentTime = 14.5;
    await manager.setActiveTrack('login');
    expect(audio.currentTime).toBe(14.5);
    expect(audio.playCalls).toBe(1);

    // 2. Switch to Home after login
    const p2 = manager.setActiveTrack('home');
    await vi.runAllTimersAsync();
    await p2;
    expect(createdAudios).toHaveLength(1);
    expect(audio.src).toBe('/audio/home.mp3');
    expect(manager.getSnapshot().isPlaying).toBe(true);

    // 3. Switch to Journey -> Money -> Explore
    const p3 = manager.setActiveTrack('journey');
    await vi.runAllTimersAsync();
    await p3;
    expect(audio.src).toBe('/audio/journey.mp3');

    const p4 = manager.setActiveTrack('money');
    await vi.runAllTimersAsync();
    await p4;
    expect(audio.src).toBe('/audio/money.mp3');

    const p5 = manager.setActiveTrack('explore');
    await vi.runAllTimersAsync();
    await p5;
    expect(audio.src).toBe('/audio/explore.mp3');

    // Navigating across Explore sub-pages does not reload or restart
    audio.currentTime = 22.0;
    const loadsBefore = audio.loadCalls;
    await manager.setActiveTrack('explore');
    expect(audio.loadCalls).toBe(loadsBefore);
    expect(audio.currentTime).toBe(22.0);

    manager.dispose();
  });

  it('preserves user pause preference across navigation and resumes on the current page track', async () => {
    const manager = new GlobalMusicManager();

    const p1 = manager.setActiveTrack('home');
    await vi.runAllTimersAsync();
    await p1;
    const audio = createdAudios[0];

    // User pauses
    const pauseP = manager.pause();
    await vi.runAllTimersAsync();
    await pauseP;
    expect(manager.getSnapshot().isPlaying).toBe(false);
    expect(manager.getSnapshot().userPaused).toBe(true);

    const loadsWhilePaused = audio.loadCalls;

    // Navigate to Journey and Money while paused -> must NOT auto-resume or fetch network
    await manager.setActiveTrack('journey');
    await manager.setActiveTrack('money');
    expect(manager.getSnapshot().isPlaying).toBe(false);
    expect(manager.getSnapshot().currentTrack).toBe('money');
    expect(audio.loadCalls).toBe(loadsWhilePaused);

    // User resumes -> plays /audio/money.mp3
    const resumeP = manager.play();
    await vi.runAllTimersAsync();
    await resumeP;
    expect(manager.getSnapshot().isPlaying).toBe(true);
    expect(audio.src).toBe('/audio/money.mp3');

    manager.dispose();
  });

  it('handles browser autoplay restrictions and invalid/error URLs gracefully', async () => {
    expect(isValidAudioUrl('[PASTE LOGIN AUDIO URL]')).toBe(false);
    expect(isValidAudioUrl('/audio/home.mp3')).toBe(true);

    const AudioBlocked = function () {
      const inst = new MockAudioElement();
      inst.shouldRejectPlay = Object.assign(new Error('Autoplay blocked'), {
        name: 'NotAllowedError',
      });
      createdAudios.push(inst);
      return inst;
    };
    vi.stubGlobal('Audio', AudioBlocked);

    const manager = new GlobalMusicManager();
    const p = manager.setActiveTrack('login');
    await vi.runAllTimersAsync();
    await p;

    expect(manager.getSnapshot().autoplayBlocked).toBe(true);
    expect(manager.getSnapshot().isPlaying).toBe(false);

    // Simulate audio element error
    createdAudios[0].emit('error');
    expect(manager.getSnapshot().hasError).toBe(true);

    manager.dispose();
  });
});
