import React, { useState } from 'react';
import { TourProvider, useTour } from './context/TourContext';
import { AccessGate } from './components/AccessGate';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminUnlockModal } from './components/AdminUnlockModal';
import { ChecklistSection } from './components/ChecklistSection';
import { CrewSection } from './components/CrewSection';
import { FinalReportSection } from './components/FinalReportSection';
import { FinanceDashboard } from './components/FinanceDashboard';
import { FunZoneSection } from './components/FunZoneSection';
import { HomepageSection } from './components/HomepageSection';
import { JourneySection } from './components/JourneySection';
import { Navbar, type NavTab } from './components/Navbar';
import { PhotosSection } from './components/PhotosSection';
import { PlacesExploreSection } from './components/PlacesExploreSection';
import { SocialSection } from './components/SocialSection';

const TourShell: React.FC = () => {
  const { session, loading, state, toast, lang } = useTour();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0] dark:bg-[#0E1612]">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full border-4 border-[#14452F] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#5C6A62]">
            {lang === 'bn' ? 'ট্যুর পোর্টাল লোড হচ্ছে...' : 'Loading Tour Headquarters...'}
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AccessGate />;
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0] dark:bg-[#0E1612]">
        <p className="text-sm">Loading workspace...</p>
      </div>
    );
  }

  const navigate = (tab: NavTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F0] dark:bg-[#0E1612] paper-texture text-[#1A241E] dark:text-[#F2EFE7]">
      <Navbar
        activeTab={activeTab}
        onSelectTab={navigate}
        onOpenAdminModal={() => setAdminModalOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'home' && <HomepageSection onNavigate={navigate} />}
        {activeTab === 'explore' && <PlacesExploreSection />}
        {activeTab === 'journey' && <JourneySection />}
        {activeTab === 'crew' && <CrewSection />}
        {activeTab === 'money' && <FinanceDashboard />}
        {activeTab === 'photos' && <PhotosSection />}
        {activeTab === 'social' && <SocialSection />}
        {activeTab === 'fun' && <FunZoneSection />}
        {activeTab === 'checklist' && <ChecklistSection />}
        {activeTab === 'report' && <FinalReportSection />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>

      <footer className="no-print border-t border-[#14452F]/10 dark:border-white/10 py-6 px-4 text-center text-xs text-[#5C6A62] dark:text-[#9AA89F]">
        <div className="font-editorial font-bold text-[#14452F] dark:text-[#D4AF37]">
          {lang === 'bn' ? state.settings.website_name_bn : state.settings.website_name_en}
        </div>
        <div className="mt-1">
          {lang === 'bn' ? state.settings.tagline_bn : state.settings.tagline_en} •{' '}
          {lang === 'bn' ? '২৮ নভেম্বর ২০২৬' : '28 Nov 2026'}
        </div>
      </footer>

      <AdminUnlockModal open={adminModalOpen} onClose={() => setAdminModalOpen(false)} />

      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50 rounded-2xl bg-[#14452F] text-[#FAF7F0] px-4 py-3 text-xs font-semibold shadow-xl border border-[#D4AF37]/40">
          {toast}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => (
  <TourProvider>
    <TourShell />
  </TourProvider>
);

export default App;
