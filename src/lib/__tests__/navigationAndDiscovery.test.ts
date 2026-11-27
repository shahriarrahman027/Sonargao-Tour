import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_BOTTOM_DESTINATIONS } from '../../components/MobileBottomNav';
import { MORE_SECONDARY_FEATURES } from '../../components/MoreFeaturesSection';
import { resolveTrackKeyForSection } from '../../config/music';
import {
  CURRENT_RELEASE_VERSION,
  dismissWhatsNew,
  getSeenWhatsNewVersion,
  hasUnseenWhatsNew,
  isFeatureNew,
} from '../whatsNew';

function installStorageMock() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  });
}

describe('Mobile Navigation, More Hub & New Feature Discovery', () => {
  beforeEach(() => {
    installStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defines the exact 5 mobile bottom navigation items and maps secondary routes under More', () => {
    expect(MOBILE_BOTTOM_DESTINATIONS.map((d) => d.id)).toEqual([
      'home',
      'journey',
      'explore',
      'money',
      'more',
    ]);

    const moreEntry = MOBILE_BOTTOM_DESTINATIONS.find((d) => d.id === 'more')!;
    expect(moreEntry.matchesTabs).toEqual([
      'more',
      'checklist',
      'social',
      'photos',
      'crew',
      'report',
      'admin',
    ]);

    // Audio routing stays consistent when navigating into More
    expect(resolveTrackKeyForSection(true, 'more')).toBe('explore');
  });

  it('covers all secondary features inside More within 1 tap (max 2 taps from Home) without duplicating Theme or Music', () => {
    const ids = MORE_SECONDARY_FEATURES.map((f) => f.id);
    expect(ids).toEqual(['checklist', 'polls', 'photos', 'notes', 'crew', 'report']);
    expect(ids).not.toContain('theme');
    expect(ids).not.toContain('music');
  });

  it('highlights new features and persists What’s New dismissal across refreshes', () => {
    expect(isFeatureNew('explore-documentary')).toBe(true);
    expect(isFeatureNew('nonexistent-feature')).toBe(false);

    expect(hasUnseenWhatsNew()).toBe(true);
    expect(getSeenWhatsNewVersion()).toBeNull();

    dismissWhatsNew();
    expect(getSeenWhatsNewVersion()).toBe(CURRENT_RELEASE_VERSION);
    expect(hasUnseenWhatsNew()).toBe(false);
  });
});
