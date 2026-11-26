import type { NavTab } from '../components/Navbar';

export type MusicTrackKey = 'login' | 'home' | 'journey' | 'money' | 'explore';

export interface MusicTrackConfig {
  key: MusicTrackKey;
  fileName: string;
  labelBn: string;
  labelEn: string;
  /**
   * Paste your direct Cloudflare R2 public audio URL here (or set VITE_MUSIC_*_URL in .env).
   * Example: 'https://pub-xxxxxxxxxxxxxxxx.r2.dev/Home.mp3'
   */
  url: string;
}

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

export const MUSIC_TRACKS: Record<MusicTrackKey, MusicTrackConfig> = {
  login: {
    key: 'login',
    fileName: 'log in.mp3',
    labelBn: 'প্রবেশ সংগীত',
    labelEn: 'Gate Theme',
    url: env.VITE_MUSIC_LOGIN_URL?.trim() || '[PASTE LOGIN AUDIO URL]',
  },
  home: {
    key: 'home',
    fileName: 'Home.mp3',
    labelBn: 'হোমপেজ থিম',
    labelEn: 'Homepage Theme',
    url: env.VITE_MUSIC_HOME_URL?.trim() || '[PASTE HOME AUDIO URL]',
  },
  journey: {
    key: 'journey',
    fileName: 'Journey.mp3',
    labelBn: 'ভ্রমণপথ থিম',
    labelEn: 'Journey Theme',
    url: env.VITE_MUSIC_JOURNEY_URL?.trim() || '[PASTE JOURNEY AUDIO URL]',
  },
  money: {
    key: 'money',
    fileName: 'Money.mp3',
    labelBn: 'হিসাব থিম',
    labelEn: 'Finance Theme',
    url: env.VITE_MUSIC_MONEY_URL?.trim() || '[PASTE MONEY AUDIO URL]',
  },
  explore: {
    key: 'explore',
    fileName: 'Explore.mp3',
    labelBn: 'ভ্রমণ ও আড্ডা থিম',
    labelEn: 'Explore Theme',
    url: env.VITE_MUSIC_EXPLORE_URL?.trim() || '[PASTE EXPLORE AUDIO URL]',
  },
};

/**
 * Resolves which background music track belongs to the current view.
 * - Login screen -> 'login' (log in.mp3)
 * - Home -> 'home' (Home.mp3)
 * - Journey -> 'journey' (Journey.mp3)
 * - Money / Finance -> 'money' (Money.mp3)
 * - All remaining pages -> 'explore' (Explore.mp3)
 */
export function resolveTrackKeyForSection(
  isAuthenticated: boolean,
  activeTab: NavTab,
): MusicTrackKey {
  if (!isAuthenticated) return 'login';
  if (activeTab === 'home') return 'home';
  if (activeTab === 'journey') return 'journey';
  if (activeTab === 'money') return 'money';
  return 'explore';
}

/**
 * Validates that a configured audio URL is an actual playable URL (not a placeholder).
 */
export function isValidAudioUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('[PASTE')) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
