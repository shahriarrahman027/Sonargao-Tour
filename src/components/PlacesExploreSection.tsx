import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { resolveExploreVideoUrl } from '../config/exploreVideos';
import { useTour } from '../context/TourContext';
import { DEFAULT_EXPLORE_DESTINATIONS } from '../data/defaultSeed';
import { toBanglaDigits } from '../lib/i18n';
import { extractYouTubeId, toYouTubeEmbedUrl } from '../lib/media';
import { soundEngine } from '../lib/sound';
import { tourApi } from '../lib/tourApi';
import type { ExploreDestination, ExplorePhoto } from '../types/tour';
import { ExploreScene } from './ExploreScene';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export const PlacesExploreSection: React.FC = () => {
  const { lang, state, session, isOnline, refreshState, showToast } = useTour();
  const prefersReducedMotion = usePrefersReducedMotion();

  const destinations = useMemo(() => {
    const raw =
      state?.settings.explore_destinations && state.settings.explore_destinations.length === 4
        ? state.settings.explore_destinations
        : DEFAULT_EXPLORE_DESTINATIONS;
    return [...raw]
      .sort((a, b) => a.order - b.order)
      .map((d) => ({
        ...d,
        youtube_url: resolveExploreVideoUrl(d.id, d.youtube_url),
      }));
  }, [state?.settings.explore_destinations]);

  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [nearScenes, setNearScenes] = useState<Record<number, boolean>>({ 0: true });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [detailViewMode, setDetailViewMode] = useState<'gallery' | 'youtube'>('gallery');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [videoFallback, setVideoFallback] = useState(false);

  // Admin Media Configuration Modal state
  const [editingDest, setEditingDest] = useState<ExploreDestination | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);

  const sceneRefs = useRef<Array<HTMLElement | null>>([]);
  const visibilityRatios = useRef<Record<number, number>>({});

  const registerSceneRef = useCallback((index: number, el: HTMLElement | null) => {
    sceneRefs.current[index] = el;
  }, []);

  // Track which scene dominates the viewport + lazy prewarm nearby scenes
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setNearScenes({ 0: true, 1: true, 2: true, 3: true });
      return;
    }

    const activeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idxAttr = entry.target.getAttribute('data-scene-index');
          if (idxAttr === null) continue;
          const idx = Number(idxAttr);
          visibilityRatios.current[idx] = entry.isIntersecting ? entry.intersectionRatio : 0;
        }

        let bestIdx = 0;
        let bestRatio = -1;
        for (let i = 0; i < destinations.length; i += 1) {
          const ratio = visibilityRatios.current[i] ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIdx = i;
          }
        }
        if (bestRatio > 0.08) {
          setActiveSceneIndex(bestIdx);
        }
      },
      { threshold: [0.1, 0.25, 0.45, 0.65, 0.85] },
    );

    const prewarmObserver = new IntersectionObserver(
      (entries) => {
        setNearScenes((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const entry of entries) {
            const idxAttr = entry.target.getAttribute('data-scene-index');
            if (idxAttr === null) continue;
            const idx = Number(idxAttr);
            if (next[idx] !== entry.isIntersecting) {
              next[idx] = entry.isIntersecting;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { rootMargin: '45% 0px 45% 0px', threshold: 0 },
    );

    sceneRefs.current.forEach((el) => {
      if (el) {
        activeObserver.observe(el);
        prewarmObserver.observe(el);
      }
    });

    return () => {
      activeObserver.disconnect();
      prewarmObserver.disconnect();
    };
  }, [destinations.length]);

  const jumpToScene = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(destinations.length - 1, idx));
      const el = sceneRefs.current[clamped];
      if (!el) return;
      soundEngine.playTick();
      setActiveSceneIndex(clamped);
      setNearScenes((prev) => ({ ...prev, [clamped]: true }));
      el.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    },
    [destinations.length, prefersReducedMotion],
  );

  const selectedIndex = destinations.findIndex((d) => d.id === selectedId);
  const selectedDest = selectedIndex >= 0 ? destinations[selectedIndex] : null;
  const isAdmin = Boolean(session?.isAdmin);

  const openDestination = (dest: ExploreDestination) => {
    soundEngine.playTick();
    setSelectedId(dest.id);
    setActivePhotoIndex(0);
    setVideoFallback(false);
    const hasValidVideo = Boolean(toYouTubeEmbedUrl(dest.youtube_url, { muted: true }));
    setDetailViewMode(dest.media_mode === 'youtube' && hasValidVideo ? 'youtube' : 'gallery');
  };

  const navigateDetail = (dir: -1 | 1) => {
    if (selectedIndex < 0) return;
    const nextIndex = (selectedIndex + dir + destinations.length) % destinations.length;
    openDestination(destinations[nextIndex]);
  };

  const resolvePhotoUrl = (dest: ExploreDestination, photoUrl?: string) => {
    const candidate = (photoUrl || '').trim();
    if (!candidate || failedImages[candidate]) {
      return dest.fallback_image_url;
    }
    return candidate;
  };

  const markImageFailed = (url: string) => {
    if (!url) return;
    setFailedImages((prev) => ({ ...prev, [url]: true }));
  };

  const handleSaveMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDest) return;

    if (editingDest.youtube_url.trim() && !extractYouTubeId(editingDest.youtube_url)) {
      showToast(
        lang === 'bn'
          ? 'সঠিক YouTube লিংক দিন (অথবা খালি রাখুন)'
          : 'Please enter a valid YouTube URL or leave it blank.',
      );
      return;
    }

    const cleanedPhotos: ExplorePhoto[] = editingDest.photos
      .filter((p) => p.url.trim() !== '')
      .map((p) => ({
        url: p.url.trim(),
        caption_bn: p.caption_bn.trim(),
        caption_en: p.caption_en.trim(),
      }));

    const finalDest: ExploreDestination = {
      ...editingDest,
      youtube_url: editingDest.youtube_url.trim(),
      photos:
        cleanedPhotos.length > 0
          ? cleanedPhotos
          : [
              {
                url: editingDest.fallback_image_url,
                caption_bn: editingDest.name_bn,
                caption_en: editingDest.name_en,
              },
            ],
    };

    setSavingMedia(true);
    try {
      const updatedList = destinations
        .map((d) => (d.id === finalDest.id ? finalDest : d))
        .sort((a, b) => a.order - b.order);
      await tourApi.updateTourSettings({ explore_destinations: updatedList });
      await refreshState();
      setEditingDest(null);
      showToast(lang === 'bn' ? 'গন্তব্যের মিডিয়া সংরক্ষিত হয়েছে' : 'Destination media saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save destination media');
    } finally {
      setSavingMedia(false);
    }
  };

  const handleResetDestination = () => {
    if (!editingDest) return;
    const def = DEFAULT_EXPLORE_DESTINATIONS.find((d) => d.id === editingDest.id);
    if (def) {
      setEditingDest({ ...def });
    }
  };

  const activeDest = destinations[activeSceneIndex] ?? destinations[0];
  const progressText =
    lang === 'bn'
      ? `${toBanglaDigits(activeDest.numberLabel)}/${toBanglaDigits(String(destinations.length).padStart(2, '0'))}`
      : `${activeDest.numberLabel}/${String(destinations.length).padStart(2, '0')}`;

  return (
    <div className="relative bg-[#07140D]">
      {/* Four Seamless Full-Screen Documentary Scenes */}
      {destinations.map((dest, idx) => {
        const withinWindow = Math.abs(idx - activeSceneIndex) <= 1;
        const near = Boolean(nearScenes[idx]) && withinWindow;
        return (
          <ExploreScene
            key={dest.id}
            dest={dest}
            index={idx}
            total={destinations.length}
            lang={lang}
            isActive={idx === activeSceneIndex}
            isNearViewport={near}
            isOnline={isOnline}
            isAdmin={isAdmin}
            prefersReducedMotion={prefersReducedMotion}
            nextDestination={destinations[idx + 1]}
            onSceneRef={registerSceneRef}
            onOpenDetails={openDestination}
            onConfigureMedia={(target) =>
              setEditingDest(JSON.parse(JSON.stringify(target)) as ExploreDestination)
            }
            onJumpToScene={jumpToScene}
          />
        );
      })}

      {/* Desktop Floating Documentary Chapter Rail (01/04 .. 04/04) */}
      <aside
        aria-label={lang === 'bn' ? 'গন্তব্য অগ্রগতি' : 'Destination Progress'}
        className="hidden md:flex fixed right-5 top-1/2 -translate-y-1/2 z-30 flex-col items-end gap-2.5"
      >
        <div className="rounded-full border border-[#D4AF37]/35 bg-[#07140D]/75 backdrop-blur-md px-3 py-1 text-[11px] font-bold tracking-widest text-[#F2D184] shadow-lg">
          {progressText}
        </div>

        <div className="flex flex-col items-end gap-2 rounded-2xl border border-white/15 bg-[#07140D]/65 backdrop-blur-md p-2 shadow-xl">
          {destinations.map((dest, idx) => {
            const active = idx === activeSceneIndex;
            const title = lang === 'bn' ? dest.name_bn : dest.name_en;
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => jumpToScene(idx)}
                aria-label={`${dest.numberLabel} ${title}`}
                aria-current={active ? 'step' : undefined}
                title={`${dest.numberLabel} — ${title}`}
                className="group flex items-center gap-2 px-1.5 py-1 rounded-lg transition cursor-pointer"
              >
                <span
                  className={`text-[11px] font-medium max-w-[130px] truncate transition-all ${
                    active
                      ? 'text-[#FAF7F0] opacity-100'
                      : 'text-white/55 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {title}
                </span>
                <span
                  className={`text-[10px] font-bold tabular-nums ${
                    active ? 'text-[#D4AF37]' : 'text-white/50 group-hover:text-white/85'
                  }`}
                >
                  {lang === 'bn' ? toBanglaDigits(dest.numberLabel) : dest.numberLabel}
                </span>
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    active
                      ? 'w-1.5 h-6 bg-[#D4AF37]'
                      : 'w-1.5 h-2.5 bg-white/30 group-hover:bg-white/65'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </aside>

      {/* Mobile Compact Documentary Progress Pill (01/04 .. 04/04) */}
      <nav
        aria-label={lang === 'bn' ? 'গন্তব্য অগ্রগতি' : 'Destination Progress'}
        className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#07140D]/85 backdrop-blur-md px-3.5 py-1.5 text-xs text-[#FAF7F0] shadow-2xl max-w-[calc(100vw-2rem)]"
      >
        <span className="font-bold tracking-wider text-[#F2D184] tabular-nums shrink-0">
          {progressText}
        </span>
        <span className="h-3 w-px bg-white/20 shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-1.5 shrink-0">
          {destinations.map((dest, idx) => {
            const active = idx === activeSceneIndex;
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => jumpToScene(idx)}
                aria-label={`${dest.numberLabel} ${lang === 'bn' ? dest.name_bn : dest.name_en}`}
                aria-current={active ? 'step' : undefined}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  active ? 'w-6 bg-[#D4AF37]' : 'w-2 bg-white/30'
                }`}
              />
            );
          })}
        </div>
        <span className="text-[11px] font-medium text-white/85 truncate max-w-[130px]">
          {lang === 'bn' ? activeDest.name_bn : activeDest.name_en}
        </span>
      </nav>

      {/* Expanded Destination Detail Modal */}
      {selectedDest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
          onClick={() => setSelectedId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#FAF7F0] dark:bg-[#131F19] border border-[#14452F]/15 dark:border-white/15 shadow-2xl"
          >
            {/* Modal Media Viewer (Muted video only) */}
            <div className="relative bg-[#0B1F16]">
              {detailViewMode === 'youtube' &&
              toYouTubeEmbedUrl(selectedDest.youtube_url, { muted: true }) &&
              isOnline &&
              !videoFallback ? (
                <div className="aspect-video w-full">
                  <iframe
                    src={toYouTubeEmbedUrl(selectedDest.youtube_url, { muted: true }) || ''}
                    title={selectedDest.name_en}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    onError={() => setVideoFallback(true)}
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                <div className="relative aspect-[16/10] sm:aspect-video w-full overflow-hidden">
                  <img
                    src={resolvePhotoUrl(
                      selectedDest,
                      selectedDest.photos[activePhotoIndex]?.url,
                    )}
                    alt={selectedDest.name_en}
                    onError={() =>
                      markImageFailed(selectedDest.photos[activePhotoIndex]?.url || '')
                    }
                    className="h-full w-full object-cover"
                  />
                  {selectedDest.photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setActivePhotoIndex(
                            (i) => (i - 1 + selectedDest.photos.length) % selectedDest.photos.length,
                          )
                        }
                        aria-label="Previous photo"
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 hover:bg-black/75 text-white p-2 cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActivePhotoIndex((i) => (i + 1) % selectedDest.photos.length)
                        }
                        aria-label="Next photo"
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 hover:bg-black/75 text-white p-2 cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  {(selectedDest.photos[activePhotoIndex]?.caption_bn ||
                    selectedDest.photos[activePhotoIndex]?.caption_en) && (
                    <div className="absolute bottom-3 left-4 right-4 rounded-xl bg-black/55 backdrop-blur-xs px-3 py-1.5 text-xs text-white">
                      {lang === 'bn'
                        ? selectedDest.photos[activePhotoIndex].caption_bn
                        : selectedDest.photos[activePhotoIndex].caption_en}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close modal"
                className="absolute top-3 right-3 rounded-full bg-black/60 hover:bg-black/80 text-white p-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailViewMode('gallery')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                      detailViewMode === 'gallery'
                        ? 'bg-[#14452F] text-white dark:bg-[#D4AF37] dark:text-[#0E1612]'
                        : 'bg-black/5 dark:bg-white/10'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'bn' ? 'ছবির গ্যালারি' : 'Photos'} ({selectedDest.photos.length})
                    </span>
                  </button>

                  {toYouTubeEmbedUrl(selectedDest.youtube_url, { muted: true }) && (
                    <button
                      type="button"
                      onClick={() => {
                        setVideoFallback(false);
                        setDetailViewMode('youtube');
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                        detailViewMode === 'youtube'
                          ? 'bg-[#C45C3E] text-white'
                          : 'bg-black/5 dark:bg-white/10'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'ইউটিউব ভিডিও (নিঃশব্দ)' : 'YouTube Video (Muted)'}</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => navigateDetail(-1)}
                    className="inline-flex items-center gap-1 rounded-xl border border-black/10 dark:border-white/15 px-3 py-1.5 font-semibold hover:bg-black/5 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'আগের' : 'Prev'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateDetail(1)}
                    className="inline-flex items-center gap-1 rounded-xl border border-black/10 dark:border-white/15 px-3 py-1.5 font-semibold hover:bg-black/5 cursor-pointer"
                  >
                    <span>{lang === 'bn' ? 'পরবর্তী' : 'Next'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {detailViewMode === 'gallery' && selectedDest.photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedDest.photos.map((photo, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setActivePhotoIndex(pIdx)}
                      className={`shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 cursor-pointer ${
                        activePhotoIndex === pIdx
                          ? 'border-[#C45C3E]'
                          : 'border-transparent opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={resolvePhotoUrl(selectedDest, photo.url)}
                        alt={photo.caption_en || selectedDest.name_en}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#C45C3E]">
                  <span>{selectedDest.numberLabel}</span>
                  <span>•</span>
                  <span>{lang === 'bn' ? selectedDest.name_en : selectedDest.name_bn}</span>
                </div>
                <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-[#14452F] dark:text-[#FAF7F0] mt-1">
                  {lang === 'bn' ? selectedDest.name_bn : selectedDest.name_en}
                </h3>
                <p className="mt-2.5 text-sm sm:text-base text-[#3F4D45] dark:text-[#C5D1C9] leading-relaxed">
                  {lang === 'bn' ? selectedDest.description_bn : selectedDest.description_en}
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-[#0D1511] border border-[#14452F]/10 dark:border-white/10 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[#5C6A62] mb-2">
                  {lang === 'bn' ? 'বিশেষ আকর্ষণ' : 'Destination Highlights'}
                </div>
                <ul className="space-y-1.5 text-sm">
                  {(lang === 'bn' ? selectedDest.highlights_bn : selectedDest.highlights_en).map(
                    (h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#C45C3E] font-bold">•</span>
                        <span>{h}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/10">
                <a
                  href={`https://www.openstreetmap.org/?mlat=${selectedDest.lat}&mlon=${selectedDest.lng}#map=16/${selectedDest.lat}/${selectedDest.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#14452F]/10 dark:bg-[#D4AF37]/15 text-[#14452F] dark:text-[#D4AF37] px-4 py-2 text-xs font-bold hover:underline"
                >
                  <MapPin className="w-4 h-4" />
                  <span>
                    {lang === 'bn'
                      ? `${selectedDest.location_label_bn} — ম্যাপে দেখুন`
                      : `Open ${selectedDest.location_label_en} on OpenStreetMap`}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedDest;
                      setSelectedId(null);
                      setEditingDest(JSON.parse(JSON.stringify(target)) as ExploreDestination);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#14452F] text-white px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    <Settings2 className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'মিডিয়া কনফিগার করুন' : 'Configure Media'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Media Configuration Modal */}
      {editingDest && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs sm:p-4 overflow-y-auto"
          onClick={() => setEditingDest(null)}
        >
          <form
            onSubmit={handleSaveMedia}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#FAF7F0] dark:bg-[#131F19] border border-[#14452F]/15 dark:border-white/15 p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div>
                <div className="text-xs font-bold text-[#C45C3E]">
                  {editingDest.numberLabel} • {lang === 'bn' ? 'মিডিয়া কনফিগারেশন' : 'MEDIA CONFIGURATION'}
                </div>
                <h4 className="font-editorial text-xl font-bold">
                  {lang === 'bn' ? editingDest.name_bn : editingDest.name_en}
                </h4>
              </div>
              <button type="button" onClick={() => setEditingDest(null)} className="p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {lang === 'bn' ? 'কার্ডে প্রদর্শিত প্রধান মিডিয়া' : 'Primary Scene Display Mode'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDest({ ...editingDest, media_mode: 'gallery' })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                    editingDest.media_mode === 'gallery'
                      ? 'bg-[#14452F] text-white border-[#14452F]'
                      : 'border-black/15 dark:border-white/15'
                  }`}
                >
                  {lang === 'bn' ? 'ছবির গ্যালারি' : 'Photo Gallery'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDest({ ...editingDest, media_mode: 'youtube' })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                    editingDest.media_mode === 'youtube'
                      ? 'bg-[#C45C3E] text-white border-[#C45C3E]'
                      : 'border-black/15 dark:border-white/15'
                  }`}
                >
                  {lang === 'bn' ? 'ইউটিউব ভিডিও' : 'YouTube Video'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                {lang === 'bn' ? 'YouTube ভিডিও লিংক (ঐচ্ছিক)' : 'YouTube Video URL (Optional)'}
              </label>
              <input
                type="url"
                value={editingDest.youtube_url}
                onChange={(e) =>
                  setEditingDest({ ...editingDest, youtube_url: e.target.value })
                }
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3.5 py-2 text-xs"
              />
              {editingDest.youtube_url.trim() && (
                <p
                  className={`mt-1 text-[11px] font-medium ${
                    extractYouTubeId(editingDest.youtube_url)
                      ? 'text-[#14452F] dark:text-[#A9E0BE]'
                      : 'text-[#C45C3E]'
                  }`}
                >
                  {extractYouTubeId(editingDest.youtube_url)
                    ? `✓ Valid YouTube ID: ${extractYouTubeId(editingDest.youtube_url)}`
                    : lang === 'bn'
                      ? 'সঠিক YouTube লিংক দিন'
                      : 'Invalid YouTube URL format'}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold">
                  {lang === 'bn' ? 'গ্যালারির ছবিসমূহ' : 'Gallery Photographs'}
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setEditingDest({
                      ...editingDest,
                      photos: [
                        ...editingDest.photos,
                        { url: '', caption_bn: '', caption_en: '' },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#14452F] dark:text-[#D4AF37] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'ছবি যোগ করুন' : 'Add Photo'}</span>
                </button>
              </div>

              {editingDest.photos.map((photo, pIdx) => (
                <div
                  key={pIdx}
                  className="rounded-2xl bg-white dark:bg-[#0D1511] border border-black/10 dark:border-white/10 p-3 space-y-2"
                >
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={photo.url}
                      onChange={(e) => {
                        const next = [...editingDest.photos];
                        next[pIdx] = { ...next[pIdx], url: e.target.value };
                        setEditingDest({ ...editingDest, photos: next });
                      }}
                      placeholder="Image URL (/images/... or https://...)"
                      className="flex-1 rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = editingDest.photos.filter((_, i) => i !== pIdx);
                        setEditingDest({ ...editingDest, photos: next });
                      }}
                      className="p-1.5 text-[#C45C3E] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={photo.caption_bn}
                      onChange={(e) => {
                        const next = [...editingDest.photos];
                        next[pIdx] = { ...next[pIdx], caption_bn: e.target.value };
                        setEditingDest({ ...editingDest, photos: next });
                      }}
                      placeholder="Caption (Bangla)"
                      className="rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={photo.caption_en}
                      onChange={(e) => {
                        const next = [...editingDest.photos];
                        next[pIdx] = { ...next[pIdx], caption_en: e.target.value };
                        setEditingDest({ ...editingDest, photos: next });
                      }}
                      placeholder="Caption (English)"
                      className="rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10">
              <button
                type="button"
                onClick={handleResetDestination}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#5C6A62] hover:text-[#C45C3E] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'ডিফল্ট রিসেট' : 'Reset to Placeholder'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDest(null)}
                  className="px-4 py-2 text-xs font-medium"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={savingMedia}
                  className="rounded-xl bg-[#14452F] text-white px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  {savingMedia ? '...' : lang === 'bn' ? 'মিডিয়া সেভ করুন' : 'Save Media'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
