import type { NavTab } from '../components/Navbar';

export const WHATS_NEW_STORAGE_KEY = 'ek_diner_tour_whats_new_seen_version';
export const CURRENT_RELEASE_VERSION = '2026.11.27';

export interface WhatsNewFeature {
  id: string;
  targetTab: NavTab;
  targetSectionId?: string;
  location: 'home' | 'more' | 'both';
  titleEn: string;
  titleBn: string;
  summaryEn: string;
  summaryBn: string;
}

export const WHATS_NEW_FEATURES: WhatsNewFeature[] = [
  {
    id: 'explore-documentary',
    targetTab: 'explore',
    location: 'both',
    titleEn: 'Cinematic Explore',
    titleBn: 'সিনেম্যাটিক গন্তব্য',
    summaryEn: '4 fullscreen video scenes from Panam Nagar to Puran Dhaka',
    summaryBn: 'পানাম নগর থেকে পুরান ঢাকা — ৪টি ভিডিও অধ্যায়',
  },
  {
    id: 'mobile-hub',
    targetTab: 'more',
    location: 'more',
    titleEn: 'Mobile Bottom Nav & System Theme',
    titleBn: 'মোবাইল নেভ ও সিস্টেম থিম',
    summaryEn: 'Quick 5-tab bar plus Light, Dark & System modes in header',
    summaryBn: 'সহজ ৫-ট্যাব বার ও হেডারে লাইট/ডার্ক/সিস্টেম থিম',
  },
];

export const HIGHLIGHTED_FEATURE_IDS = new Set(WHATS_NEW_FEATURES.map((f) => f.id));

export function isFeatureNew(featureId: string): boolean {
  return HIGHLIGHTED_FEATURE_IDS.has(featureId);
}

export function getSeenWhatsNewVersion(): string | null {
  try {
    return localStorage.getItem(WHATS_NEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function hasUnseenWhatsNew(): boolean {
  return getSeenWhatsNewVersion() !== CURRENT_RELEASE_VERSION;
}

export function dismissWhatsNew(): void {
  try {
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, CURRENT_RELEASE_VERSION);
  } catch {
    // ignore storage restriction
  }
}
