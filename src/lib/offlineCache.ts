import type { ChecklistItem, ItineraryItem, Member, TourProgress, TourSettings } from '../types/tour';

const OFFLINE_CACHE_KEY = 'ek_diner_tour_offline_cache_v1';

export interface OfflineTourSnapshot {
  settings: TourSettings;
  members: Member[];
  itinerary: ItineraryItem[];
  checklist: ChecklistItem[];
  progress: TourProgress;
  cachedAt: string;
}

export function saveOfflineSnapshot(snapshot: OfflineTourSnapshot) {
  try {
    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota exceeded
  }
}

export function loadOfflineSnapshot(): OfflineTourSnapshot | null {
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineTourSnapshot;
  } catch {
    return null;
  }
}
