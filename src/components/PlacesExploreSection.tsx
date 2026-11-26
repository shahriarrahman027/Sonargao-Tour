import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useTour } from '../context/TourContext';
import { DEFAULT_EXPLORE_DESTINATIONS } from '../data/defaultSeed';
import { extractYouTubeId, getYouTubeThumbnailUrl, toYouTubeEmbedUrl } from '../lib/media';
import { soundEngine } from '../lib/sound';
import { tourApi } from '../lib/tourApi';
import type { ExploreDestination, ExplorePhoto } from '../types/tour';

export const PlacesExploreSection: React.FC = () => {
  const { lang, state, session, isOnline, refreshState, showToast } = useTour();

  const destinations = useMemo(() => {
    const raw =
      state?.settings.explore_destinations && state.settings.explore_destinations.length === 4
        ? state.settings.explore_destinations
        : DEFAULT_EXPLORE_DESTINATIONS;
    return [...raw].sort((a, b) => a.order - b.order);
  }, [state?.settings.explore_destinations]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [detailViewMode, setDetailViewMode] = useState<'gallery' | 'youtube'>('gallery');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [videoFallback, setVideoFallback] = useState(false);

  // Admin Media Configuration Modal state
  const [editingDest, setEditingDest] = useState<ExploreDestination | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);

  const selectedIndex = destinations.findIndex((d) => d.id === selectedId);
  const selectedDest = selectedIndex >= 0 ? destinations[selectedIndex] : null;
  const isAdmin = Boolean(session?.isAdmin);

  const openDestination = (dest: ExploreDestination) => {
    soundEngine.playTick();
    setSelectedId(dest.id);
    setActivePhotoIndex(0);
    setVideoFallback(false);
    const hasValidVideo = Boolean(toYouTubeEmbedUrl(dest.youtube_url));
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
      showToast(
        lang === 'bn'
          ? 'গন্তব্যের মিডিয়া সংরক্ষিত হয়েছে'
          : 'Destination media saved',
      );
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

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Editorial Section Header */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#14452F]/20 dark:border-[#D4AF37]/30 bg-[#14452F]/6 dark:bg-[#D4AF37]/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[#14452F] dark:text-[#D4AF37]">
          <span>{lang === 'bn' ? '০১ — ০৪ • ঐতিহ্য ও সন্ধ্যার শহর' : '01 — 04 • HERITAGE & CITY NIGHTS'}</span>
        </div>

        <h2 className="font-editorial text-3xl sm:text-5xl font-bold tracking-tight text-[#14452F] dark:text-[#FAF7F0] mt-3">
          {lang === 'bn' ? 'যেসব জায়গা ঘুরে দেখব' : "Places We'll Explore"}
        </h2>
        <p className="text-sm sm:text-base font-medium text-[#C45C3E] dark:text-[#E58A6E] mt-1">
          {lang === 'bn' ? "Places We'll Explore" : 'যেসব জায়গা ঘুরে দেখব'}
        </p>
        <p className="mt-3 text-sm sm:text-base text-[#4A5850] dark:text-[#B9C4BC] leading-relaxed italic">
          {lang === 'bn'
            ? '“একটি দিন, কয়েকটি গন্তব্য, আর অপেক্ষায় থাকা অসংখ্য স্মৃতি।” — A day, a few destinations, countless memories waiting to happen.'
            : '“A day, a few destinations, countless memories waiting to happen.”'}
        </p>
      </div>

      {/* 4 Editorial Destination Cards in Exact Sequence (01 -> 04) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">
        {destinations.map((dest, idx) => {
          const hasValidVideo = Boolean(toYouTubeEmbedUrl(dest.youtube_url));
          const ytThumb = getYouTubeThumbnailUrl(dest.youtube_url);
          const primaryPhoto = dest.photos[0]?.url || dest.fallback_image_url;
          const cardPreviewSrc =
            dest.media_mode === 'youtube' && hasValidVideo && ytThumb && !failedImages[ytThumb]
              ? ytThumb
              : resolvePhotoUrl(dest, primaryPhoto);

          return (
            <article
              key={dest.id}
              onClick={() => openDestination(dest)}
              className={`group relative rounded-3xl overflow-hidden bg-white dark:bg-[#131F19] border border-[#14452F]/12 dark:border-white/10 shadow-sm hover:shadow-xl hover:border-[#C45C3E]/45 dark:hover:border-[#D4AF37]/45 transition-all duration-300 cursor-pointer flex flex-col ${
                idx === 0 ? 'lg:translate-y-0' : idx === 1 ? 'lg:translate-y-2' : ''
              }`}
            >
              {/* Immersive 16:10 Landscape Media Preview */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#102C20]">
                <img
                  src={cardPreviewSrc}
                  alt={`${dest.name_en} — ${dest.name_bn}`}
                  onError={() => markImageFailed(cardPreviewSrc)}
                  className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1911]/85 via-[#0A1911]/20 to-transparent" />

                {/* Number Pill + Media Type Badge */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#FAF7F0]/95 dark:bg-[#0E1612]/90 text-[#14452F] dark:text-[#D4AF37] px-3.5 py-1 text-xs font-bold tracking-widest shadow-sm">
                    {dest.numberLabel}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {hasValidVideo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#C45C3E] text-white px-2.5 py-1 text-[11px] font-semibold shadow-sm">
                        <Video className="w-3 h-3" />
                        <span>{lang === 'bn' ? 'ভিডিও' : 'Video'}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-xs text-white px-2.5 py-1 text-[11px] font-medium">
                      <ImageIcon className="w-3 h-3" />
                      <span>{dest.photos.length}</span>
                    </span>
                  </div>
                </div>

                {/* Play overlay if primary mode is YouTube */}
                {dest.media_mode === 'youtube' && hasValidVideo && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-14 h-14 rounded-full bg-[#FAF7F0]/90 text-[#14452F] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </span>
                  </div>
                )}

                {/* Bottom Overlay Titles */}
                <div className="absolute bottom-4 left-5 right-5 text-[#FAF7F0]">
                  <div className="text-xs font-medium text-[#F2D184]">
                    {lang === 'bn' ? dest.name_en : dest.name_bn}
                  </div>
                  <h3 className="font-editorial text-2xl sm:text-3xl font-bold leading-snug mt-0.5">
                    {lang === 'bn' ? dest.name_bn : dest.name_en}
                  </h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#C45C3E] dark:text-[#E58A6E]">
                    {lang === 'bn' ? dest.tagline_bn : dest.tagline_en}
                  </p>
                  <p className="mt-2 text-sm text-[#3F4D45] dark:text-[#C5D1C9] leading-relaxed">
                    {lang === 'bn' ? dest.description_bn : dest.description_en}
                  </p>
                </div>

                <div className="pt-3 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-[#5C6A62] dark:text-[#9AA89F]">
                    <MapPin className="w-3.5 h-3.5 text-[#C45C3E]" />
                    <span className="truncate max-w-[220px]">
                      {lang === 'bn' ? dest.location_label_bn : dest.location_label_en}
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setEditingDest(JSON.parse(JSON.stringify(dest)) as ExploreDestination);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#14452F]/20 dark:border-white/15 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'মিডিয়া সেট' : 'Configure Media'}</span>
                      </button>
                    )}
                    <span className="font-bold text-[#14452F] dark:text-[#D4AF37] group-hover:underline">
                      {lang === 'bn' ? 'বিস্তারিত দেখুন →' : 'Explore →'}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

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
            {/* Modal Media Viewer */}
            <div className="relative bg-[#0B1F16]">
              {detailViewMode === 'youtube' &&
              toYouTubeEmbedUrl(selectedDest.youtube_url) &&
              isOnline &&
              !videoFallback ? (
                <div className="aspect-video w-full">
                  <iframe
                    src={toYouTubeEmbedUrl(selectedDest.youtube_url) || ''}
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

              {/* Close Modal Button */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close modal"
                className="absolute top-3 right-3 rounded-full bg-black/60 hover:bg-black/80 text-white p-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Controls & Content */}
            <div className="p-5 sm:p-7 space-y-5">
              {/* Media Mode Switcher + Thumbnail Strip */}
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

                  {toYouTubeEmbedUrl(selectedDest.youtube_url) && (
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
                      <span>{lang === 'bn' ? 'ইউটিউব ভিডিও' : 'YouTube Video'}</span>
                    </button>
                  )}
                </div>

                {/* Sequence Switcher 01 <-> 04 */}
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

              {/* Highlights */}
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

              {/* External Map Link + Admin Configure Button */}
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

            {/* Primary Display Mode */}
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                {lang === 'bn' ? 'কার্ডে প্রদর্শিত প্রধান মিডিয়া' : 'Primary Card Display Mode'}
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

            {/* YouTube URL */}
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

            {/* Multiple Photos Gallery Config */}
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
    </section>
  );
};
