import React from 'react';
import { Compass, Home, Landmark, LayoutGrid, Wallet } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { translations } from '../lib/i18n';
import { hasUnseenWhatsNew } from '../lib/whatsNew';
import type { NavTab } from './Navbar';

export interface MobileNavDestination {
  id: Extract<NavTab, 'home' | 'journey' | 'explore' | 'money' | 'more'>;
  matchesTabs: ReadonlyArray<NavTab>;
}

export const MOBILE_BOTTOM_DESTINATIONS: MobileNavDestination[] = [
  { id: 'home', matchesTabs: ['home'] },
  { id: 'journey', matchesTabs: ['journey'] },
  { id: 'explore', matchesTabs: ['explore'] },
  { id: 'money', matchesTabs: ['money'] },
  {
    id: 'more',
    matchesTabs: ['more', 'checklist', 'social', 'photos', 'crew', 'report', 'admin'],
  },
];

interface Props {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const MobileBottomNav: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const { lang } = useTour();
  const t = translations[lang];
  const showMoreDot = hasUnseenWhatsNew() && activeTab !== 'more';

  const meta: Record<
    MobileNavDestination['id'],
    { label: string; icon: React.ReactNode }
  > = {
    home: { label: t.nav.home, icon: <Home className="w-5 h-5" /> },
    journey: { label: t.nav.journey, icon: <Compass className="w-5 h-5" /> },
    explore: { label: t.nav.explore, icon: <Landmark className="w-5 h-5" /> },
    money: { label: t.nav.expenses, icon: <Wallet className="w-5 h-5" /> },
    more: { label: t.nav.more, icon: <LayoutGrid className="w-5 h-5" /> },
  };

  return (
    <nav
      aria-label={lang === 'bn' ? 'মোবাইল নেভিগেশন' : 'Mobile Navigation'}
      className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#14452F]/12 dark:border-white/12 bg-[#FAF7F0]/95 dark:bg-[#0E1612]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_24px_rgba(14,22,18,0.08)] dark:shadow-[0_-6px_24px_rgba(0,0,0,0.45)]"
    >
      <div className="grid grid-cols-5 items-stretch max-w-xl mx-auto px-1">
        {MOBILE_BOTTOM_DESTINATIONS.map((dest) => {
          const isActive = dest.matchesTabs.includes(activeTab);
          const { label, icon } = meta[dest.id];
          return (
            <button
              key={dest.id}
              type="button"
              onClick={() => onSelectTab(dest.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[58px] py-1.5 px-1 rounded-xl transition cursor-pointer select-none ${
                isActive
                  ? 'text-[#14452F] dark:text-[#D4AF37]'
                  : 'text-[#5C6A62] dark:text-[#9AA89F] active:scale-95'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 w-7 h-1 rounded-full bg-[#14452F] dark:bg-[#D4AF37]"
                />
              )}
              <span
                className={`relative p-1 rounded-xl transition-colors ${
                  isActive ? 'bg-[#14452F]/10 dark:bg-[#D4AF37]/15' : ''
                }`}
              >
                {icon}
                {dest.id === 'more' && showMoreDot && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#C45C3E] ring-2 ring-[#FAF7F0] dark:ring-[#0E1612]"
                  />
                )}
              </span>
              <span className="text-[11px] font-semibold leading-tight truncate max-w-full">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
