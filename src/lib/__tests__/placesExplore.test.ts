import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPLORE_DESTINATIONS } from '../../data/defaultSeed';
import { extractYouTubeId, getYouTubeThumbnailUrl, toYouTubeEmbedUrl } from '../media';
import { tourApi } from '../tourApi';

function installStorageMock() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
  vi.stubGlobal('navigator', { onLine: true, userAgent: 'vitest' });
}

describe("Places We'll Explore — Sequence, Media Parsing & Admin Persistence", () => {
  beforeEach(() => {
    installStorageMock();
  });

  it('preserves the exact 4 destinations in 01..04 order with Bangla and English labels', () => {
    expect(DEFAULT_EXPLORE_DESTINATIONS.map((d) => d.numberLabel)).toEqual(['01', '02', '03', '04']);
    expect(DEFAULT_EXPLORE_DESTINATIONS.map((d) => d.id)).toEqual([
      'panam-nagar',
      'boro-jomidar-bari',
      'museum-folk-art',
      'puran-dhaka-evening',
    ]);
    expect(DEFAULT_EXPLORE_DESTINATIONS[0].name_bn).toBe('পানাম নগর');
    expect(DEFAULT_EXPLORE_DESTINATIONS[1].name_bn).toBe('সোনারগাঁও বড় জমিদার বাড়ি');
    expect(DEFAULT_EXPLORE_DESTINATIONS[2].name_bn).toBe('জাদুঘর ও লোকশিল্পের স্টল');
    expect(DEFAULT_EXPLORE_DESTINATIONS[3].name_bn).toBe('সন্ধ্যার পুরান ঢাকা');
  });

  it('parses YouTube URLs safely without autoplay audio and rejects invalid URLs', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=12')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://example.com/not-youtube')).toBeNull();
    expect(extractYouTubeId('')).toBeNull();

    const embed = toYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(embed).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(embed).toContain('autoplay=0');
    expect(embed).toContain('controls=1');

    expect(getYouTubeThumbnailUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
  });

  it('allows Admin to configure destination media and blocks non-admin members', async () => {
    // Non-admin blocked
    await tourApi.loginWithStudentId('DIU-101');
    await expect(
      tourApi.updateTourSettings({ explore_destinations: DEFAULT_EXPLORE_DESTINATIONS }),
    ).rejects.toThrow(/Forbidden/i);
    await tourApi.logout();

    // Admin allowed & persisted
    await tourApi.loginWithStudentId('DIU-102');
    await tourApi.elevateAdmin('admin-pass');

    const updated = DEFAULT_EXPLORE_DESTINATIONS.map((d) =>
      d.id === 'panam-nagar'
        ? {
            ...d,
            media_mode: 'youtube' as const,
            youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
            photos: [
              ...d.photos,
              {
                url: '/images/panam-hero.svg',
                caption_en: 'Sunrise view',
                caption_bn: 'ভোরের দৃশ্য',
              },
            ],
          }
        : d,
    );

    await tourApi.updateTourSettings({ explore_destinations: updated });

    const state = await tourApi.fetchFullState();
    const panam = state.settings.explore_destinations?.find((d) => d.id === 'panam-nagar');
    expect(panam?.media_mode).toBe('youtube');
    expect(panam?.youtube_url).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(panam?.photos).toHaveLength(2);
  });
});
