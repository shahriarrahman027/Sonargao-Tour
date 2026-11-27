import React, { useState } from 'react';
import {
  Camera,
  CheckSquare,
  ChevronRight,
  FileBarChart,
  Landmark,
  Lock,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  StickyNote,
  Users,
  Volume2,
  VolumeX,
  Vote,
} from 'lucide-react';
import { useTour } from '../context/TourContext';
import { formatBDT, toBanglaDigits, translations } from '../lib/i18n';
import { isFeatureNew } from '../lib/whatsNew';
import type { NavTab } from './Navbar';

export interface MoreFeatureItem {
  id: string;
  labelEn: string;
  labelBn: string;
  tab: NavTab;
  sectionId?: string;
}

export const MORE_SECONDARY_FEATURES: MoreFeatureItem[] = [
  { id: 'checklist', labelEn: 'Checklist', labelBn: 'চেকলিস্ট', tab: 'checklist' },
  { id: 'polls', labelEn: 'Polls', labelBn: 'পোল ও ভোট', tab: 'social', sectionId: 'polls-section' },
  { id: 'photos', labelEn: 'Gallery / Photos', labelBn: 'গ্যালারি ও ছবি', tab: 'photos' },
  { id: 'notes', labelEn: 'Shared Notes', labelBn: 'শেয়ার্ড নোট', tab: 'social', sectionId: 'notes-section' },
  { id: 'crew', labelEn: 'Members', labelBn: 'সদস্য ও টিম', tab: 'crew' },
  { id: 'report', labelEn: 'Final Report', labelBn: 'চূড়ান্ত রিপোর্ট', tab: 'report' },
];

interface Props {
  onNavigate: (tab: NavTab, sectionId?: string) => void;
  onOpenAdminModal: () => void;
}

export const MoreFeaturesSection: React.FC<Props> = ({ onNavigate, onOpenAdminModal }) => {
  const { lang, state, session, soundMuted, toggleSoundMute, logout } = useTour();
  const t = translations[lang];
  const [showTourInfo, setShowTourInfo] = useState(false);

  if (!state || !session) return null;

  const completedChecklist = state.checklist.filter((c) => c.is_completed).length;
  const openPolls = state.polls.filter((p) => !p.is_closed).length;
  const pinnedNotes = state.notes.filter((n) => n.is_pinned).length;

  const num = (val: number) => (lang === 'bn' ? toBanglaDigits(val) : String(val));

  const featureCards = [
    {
      id: 'checklist',
      title: lang === 'bn' ? 'চেকলিস্ট' : 'Checklist',
      desc:
        lang === 'bn'
          ? `${num(completedChecklist)}/${num(state.checklist.length)} আইটেম সম্পন্ন`
          : `${completedChecklist}/${state.checklist.length} items packed`,
      icon: <CheckSquare className="w-5 h-5 text-[#14452F] dark:text-[#D4AF37]" />,
      accent: 'bg-[#14452F]/10 dark:bg-[#D4AF37]/15',
      onClick: () => onNavigate('checklist'),
    },
    {
      id: 'polls',
      title: lang === 'bn' ? 'পোল ও ভোট' : 'Polls',
      desc:
        lang === 'bn'
          ? `${num(openPolls)}টি সক্রিয় পোল`
          : `${openPolls} active poll${openPolls === 1 ? '' : 's'}`,
      icon: <Vote className="w-5 h-5 text-[#C45C3E]" />,
      accent: 'bg-[#C45C3E]/12',
      onClick: () => onNavigate('social', 'polls-section'),
    },
    {
      id: 'photos',
      title: lang === 'bn' ? 'গ্যালারি ও ছবি' : 'Gallery / Photos',
      desc:
        lang === 'bn'
          ? `${num(state.photos.length)}টি শেয়ার্ড ছবি`
          : `${state.photos.length} shared photo${state.photos.length === 1 ? '' : 's'}`,
      icon: <Camera className="w-5 h-5 text-[#14452F] dark:text-[#A9E0BE]" />,
      accent: 'bg-[#14452F]/10 dark:bg-[#A9E0BE]/15',
      onClick: () => onNavigate('photos'),
    },
    {
      id: 'notes',
      title: lang === 'bn' ? 'শেয়ার্ড নোট' : 'Shared Notes',
      desc:
        lang === 'bn'
          ? `${num(state.notes.length)}টি নোট${pinnedNotes > 0 ? ` • ${num(pinnedNotes)}টি পিন্ড` : ''}`
          : `${state.notes.length} note${state.notes.length === 1 ? '' : 's'}${pinnedNotes > 0 ? ` • ${pinnedNotes} pinned` : ''}`,
      icon: <StickyNote className="w-5 h-5 text-[#C89F3C]" />,
      accent: 'bg-[#C89F3C]/15',
      onClick: () => onNavigate('social', 'notes-section'),
    },
    {
      id: 'crew',
      title: lang === 'bn' ? 'সদস্য ও টিম' : 'Members',
      desc:
        lang === 'bn'
          ? `${num(state.members.length)} জন ভ্রমণসঙ্গী ও প্রোফাইল`
          : `${state.members.length} crew profiles & badges`,
      icon: <Users className="w-5 h-5 text-[#14452F] dark:text-[#D4AF37]" />,
      accent: 'bg-[#14452F]/10 dark:bg-[#D4AF37]/15',
      onClick: () => onNavigate('crew'),
    },
    {
      id: 'report',
      title: lang === 'bn' ? 'চূড়ান্ত রিপোর্ট' : 'Final Report',
      desc:
        lang === 'bn'
          ? 'প্রিন্ট / PDF ও হিসাব সারাংশ'
          : 'Printable summary & CSV export',
      icon: <FileBarChart className="w-5 h-5 text-[#C45C3E]" />,
      accent: 'bg-[#C45C3E]/12',
      onClick: () => onNavigate('report'),
    },
  ];

  const handleSettingsClick = () => {
    if (session.isAdmin) {
      onNavigate('admin');
      return;
    }
    if (session.member.role === 'admin') {
      onOpenAdminModal();
      return;
    }
    setShowTourInfo((v) => !v);
  };

  const newBadgeLabel = lang === 'bn' ? 'নতুন' : 'NEW';

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 py-7 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
            {lang === 'bn' ? 'সব ফিচার একসাথে' : 'ALL TOOLS & FEATURES'}
          </span>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#14452F] dark:text-[#FAF7F0] mt-1">
            {lang === 'bn' ? 'আরও ফিচার ও সেটিংস' : 'More Features'}
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6A62] dark:text-[#9AA89F] mt-1">
            {lang === 'bn'
              ? 'যেকোনো টুল বা সেকশনে যেতে নিচের কার্ডে ট্যাপ করুন।'
              : 'Jump to packing checklist, polls, photos, crew profiles, reports, and settings.'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#14452F]/12 dark:border-white/12 bg-white dark:bg-[#131F19] px-3 py-2 text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-[#5C6A62] dark:text-[#9AA89F]">
            {lang === 'bn' ? 'লগইন' : 'Signed in'}
          </div>
          <div className="text-xs font-bold text-[#14452F] dark:text-[#D4AF37]">
            {lang === 'bn' ? session.member.name_bn : session.member.name_en}
          </div>
        </div>
      </div>

      {/* Highlighted Feature Spot */}
      <button
        type="button"
        onClick={() => onNavigate('explore')}
        className="w-full text-left rounded-3xl border border-[#D4AF37]/35 bg-gradient-to-r from-[#14452F] to-[#1D5A3E] text-[#FAF7F0] p-4 sm:p-5 flex items-center justify-between gap-4 shadow-md hover:brightness-105 transition cursor-pointer"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-2.5 rounded-2xl bg-[#D4AF37]/20 text-[#F2D184] shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-editorial text-base font-bold truncate">
                {lang === 'bn' ? 'সিনেম্যাটিক গন্তব্য ভ্রমণ' : 'Cinematic Explore Journey'}
              </span>
              {isFeatureNew('explore-documentary') && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#D4AF37] text-[#0E1612] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{newBadgeLabel}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#FAF7F0]/80 mt-0.5 truncate">
              {lang === 'bn'
                ? 'পানাম নগর থেকে পুরান ঢাকা — ৪টি ভিডিও অধ্যায়'
                : '4 immersive video chapters from Panam Nagar to Old Dhaka'}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 shrink-0 text-[#F2D184]" />
      </button>

      {/* Secondary Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {featureCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className="group rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4 flex items-center justify-between gap-3 text-left hover:border-[#14452F]/35 dark:hover:border-[#D4AF37]/40 transition shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`p-2.5 rounded-2xl shrink-0 ${card.accent}`}>{card.icon}</div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-[#1A241E] dark:text-[#F2EFE7] truncate">
                  {card.title}
                </div>
                <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F] mt-0.5 truncate">
                  {card.desc}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0 text-[#5C6A62] group-hover:translate-x-0.5 transition-transform" />
          </button>
        ))}

        {/* Settings / Admin Center Card */}
        <button
          type="button"
          onClick={handleSettingsClick}
          className="sm:col-span-2 group rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4 flex items-center justify-between gap-3 text-left hover:border-[#14452F]/35 dark:hover:border-[#D4AF37]/40 transition shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-2.5 rounded-2xl shrink-0 bg-[#14452F]/10 dark:bg-[#D4AF37]/15">
              {session.isAdmin ? (
                <Shield className="w-5 h-5 text-[#14452F] dark:text-[#D4AF37]" />
              ) : session.member.role === 'admin' ? (
                <Lock className="w-5 h-5 text-[#C89F3C]" />
              ) : (
                <Settings className="w-5 h-5 text-[#14452F] dark:text-[#D4AF37]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm text-[#1A241E] dark:text-[#F2EFE7] flex items-center gap-2">
                <span>{lang === 'bn' ? 'সেটিংস ও অ্যাডমিন' : 'Settings'}</span>
                {session.isAdmin && (
                  <span className="rounded-full bg-[#14452F]/12 dark:bg-[#D4AF37]/20 text-[#14452F] dark:text-[#D4AF37] px-2 py-0.5 text-[10px] font-bold">
                    {t.common.adminMode}
                  </span>
                )}
              </div>
              <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F] mt-0.5 truncate">
                {session.isAdmin
                  ? lang === 'bn'
                    ? 'ট্যুর তারিখ, বাজেট, মিডিয়া ও নিরাপত্তা সম্পাদনা করুন'
                    : 'Edit tour dates, budget, explore media & security'
                  : session.member.role === 'admin'
                    ? lang === 'bn'
                      ? 'ট্যুর সেটিংস ও হিসাব আনলক করতে ট্যাপ করুন'
                      : 'Tap to unlock Shahriar Admin Dashboard'
                    : lang === 'bn'
                      ? 'ট্যুরের বর্তমান তথ্য ও নিয়মাবলি দেখুন'
                      : 'View tour configuration & budget settings'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0 text-[#5C6A62] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Read-only Tour Settings overview for non-admin crew members */}
      {showTourInfo && !session.isAdmin && session.member.role !== 'admin' && (
        <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/15 dark:border-white/15 p-4 text-xs space-y-2">
          <div className="font-bold text-[#14452F] dark:text-[#D4AF37]">
            {lang === 'bn' ? 'ট্যুর কনফিগারেশন (শুধুমাত্র দেখার জন্য)' : 'Tour Settings (Read-only)'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#4A5850] dark:text-[#B9C4BC]">
            <div>
              {lang === 'bn' ? 'শুরুর স্থান:' : 'Start:'}{' '}
              <strong>{lang === 'bn' ? state.settings.start_location_bn : state.settings.start_location_en}</strong>
            </div>
            <div>
              {lang === 'bn' ? 'নির্ধারিত জমা:' : 'Target / person:'}{' '}
              <strong>{formatBDT(state.settings.target_contribution_per_person, lang)}</strong>
            </div>
            <div>
              {lang === 'bn' ? 'গ্রুপ পাসকোড:' : 'Group passcode:'}{' '}
              <strong>
                {state.settings.require_group_passcode
                  ? lang === 'bn'
                    ? 'চালু'
                    : 'Enabled'
                  : lang === 'bn'
                    ? 'বন্ধ'
                    : 'Off'}
              </strong>
            </div>
            <div>
              {lang === 'bn' ? 'সম্পাদনা অধিকার:' : 'Managed by:'}{' '}
              <strong>{lang === 'bn' ? 'শাহরিয়ার (ট্রেজারার)' : 'Shahriar (Treasurer)'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* App Preferences & Session (SFX & Logout only — Music & Theme remain in Header) */}
      <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggleSoundMute}
          className="inline-flex items-center gap-2 rounded-xl border border-[#14452F]/15 dark:border-white/15 px-3.5 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
        >
          {soundMuted ? (
            <VolumeX className="w-4 h-4 text-[#C45C3E]" />
          ) : (
            <Volume2 className="w-4 h-4 text-[#14452F] dark:text-[#D4AF37]" />
          )}
          <span>{soundMuted ? t.common.soundOff : t.common.soundOn}</span>
        </button>

        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C45C3E]/30 text-[#C45C3E] px-3.5 py-2 text-xs font-semibold hover:bg-[#C45C3E]/10 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t.common.logout}</span>
        </button>
      </div>
    </section>
  );
};
