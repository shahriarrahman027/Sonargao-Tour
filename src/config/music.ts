import type { NavTab } from '../components/Navbar';

export type MusicTrackKey = 'login' | 'home' | 'journey' | 'money' | 'explore';

export interface MusicTrackConfig {
  key: MusicTrackKey;
  fileName: string;
  labelBn: string;
  labelEn: string;
  /**
   * Audio source URL (defaults to local static files in public/audio/).
   * Can optionally be overridden via VITE_MUSIC_*_URL in .env.
   */
  url: string;
}

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

export const MUSIC_TRACKS: Record<MusicTrackKey, MusicTrackConfig> = {
  login: {
    key: 'login',
    fileName: 'login.mp3',
    labelBn: 'প্রবেশ সংগীত',
    labelEn: 'Gate Theme',
    url: env.VITE_MUSIC_LOGIN_URL?.trim() || '/audio/login.mp3',
  },
  home: {
    key: 'home',
    fileName: 'home.mp3',
    labelBn: 'হোমপেজ থিম',
    labelEn: 'Homepage Theme',
    url: env.VITE_MUSIC_HOME_URL?.trim() || '/audio/home.mp3',
  },
  journey: {
    key: 'journey',
    fileName: 'journey.mp3',
    labelBn: 'ভ্রমণপথ থিম',
    labelEn: 'Journey Theme',
    url: env.VITE_MUSIC_JOURNEY_URL?.trim() || '/audio/journey.mp3',
  },
  money: {
    key: 'money',
    fileName: 'money.mp3',
    labelBn: 'হিসাব থিম',
    labelEn: 'Finance Theme',
    url: env.VITE_MUSIC_MONEY_URL?.trim() || '/audio/money.mp3',
  },
  explore: {
    key: 'explore',
    fileName: 'explore.mp3',
    labelBn: 'ভ্রমণ ও আড্ডা থিম',
    labelEn: 'Explore Theme',
    url: env.VITE_MUSIC_EXPLORE_URL?.trim() || '/audio/explore.mp3',
  },
};

/**
 * Resolves which background music track belongs to the current view.
 * - Login screen -> 'login' (/audio/login.mp3)
 * - Home -> 'home' (/audio/home.mp3)
 * - Journey -> 'journey' (/audio/journey.mp3)
 * - Money / Finance -> 'money' (/audio/money.mp3)
 * - All remaining pages -> 'explore' (/audio/explore.mp3)
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
