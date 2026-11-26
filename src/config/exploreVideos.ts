import type { ExploreDestination } from '../types/tour';

export interface ExploreVideoConfig {
  id: ExploreDestination['id'];
  order: number;
  numberLabel: string;
  youtubeUrl: string;
}

/**
 * Centralized YouTube documentary video configuration for the 4 Explore scenes.
 * Every video is rendered strictly muted, looping, inline, and without audio
 * so the website's independent background music remains unaffected.
 */
export const EXPLORE_DESTINATION_VIDEOS: Record<
  ExploreDestination['id'],
  ExploreVideoConfig
> = {
  'panam-nagar': {
    id: 'panam-nagar',
    order: 1,
    numberLabel: '01',
    youtubeUrl: 'https://www.youtube.com/watch?v=oxF2UKB0VjY',
  },
  'boro-jomidar-bari': {
    id: 'boro-jomidar-bari',
    order: 2,
    numberLabel: '02',
    youtubeUrl: 'https://www.youtube.com/watch?v=I99mhoJbWsY',
  },
  'museum-folk-art': {
    id: 'museum-folk-art',
    order: 3,
    numberLabel: '03',
    youtubeUrl: 'https://www.youtube.com/watch?v=9-_VoCqNE_E',
  },
  'puran-dhaka-evening': {
    id: 'puran-dhaka-evening',
    order: 4,
    numberLabel: '04',
    youtubeUrl: 'https://www.youtube.com/watch?v=CUT8YZfzaJ8',
  },
};

export const ORDERED_EXPLORE_VIDEOS: ExploreVideoConfig[] = Object.values(
  EXPLORE_DESTINATION_VIDEOS,
).sort((a, b) => a.order - b.order);

/**
 * Returns the configured video URL for a destination, falling back to the
 * centralized documentary URL if an admin-saved entry left it blank.
 */
export function resolveExploreVideoUrl(
  id: ExploreDestination['id'],
  customUrl?: string,
): string {
  const trimmed = (customUrl || '').trim();
  return trimmed || EXPLORE_DESTINATION_VIDEOS[id]?.youtubeUrl || '';
}
