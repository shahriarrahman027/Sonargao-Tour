import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckSquare,
  ChevronDown,
  Compass,
  FileBarChart,
  Home,
  Landmark,
  Lock,
  LogOut,
  Shield,
  Users,
  Vote,
  Volume2,
  VolumeX,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { useTour } from '../context/TourContext';
import { translations } from '../lib/i18n';
import { GlobalMusicControl } from './GlobalMusicControl';
import { ThemeSelector } from './ThemeSelector';

export type NavTab =
  | 'home'
  | 'explore'
  | 'journey'
  | 'crew'
  | 'money'
  | 'photos'
  | 'social'
  | 'checklist'
  | 'report'
  | 'admin'
  | 'more';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAdminModal: () => void;
}

export const Navbar: React.FC<Props> = ({ activeTab, onSelectTab, onOpenAdminModal }) => {
  const {
    lang,
    toggleLang,
    soundMuted,
    toggleSoundMute,
    isOnline,
    isSupabaseMode,
    session,
    state,
    logout,
  } = useTour();
  const t = translations[lang];

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const coreDesktopItems: { id: NavTab; label: string; icon: React.ReactNode; xlOnly?: boolean }[] = [
    { id: 'home', label: t.nav.home, icon: <Home className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'explore', label: t.nav.explore, icon: <Landmark className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'journey', label: t.nav.journey, icon: <Compass className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'money', label: t.nav.money, icon: <Wallet className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'crew', label: t.nav.crew, icon: <Users className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'photos', label: t.nav.photos, icon: <Camera className="w-3.5 h-3.5 shrink-0" />, xlOnly: true },
    { id: 'checklist', label: t.nav.checklist, icon: <CheckSquare className="w-3.5 h-3.5 shrink-0" />, xlOnly: true },
  ];

  const moreItems: { id: NavTab; label: string; icon: React.ReactNode; hideOnXl?: boolean }[] = [
    { id: 'photos', label: t.nav.photos, icon: <Camera className="w-3.5 h-3.5 shrink-0" />, hideOnXl: true },
    { id: 'checklist', label: t.nav.checklist, icon: <CheckSquare className="w-3.5 h-3.5 shrink-0" />, hideOnXl: true },
    { id: 'social', label: t.nav.social, icon: <Vote className="w-3.5 h-3.5 shrink-0" /> },
    { id: 'report', label: t.nav.report, icon: <FileBarChart className="w-3.5 h-3.5 shrink-0" /> },
  ];

  if (session?.isAdmin) {
    moreItems.push({
      id: 'admin',
      label: t.nav.admin,
      icon: <Shield className="w-3.5 h-3.5 shrink-0" />,
    });
  }

  const isSecondaryActive = moreItems.some((item) => item.id === activeTab);
  const brandTitle =
    lang === 'bn'
      ? state?.settings.website_name_bn || 'সস্তায় ১ দিনের ট্যুর'
      : state?.settings.website_name_en || 'Sostay 1 diner tour';

  const handleNavClick = (id: NavTab) => {
    onSelectTab(id);
    setMoreOpen(false);
  };

  return (
    <div className="no-print sticky top-0 z-40">
      {/* Status Banners */}
      {!isOnline && (
        <div className="bg-[#C45C3E] text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2 text-center">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>{t.common.offlineBanner}</span>
        </div>
      )}
      {!isSupabaseMode && (
        <div className="bg-[#C89F3C]/20 border-b border-[#C89F3C]/30 text-[#5C440D] dark:text-[#F0D38C] px-4 py-1 text-[11px] font-medium text-center">
          {t.common.devBanner}
        </div>
      )}

      {/* Main Header */}
      <header className="bg-[#FAF7F0]/95 dark:bg-[#0E1612]/95 backdrop-blur-md border-b border-[#14452F]/12 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* LEFT: Logo & Website Name */}
          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2 sm:gap-2.5 text-left min-w-0 shrink cursor-pointer group"
          >
            <img
              src="/images/logo.jpg"
              alt={brandTitle}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-contain shrink-0 ring-1 ring-[#D4AF37]/45 shadow-xs group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0 leading-tight">
              <div className="font-editorial text-sm sm:text-base font-bold text-[#14452F] dark:text-[#FAF7F0] whitespace-nowrap truncate max-w-[125px] sm:max-w-none">
                {brandTitle}
              </div>
              {session && (
                <div className="text-[11px] text-[#5C6A62] dark:text-[#9AA89F] whitespace-nowrap truncate hidden sm:block">
                  {lang === 'bn' ? session.member.nickname_bn : session.member.nickname_en}
                </div>
              )}
            </div>
          </button>

          {/* CENTER: Aligned Desktop Navigation */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center justify-center flex-1 min-w-0"
          >
            <div className="inline-flex items-center gap-0.5 rounded-2xl border border-[#14452F]/10 dark:border-white/10 bg-[#14452F]/[0.04] dark:bg-white/[0.04] p-1">
              {coreDesktopItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`${item.xlOnly ? 'hidden xl:inline-flex' : 'inline-flex'} items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      active
                        ? 'bg-[#14452F] text-[#FAF7F0] dark:bg-[#D4AF37] dark:text-[#0E1612] shadow-xs'
                        : 'text-[#314037] dark:text-[#CFD9D2] hover:bg-[#14452F]/8 dark:hover:bg-white/8'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* More Menu Dropdown for Secondary Pages */}
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className={`inline-flex items-center gap-1 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isSecondaryActive
                      ? 'bg-[#14452F] text-[#FAF7F0] dark:bg-[#D4AF37] dark:text-[#0E1612] shadow-xs'
                      : 'text-[#314037] dark:text-[#CFD9D2] hover:bg-[#14452F]/8 dark:hover:bg-white/8'
                  }`}
                >
                  <span>{lang === 'bn' ? 'আরও' : 'More'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {moreOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-[#14452F]/12 dark:border-white/12 bg-[#FAF7F0] dark:bg-[#131F19] shadow-xl p-1.5 space-y-0.5 z-50">
                    {moreItems.map((item) => {
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full ${item.hideOnXl ? 'flex xl:hidden' : 'flex'} items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                            active
                              ? 'bg-[#14452F] text-[#FAF7F0] dark:bg-[#D4AF37] dark:text-[#0E1612]'
                              : 'text-[#314037] dark:text-[#CFD9D2] hover:bg-[#14452F]/8 dark:hover:bg-white/8'
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </nav>

          {/* RIGHT: Controls Cluster */}
          <div className="flex items-center gap-1.5 shrink-0">
            <GlobalMusicControl />

            {/* Desktop Sound Toggle */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSoundMute}
                title={soundMuted ? t.common.soundOff : t.common.soundOn}
                aria-label={soundMuted ? t.common.soundOff : t.common.soundOn}
                className="p-2 rounded-xl border border-[#14452F]/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                {soundMuted ? (
                  <VolumeX className="w-4 h-4 text-[#C45C3E]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Theme Selector (Light / Dark / System) — always accessible in header on mobile & desktop */}
            <ThemeSelector />

            <button
              type="button"
              onClick={toggleLang}
              className="px-2.5 py-1.5 rounded-xl border border-[#14452F]/15 dark:border-white/15 text-xs font-semibold whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              {lang === 'bn' ? 'EN' : 'বাংলা'}
            </button>

            {session?.member.role === 'admin' && !session.isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminModal}
                title={t.common.unlockAdmin}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-[#C89F3C]/18 border border-[#C89F3C]/40 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#7A5B12] dark:text-[#F0D38C] cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">{t.common.unlockAdmin}</span>
              </button>
            )}

            {session?.isAdmin && (
              <button
                type="button"
                onClick={() => handleNavClick('admin')}
                title={t.common.adminMode}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-[#14452F]/12 dark:bg-[#D4AF37]/20 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#14452F] dark:text-[#D4AF37] cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">{t.common.adminMode}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void logout()}
              title={t.common.logout}
              aria-label={t.common.logout}
              className="hidden lg:inline-flex p-2 rounded-xl border border-[#14452F]/15 dark:border-white/15 hover:bg-[#C45C3E]/10 hover:text-[#C45C3E] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
    </div>
  );
};
