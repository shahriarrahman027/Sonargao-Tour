import React from 'react';
import {
  Camera,
  CheckSquare,
  Compass,
  FileBarChart,
  Home,
  Landmark,
  Lock,
  LogOut,
  Moon,
  Shield,
  Sparkles,
  Sun,
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

export type NavTab =
  | 'home'
  | 'explore'
  | 'journey'
  | 'crew'
  | 'money'
  | 'photos'
  | 'social'
  | 'fun'
  | 'checklist'
  | 'report'
  | 'admin';

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAdminModal: () => void;
}

export const Navbar: React.FC<Props> = ({ activeTab, onSelectTab, onOpenAdminModal }) => {
  const {
    lang,
    toggleLang,
    theme,
    toggleTheme,
    soundMuted,
    toggleSoundMute,
    isOnline,
    isSupabaseMode,
    session,
    state,
    logout,
  } = useTour();
  const t = translations[lang];

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: t.nav.home, icon: <Home className="w-4 h-4" /> },
    { id: 'explore', label: t.nav.explore, icon: <Landmark className="w-4 h-4" /> },
    { id: 'journey', label: t.nav.journey, icon: <Compass className="w-4 h-4" /> },
    { id: 'money', label: t.nav.money, icon: <Wallet className="w-4 h-4" /> },
    { id: 'crew', label: t.nav.crew, icon: <Users className="w-4 h-4" /> },
    { id: 'photos', label: t.nav.photos, icon: <Camera className="w-4 h-4" /> },
    { id: 'social', label: t.nav.social, icon: <Vote className="w-4 h-4" /> },
    { id: 'fun', label: t.nav.fun, icon: <Sparkles className="w-4 h-4" /> },
    { id: 'checklist', label: t.nav.checklist, icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'report', label: t.nav.report, icon: <FileBarChart className="w-4 h-4" /> },
  ];

  if (session?.isAdmin) {
    navItems.push({ id: 'admin', label: t.nav.admin, icon: <Shield className="w-4 h-4" /> });
  }

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
      <header className="bg-[#FAF7F0]/90 dark:bg-[#0E1612]/90 backdrop-blur-md border-b border-[#14452F]/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <img src="/icons/icon.svg" alt="Tour" className="w-9 h-9 rounded-xl shadow-xs" />
            <div className="leading-tight">
              <div className="font-editorial text-base sm:text-lg font-bold text-[#14452F] dark:text-[#FAF7F0]">
                {lang === 'bn'
                  ? state?.settings.website_name_bn || '১ দিনের সস্তায় ট্যুর'
                  : state?.settings.website_name_en || 'Ek Diner Sostay Tour'}
              </div>
              <div className="text-[11px] text-[#5C6A62] dark:text-[#9AA89F] hidden sm:block">
                {session
                  ? `${lang === 'bn' ? session.member.nickname_bn : session.member.nickname_en}`
                  : ''}
              </div>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
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
          </nav>

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <GlobalMusicControl />

            <button
              type="button"
              onClick={toggleSoundMute}
              title={soundMuted ? t.common.soundOff : t.common.soundOn}
              className="p-2 rounded-xl border border-[#14452F]/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              {soundMuted ? <VolumeX className="w-4 h-4 text-[#C45C3E]" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={toggleLang}
              className="px-2.5 py-1.5 rounded-xl border border-[#14452F]/15 dark:border-white/15 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              {lang === 'bn' ? 'EN' : 'বাংলা'}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? t.common.lightMode : t.common.darkMode}
              className="p-2 rounded-xl border border-[#14452F]/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-[#D4AF37]" /> : <Moon className="w-4 h-4" />}
            </button>

            {session?.member.role === 'admin' && !session.isAdmin && (
              <button
                type="button"
                onClick={onOpenAdminModal}
                className="flex items-center gap-1 rounded-xl bg-[#C89F3C]/18 border border-[#C89F3C]/40 px-2.5 py-1.5 text-xs font-semibold text-[#7A5B12] dark:text-[#F0D38C] cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.common.unlockAdmin}</span>
              </button>
            )}

            {session?.isAdmin && (
              <button
                type="button"
                onClick={() => onSelectTab('admin')}
                className="hidden sm:flex items-center gap-1 rounded-xl bg-[#14452F]/12 dark:bg-[#D4AF37]/20 px-2.5 py-1.5 text-xs font-semibold text-[#14452F] dark:text-[#D4AF37] cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{t.common.adminMode}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void logout()}
              title={t.common.logout}
              className="p-2 rounded-xl border border-[#14452F]/15 dark:border-white/15 hover:bg-[#C45C3E]/10 hover:text-[#C45C3E] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Horizontal Scroll Tab Strip */}
        <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-3 pb-2.5 no-scrollbar">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-[#14452F] text-[#FAF7F0] dark:bg-[#D4AF37] dark:text-[#0E1612]'
                    : 'bg-[#14452F]/6 dark:bg-white/6 text-[#314037] dark:text-[#CFD9D2]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>
    </div>
  );
};
