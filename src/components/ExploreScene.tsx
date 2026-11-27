import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  Settings2,
} from 'lucide-react';
import { resolveExploreVideoUrl } from '../config/exploreVideos';
import { toBanglaDigits } from '../lib/i18n';
import { toYouTubeBackgroundEmbedUrl } from '../lib/media';
import type { ExploreDestination, Language } from '../types/tour';

interface ExploreSceneProps {
  dest: ExploreDestination;
  index: number;
  total: number;
  lang: Language;
  isActive: boolean;
  isNearViewport: boolean;
  isOnline: boolean;
  isAdmin: boolean;
  prefersReducedMotion: boolean;
  nextDestination?: ExploreDestination;
  onSceneRef: (index: number, el: HTMLElement | null) => void;
  onOpenDetails: (dest: ExploreDestination) => void;
  onConfigureMedia: (dest: ExploreDestination) => void;
  onJumpToScene: (index: number) => void;
}

export const ExploreScene: React.FC<ExploreSceneProps> = ({
  dest,
  index,
  total,
  lang,
  isActive,
  isNearViewport,
  isOnline,
  isAdmin,
  prefersReducedMotion,
  nextDestination,
  onSceneRef,
  onOpenDetails,
  onConfigureMedia,
  onJumpToScene,
}) => {
  const localRef = useRef<HTMLElement | null>(null);
  const bgLayerRef = useRef<HTMLDivElement | null>(null);

  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const effectiveVideoUrl = resolveExploreVideoUrl(dest.id, dest.youtube_url);
  const bgEmbedUrl = toYouTubeBackgroundEmbedUrl(effectiveVideoUrl);
  const shouldMountVideo =
    Boolean(bgEmbedUrl) &&
    isOnline &&
    !videoFailed &&
    isNearViewport;

  // Keep unmount check tightly tied to active/adjacent window via parent prop `isNearViewport`,
  // while tracking load state whenever URL or mount state changes.
  useEffect(() => {
    setIframeLoaded(false);
    setVideoFailed(false);
  }, [bgEmbedUrl]);

  useEffect(() => {
    if (!shouldMountVideo) {
      setIframeLoaded(false);
      return;
    }
    if (iframeLoaded) return;
    const timeoutId = window.setTimeout(() => {
      setVideoFailed(true);
    }, 15000);
    return () => window.clearTimeout(timeoutId);
  }, [shouldMountVideo, iframeLoaded]);

  // Subtle GPU-only parallax drift on scroll (skipped if prefers-reduced-motion)
  useEffect(() => {
    if (prefersReducedMotion) {
      if (bgLayerRef.current) {
        bgLayerRef.current.style.transform = '';
      }
      return;
    }

    let rafId = 0;
    const updateParallax = () => {
      rafId = 0;
      const sectionEl = localRef.current;
      const bgEl = bgLayerRef.current;
      if (!sectionEl || !bgEl) return;

      const rect = sectionEl.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      if (rect.bottom < -vh * 0.5 || rect.top > vh * 1.5) return;

      // Normalized offset in [-1, 1] relative to viewport center
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
      const shiftY = Math.max(-28, Math.min(28, progress * -26));
      const scale = isActive ? 1.03 : 1.08;
      bgEl.style.transform = `translate3d(0, ${shiftY.toFixed(1)}px, 0) scale(${scale})`;
    };

    const schedule = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateParallax);
      }
    };

    updateParallax();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [prefersReducedMotion, isActive]);

  const setRefs = (el: HTMLElement | null) => {
    localRef.current = el;
    onSceneRef(index, el);
  };

  const sceneCounter =
    lang === 'bn'
      ? `${toBanglaDigits(dest.numberLabel)} / ${toBanglaDigits(String(total).padStart(2, '0'))}`
      : `${dest.numberLabel} / ${String(total).padStart(2, '0')}`;

  const revealClass = prefersReducedMotion
    ? 'opacity-100 translate-y-0'
    : isActive || isNearViewport
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-6';

  const highlights = (lang === 'bn' ? dest.highlights_bn : dest.highlights_en).slice(0, 3);

  return (
    <section
      ref={setRefs}
      id={`explore-scene-${dest.id}`}
      data-scene-index={index}
      aria-label={`${dest.numberLabel} ${lang === 'bn' ? dest.name_bn : dest.name_en}`}
      className="relative min-h-[calc(100svh-4rem)] w-full overflow-hidden bg-[#07140D] text-[#FAF7F0] flex flex-col justify-between"
    >
      {/* Background Visual Layer (Parallax Fallback Artwork + Lazy Muted YouTube Video) */}
      <div
        ref={bgLayerRef}
        className="explore-motion pointer-events-none absolute -inset-[7%] overflow-hidden transition-transform duration-1000 ease-out will-change-transform"
      >
        <img
          src={dest.fallback_image_url}
          alt={`${dest.name_en} — ${dest.name_bn}`}
          className={`explore-motion h-full w-full object-cover transition-transform duration-[1800ms] ease-out ${
            !prefersReducedMotion && isActive ? 'scale-100' : 'scale-105'
          } opacity-75`}
        />

        {shouldMountVideo && bgEmbedUrl && (
          <iframe
            src={bgEmbedUrl}
            title={`${dest.name_en} background film`}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
            aria-hidden="true"
            onLoad={() => setIframeLoaded(true)}
            onError={() => setVideoFailed(true)}
            style={{
              width: 'max(100%, 177.78svh)',
              height: 'max(100%, 56.25vw)',
            }}
            className={`explore-motion pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-1000 ${
              iframeLoaded ? 'opacity-90' : 'opacity-0'
            }`}
          />
        )}
      </div>

      {/* Multi-stop Documentary Gradient Overlays for Legibility & Seamless Scene Transitions */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#07140D]/85 via-[#081910]/35 to-[#07140D]/92" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#07140D]/88 via-[#07140D]/52 to-transparent sm:to-[#07140D]/20" />

      {/* Top Documentary Chapter Strip */}
      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-8 pt-7 sm:pt-10 flex flex-wrap items-center justify-between gap-3">
        <div
          className={`explore-motion inline-flex items-center gap-2.5 rounded-full border border-[#D4AF37]/35 bg-[#07140D]/60 backdrop-blur-md px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#F2D184] transition-all duration-700 ${revealClass}`}
        >
          <span>{lang === 'bn' ? `অধ্যায় ${sceneCounter}` : `CHAPTER ${sceneCounter}`}</span>
          <span className="h-1 w-1 rounded-full bg-[#C45C3E]" aria-hidden="true" />
          <span className="text-[#FAF7F0]/85 tracking-normal normal-case font-medium truncate max-w-[180px] sm:max-w-none">
            {lang === 'bn' ? dest.location_label_bn : dest.location_label_en}
          </span>
        </div>

        {!isOnline && (
          <span className="rounded-full border border-white/15 bg-black/45 backdrop-blur-xs px-3 py-1 text-[11px] font-medium text-white/80">
            {lang === 'bn' ? 'অফলাইন ব্যাকড্রপ' : 'Offline Backdrop'}
          </span>
        )}
      </div>

      {/* Main Foreground Editorial Documentary Copy */}
      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-8 py-10 sm:py-14 pb-36 md:pb-24 lg:pb-16 flex-1 flex flex-col justify-end">
        <div className="max-w-3xl space-y-4 sm:space-y-5">
          {/* Bilingual secondary title */}
          <div
            className={`explore-motion text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-[#F2D184] transition-all duration-700 delay-75 ${revealClass}`}
          >
            {dest.numberLabel} — {lang === 'bn' ? dest.name_en : dest.name_bn}
          </div>

          {/* Primary Destination Display Title */}
          <h2
            className={`explore-motion font-editorial text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] text-[#FAF7F0] drop-shadow-sm transition-all duration-700 delay-150 ${revealClass}`}
          >
            {lang === 'bn' ? dest.name_bn : dest.name_en}
          </h2>

          {/* Tagline */}
          <p
            className={`explore-motion text-base sm:text-xl font-medium text-[#E9A690] transition-all duration-700 delay-200 ${revealClass}`}
          >
            {lang === 'bn' ? dest.tagline_bn : dest.tagline_en}
          </p>

          {/* Narrative Description */}
          <p
            className={`explore-motion text-sm sm:text-base text-[#FAF7F0]/85 leading-relaxed max-w-2xl transition-all duration-700 delay-300 ${revealClass}`}
          >
            {lang === 'bn' ? dest.description_bn : dest.description_en}
          </p>

          {/* Subtle Editorial Highlight Chips */}
          <div
            className={`explore-motion flex flex-wrap gap-2 pt-1 transition-all duration-700 delay-300 ${revealClass}`}
          >
            {highlights.map((item, hIdx) => (
              <span
                key={hIdx}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#0A1F15]/60 backdrop-blur-xs px-3 py-1 text-xs text-[#FAF7F0]/90"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" aria-hidden="true" />
                <span>{item}</span>
              </span>
            ))}
          </div>

          {/* Interactive Actions (Clean, Floating, Non-Card) */}
          <div
            className={`explore-motion flex flex-wrap items-center gap-2.5 pt-2 transition-all duration-700 delay-300 ${revealClass}`}
          >
            <button
              type="button"
              onClick={() => onOpenDetails(dest)}
              className="inline-flex items-center gap-2 rounded-full bg-[#C89F3C] hover:bg-[#D4AF37] text-[#0E1612] px-5 py-2.5 text-xs sm:text-sm font-bold shadow-lg transition cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              <span>
                {lang === 'bn' ? 'গ্যালারি ও বিস্তারিত' : 'Scene Details & Photos'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <a
              href={`https://www.openstreetmap.org/?mlat=${dest.lat}&mlon=${dest.lng}#map=16/${dest.lat}/${dest.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 backdrop-blur-xs text-[#FAF7F0] px-4 py-2.5 text-xs sm:text-sm font-semibold transition"
            >
              <MapPin className="w-4 h-4 text-[#E9A690]" />
              <span>{lang === 'bn' ? 'ম্যাপ দেখুন' : 'Map'}</span>
            </a>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onConfigureMedia(dest)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#0A1F15]/70 hover:bg-[#14452F] text-[#F2D184] px-4 py-2.5 text-xs font-semibold backdrop-blur-xs transition cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'মিডিয়া সেট' : 'Configure Media'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Scroll Cue / Next Chapter Link */}
        {index === 0 ? (
          <div className="mt-8 md:mt-10 flex justify-center md:justify-start">
            <button
              type="button"
              onClick={() => onJumpToScene(1)}
              className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 hover:bg-black/55 backdrop-blur-xs px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#FAF7F0]/85 transition cursor-pointer"
            >
              <span>{lang === 'bn' ? 'স্ক্রল করে এগিয়ে যান' : 'Scroll to explore'}</span>
              <ArrowDown
                className={`w-3.5 h-3.5 text-[#D4AF37] ${
                  prefersReducedMotion ? '' : 'animate-bounce'
                }`}
              />
            </button>
          </div>
        ) : nextDestination ? (
          <div className="mt-7 hidden md:flex items-center">
            <button
              type="button"
              onClick={() => onJumpToScene(index + 1)}
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#FAF7F0]/70 hover:text-[#D4AF37] transition cursor-pointer"
            >
              <span>
                {lang === 'bn'
                  ? `পরবর্তী অধ্যায় ${toBanglaDigits(nextDestination.numberLabel)}: ${nextDestination.name_bn}`
                  : `Next Chapter ${nextDestination.numberLabel}: ${nextDestination.name_en}`}
              </span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
