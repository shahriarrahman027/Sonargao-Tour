import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Camera,
  CheckSquare,
  ChevronDown,
  Clock,
  Compass,
  MapPin,
  Megaphone,
  Radio,
  Wallet,
} from 'lucide-react';
import { useTour } from '../context/TourContext';
import { DEFAULT_TOUR_SETTINGS } from '../data/defaultSeed';
import { formatBDT, formatDateTime, toBanglaDigits, translations } from '../lib/i18n';
import { toYouTubeBackgroundEmbedUrl } from '../lib/media';
import type { NavTab } from './Navbar';

interface Props {
  onNavigate: (tab: NavTab) => void;
}

function getCountdown(targetIso: string) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) {
    return { isLive: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { isLive: false, days, hours, minutes, seconds };
}

export const HomepageSection: React.FC<Props> = ({ onNavigate }) => {
  const { lang, state, finance, isOnline } = useTour();
  const t = translations[lang];
  const settings = state?.settings;

  const [countdown, setCountdown] = useState(() =>
    getCountdown(settings?.tour_date || '2026-11-28T06:30:00+06:00'),
  );
  const [videoFailed, setVideoFailed] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const heroVideoSource =
    settings?.hero_video_url?.trim() || DEFAULT_TOUR_SETTINGS.hero_video_url;
  const heroYouTubeEmbed = toYouTubeBackgroundEmbedUrl(heroVideoSource);

  useEffect(() => {
    setVideoFailed(false);
    setIframeLoaded(false);
  }, [heroVideoSource]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCountdown(getCountdown(settings?.tour_date || '2026-11-28T06:30:00+06:00'));
    }, 1000);
    return () => clearInterval(id);
  }, [settings?.tour_date]);

  if (!state || !finance || !settings) return null;

  const completedChecklist = state.checklist.filter((c) => c.is_completed).length;

  const highlights = [
    {
      tag: lang === 'bn' ? 'সকাল ১০:০০' : '10:00 AM',
      title: lang === 'bn' ? 'পানাম নগর, সোনারগাঁও' : 'Panam Nagar, Sonargaon',
      desc:
        lang === 'bn'
          ? 'শতবর্ষী ঐতিহাসিক ইমারত, সারিবাঁধা খিলান আর বন্ধুদের সাথে অসাধারণ ফটোফ্রেম।'
          : 'Century-old merchant mansions, weathered terracotta arches, and timeless group frames.',
      accent: 'border-[#C45C3E]/30 bg-[#C45C3E]/6',
    },
    {
      tag: lang === 'bn' ? 'দুপুর ১২:০০' : '12:00 PM',
      title: lang === 'bn' ? 'লোকশিল্প জাদুঘর ও গোয়ালদী' : 'Folk Arts Museum & Goaldi',
      desc:
        lang === 'bn'
          ? 'বাংলার ঐতিহ্যবাহী কারুশিল্প, লেকপাড়ের বাতাস এবং সুলতানি আমলের স্থাপত্য।'
          : 'Heritage crafts, tranquil lakeside breeze, and Sultanate-era Goaldi Mosque.',
      accent: 'border-[#14452F]/25 bg-[#14452F]/6',
    },
    {
      tag: lang === 'bn' ? 'সন্ধ্যা ৫:০০' : '05:00 PM',
      title: lang === 'bn' ? 'পুরান ঢাকা সন্ধ্যার ফিস্ট' : 'Puran Dhaka Evening Feast',
      desc:
        lang === 'bn'
          ? 'লালবাগ ও চকবাজারের অলিগলি ঘুরে নাজিরাবাজারের বিরিয়ানি আর বিউটি লাচ্ছির আড্ডা।'
          : 'Rickshaw rides through Old Dhaka lanes ending with biriyani and chilled lassi.',
      accent: 'border-[#C89F3C]/35 bg-[#C89F3C]/8',
    },
  ];

  const pad = (n: number) => {
    const s = String(n).padStart(2, '0');
    return lang === 'bn' ? toBanglaDigits(s) : s;
  };

  return (
    <div className="space-y-14 pb-16">
      {/* FULL-SCREEN CINEMATIC HERO */}
      <section className="relative min-h-[88vh] flex flex-col justify-between overflow-hidden bg-[#0E2D1E] text-[#FAF7F0]">
        {/* Fallback Heritage Artwork (always rendered beneath while video loads or if offline/blocked) */}
        <img
          src={settings.hero_fallback_image_url || '/images/panam-hero.svg'}
          alt="Panam Nagar Heritage"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75 scale-105 transition-transform duration-[18s]"
        />

        {/* Responsive Background Video: YouTube Embed or Direct Video URL */}
        {heroVideoSource && !videoFailed && isOnline && (
          heroYouTubeEmbed ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <iframe
                src={heroYouTubeEmbed}
                title="Homepage background video"
                allow="autoplay; encrypted-media; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                tabIndex={-1}
                onLoad={() => setIframeLoaded(true)}
                onError={() => setVideoFailed(true)}
                style={{
                  width: 'max(100vw, 177.78vh)',
                  height: 'max(100vh, 56.25vw)',
                }}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-700 ${
                  iframeLoaded ? 'opacity-80' : 'opacity-0'
                }`}
              />
            </div>
          ) : (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={settings.hero_fallback_image_url || '/images/panam-hero.svg'}
              onError={() => setVideoFailed(true)}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-65"
            >
              <source src={heroVideoSource} />
            </video>
          )
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A2015]/82 via-[#0E2D1E]/62 to-[#0A1911]/95" />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-12 sm:pt-16 pb-10 flex-1 flex flex-col justify-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3.5 py-1 text-xs font-semibold tracking-wider text-[#F2D184]">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {lang === 'bn'
                  ? '২৮ নভেম্বর ২০২৬ • শনিবার • ১ দিনের ট্যুর'
                  : '28 November 2026 • Saturday • 1-Day Expedition'}
              </span>
            </div>

            <h1 className="font-editorial mt-5 text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.12]">
              {lang === 'bn' ? settings.website_name_bn : settings.website_name_en}
            </h1>

            <p className="mt-3 text-lg sm:text-2xl font-medium text-[#E9A690]">
              “{lang === 'bn' ? settings.tagline_bn : settings.tagline_en}”
            </p>

            {/* Key Facts Row */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/8 backdrop-blur-xs px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-white/65">
                  {t.hero.dateLabel}
                </div>
                <div className="font-semibold text-sm mt-0.5">
                  {lang === 'bn' ? '২৮ নভেম্বর ২০২৬, সকাল ৬:৩০' : '28 Nov 2026, 6:30 AM'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/8 backdrop-blur-xs px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-white/65">
                  {t.hero.routeLabel}
                </div>
                <div className="font-semibold text-sm mt-0.5 truncate">
                  {lang === 'bn'
                    ? `${settings.start_location_bn} → সোনারগাঁও → পুরান ঢাকা`
                    : `${settings.start_location_en} → Sonargaon → Puran Dhaka`}
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/8 backdrop-blur-xs px-4 py-3">
                <div className="text-[11px] uppercase tracking-wider text-white/65">
                  {t.hero.budgetLabel}
                </div>
                <div className="font-semibold text-sm mt-0.5">
                  {formatBDT(settings.estimated_budget_per_person, lang)} / {t.hero.perPerson}
                </div>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="mt-7">
              <div className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mb-2">
                {countdown.isLive ? t.common.tourDayLive : t.hero.countdownTitle}
              </div>
              {!countdown.isLive && (
                <div className="inline-grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    [countdown.days, t.common.days],
                    [countdown.hours, t.common.hours],
                    [countdown.minutes, t.common.minutes],
                    [countdown.seconds, t.common.seconds],
                  ].map(([val, label], i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/15 bg-[#0A1F15]/80 px-3.5 sm:px-5 py-2.5 text-center min-w-[68px]"
                    >
                      <div className="font-editorial text-2xl sm:text-3xl font-bold text-[#FAF7F0]">
                        {pad(Number(val))}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-white/65">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('money')}
                className="inline-flex items-center gap-2 rounded-full bg-[#C89F3C] hover:bg-[#D4AF37] text-[#0E1612] px-6 py-3 text-sm font-bold shadow-lg transition cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>{t.hero.exploreMoney}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('journey')}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 text-white px-6 py-3 text-sm font-semibold transition cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>{t.hero.explorePlan}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <a
          href="#overview"
          className="relative z-10 pb-6 flex flex-col items-center gap-1 text-xs text-white/70 hover:text-white transition"
        >
          <span>{t.hero.scrollHint}</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </a>
      </section>

      {/* BELOW HERO EDITORIAL SECTIONS */}
      <div id="overview" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        {/* Announcement + Live Tour Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {(settings.announcement_bn || settings.announcement_en) && (
            <div className="lg:col-span-7 rounded-3xl border border-[#C45C3E]/25 bg-[#C45C3E]/8 p-5 sm:p-6 flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-[#C45C3E] text-white shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#C45C3E]">
                  {lang === 'bn' ? 'গুরুত্বপূর্ণ ঘোষণা' : 'Important Announcement'}
                </div>
                <p className="mt-1 text-sm sm:text-base font-medium leading-relaxed">
                  {lang === 'bn' ? settings.announcement_bn : settings.announcement_en}
                </p>
              </div>
            </div>
          )}

          <div className="lg:col-span-5 rounded-3xl border border-[#14452F]/15 dark:border-white/10 bg-white dark:bg-[#131F19] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#14452F] dark:text-[#A9E0BE]">
                <Radio className="w-3.5 h-3.5 animate-pulse text-[#C45C3E]" />
                {lang === 'bn' ? 'লাইভ ট্যুর স্ট্যাটাস' : 'Live Tour Status'}
              </span>
              <span className="text-[11px] text-[#5C6A62]">
                {formatDateTime(state.progress.updated_at, lang)}
              </span>
            </div>
            <div className="mt-2 font-editorial text-lg font-bold">
              {lang === 'bn' ? state.progress.current_stage_bn : state.progress.current_stage_en}
            </div>
            <div className="mt-1 text-xs text-[#4A5850] dark:text-[#B9C4BC] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#C45C3E]" />
              <span>
                {lang === 'bn' ? state.progress.current_location_bn : state.progress.current_location_en}
              </span>
            </div>
            <div className="mt-2 text-xs text-[#5C6A62] dark:text-[#9AA89F]">
              {lang === 'bn' ? 'পরবর্তী গন্তব্য:' : 'Next:'}{' '}
              <strong>
                {lang === 'bn' ? state.progress.next_destination_bn : state.progress.next_destination_en}
              </strong>
            </div>
          </div>
        </div>

        {/* Destination Highlights */}
        <div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
                {lang === 'bn' ? 'গন্তব্য ও অভিজ্ঞতা' : 'DESTINATION HIGHLIGHTS'}
              </span>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold mt-1">
                {lang === 'bn' ? 'সকাল থেকে রাত — এক দিনের গল্প' : 'Dawn to Night — One Day Journal'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('journey')}
              className="text-xs font-bold text-[#14452F] dark:text-[#D4AF37] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{lang === 'bn' ? 'সম্পূর্ণ রুট ও ম্যাপ' : 'Full Route & Map'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {highlights.map((h, i) => (
              <div key={i} className={`rounded-3xl border p-6 ${h.accent}`}>
                <span className="inline-block rounded-full bg-white/80 dark:bg-black/25 px-3 py-1 text-xs font-bold">
                  {h.tag}
                </span>
                <h3 className="font-editorial text-xl font-bold mt-3">{h.title}</h3>
                <p className="mt-2 text-sm text-[#3F4D45] dark:text-[#C5D1C9] leading-relaxed">
                  {h.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Fund Summary + Upcoming Itinerary + Checklist & Photos Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upcoming Itinerary Preview */}
          <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-editorial text-xl font-bold">
                {lang === 'bn' ? 'রুট ও সময়সূচি প্রিভিউ' : 'Route & Itinerary Preview'}
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('journey')}
                className="text-xs font-semibold text-[#14452F] dark:text-[#D4AF37] cursor-pointer"
              >
                {lang === 'bn' ? 'সব দেখুন →' : 'View all →'}
              </button>
            </div>
            <div className="space-y-3">
              {state.itinerary.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 pb-3 border-b border-black/5 dark:border-white/5 last:border-0"
                >
                  <div className="shrink-0 rounded-xl bg-[#14452F]/10 dark:bg-[#D4AF37]/15 px-2.5 py-1.5 text-xs font-bold text-[#14452F] dark:text-[#D4AF37] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{item.time_label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">
                      {lang === 'bn' ? item.title_bn : item.title_en}
                    </div>
                    <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">
                      {lang === 'bn' ? item.location_bn : item.location_en} •{' '}
                      {formatBDT(item.estimated_cost, lang)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fund, Checklist, Photos Summary */}
          <div className="lg:col-span-5 space-y-4">
            <div
              onClick={() => onNavigate('money')}
              className="rounded-3xl bg-[#14452F] text-[#FAF7F0] p-6 cursor-pointer hover:bg-[#185238] transition"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#D4AF37] font-semibold">
                <span>{lang === 'bn' ? 'ফান্ড সারাংশ' : 'Fund Summary'}</span>
                <Wallet className="w-4 h-4" />
              </div>
              <div className="font-editorial text-3xl font-bold mt-2">
                {formatBDT(finance.remainingGroupCash, lang)}
              </div>
              <div className="text-xs text-white/75 mt-1">
                {lang === 'bn' ? 'জমা:' : 'Collected:'} {formatBDT(finance.totalCollected, lang)} •{' '}
                {lang === 'bn' ? 'খরচ:' : 'Spent:'} {formatBDT(finance.totalAllExpenses, lang)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => onNavigate('checklist')}
                className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4 cursor-pointer hover:border-[#14452F]/40 transition"
              >
                <CheckSquare className="w-5 h-5 text-[#14452F] dark:text-[#D4AF37]" />
                <div className="font-editorial text-xl font-bold mt-2">
                  {completedChecklist}/{state.checklist.length}
                </div>
                <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">
                  {lang === 'bn' ? 'চেকলিস্ট সম্পন্ন' : 'Checklist Done'}
                </div>
              </div>

              <div
                onClick={() => onNavigate('photos')}
                className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4 cursor-pointer hover:border-[#14452F]/40 transition"
              >
                <Camera className="w-5 h-5 text-[#C45C3E]" />
                <div className="font-editorial text-xl font-bold mt-2">{state.photos.length}</div>
                <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">
                  {lang === 'bn' ? 'শেয়ার্ড ছবি' : 'Shared Memories'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Crew Preview */}
        <div>
          <div className="flex items-end justify-between mb-4">
            <h3 className="font-editorial text-2xl font-bold">
              {lang === 'bn' ? 'আমাদের ৬ বন্ধুর টিম' : 'The Six-Friend Crew'}
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('crew')}
              className="text-xs font-semibold text-[#14452F] dark:text-[#D4AF37] cursor-pointer"
            >
              {lang === 'bn' ? 'প্রোফাইল দেখুন →' : 'Meet everyone →'}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {state.members.map((m) => (
              <div
                key={m.id}
                onClick={() => onNavigate('crew')}
                className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4 text-center cursor-pointer hover:-translate-y-0.5 transition"
              >
                <div className="w-12 h-12 rounded-full mx-auto bg-[#14452F] text-[#FAF7F0] flex items-center justify-center font-editorial font-bold text-lg">
                  {m.name_en.slice(0, 1)}
                </div>
                <div className="font-bold text-sm mt-2.5">
                  {lang === 'bn' ? m.name_bn : m.name_en}
                </div>
                <div className="text-[11px] text-[#C45C3E] font-medium">
                  {lang === 'bn' ? m.badge_title_bn : m.badge_title_en}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
