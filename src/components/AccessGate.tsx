import React, { useState } from 'react';
import { KeyRound, Lock, Moon, ShieldCheck, Sun, Users } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { translations } from '../lib/i18n';
import { GlobalMusicControl } from './GlobalMusicControl';

export const AccessGate: React.FC = () => {
  const { lang, toggleLang, theme, toggleTheme, gateStatus, login, isSupabaseMode } = useTour();
  const t = translations[lang];
  const [studentId, setStudentId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(studentId, passcode || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access denied');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#14452F] text-[#FAF7F0] flex flex-col justify-between">
      {/* Background visual */}
      <img
        src="/images/panam-hero.svg"
        alt="Panam Nagar Heritage"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0E2F20]/85 via-[#14452F]/75 to-[#0B1F16]" />

      {/* Top utility bar */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#D4AF37] font-semibold">
          <Users className="w-4 h-4" />
          <span>{t.gate.badge}</span>
        </div>
        <div className="flex items-center gap-2">
          <GlobalMusicControl variant="gate" />
          <button
            type="button"
            onClick={toggleLang}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition"
          >
            {lang === 'bn' ? 'English' : 'বাংলা'}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-full border border-white/20 bg-white/10 p-2 hover:bg-white/20 transition"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Entry Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#FAF7F0] dark:bg-[#131F19] text-[#1A241E] dark:text-[#F2EFE7] p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14452F]/10 dark:bg-[#D4AF37]/15 px-3 py-1 text-xs font-semibold text-[#14452F] dark:text-[#D4AF37]">
              <Lock className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'শুধুমাত্র ৬ বন্ধুর জন্য' : 'Private 6-Friend Portal'}
            </span>
            <h1 className="font-editorial mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#14452F] dark:text-[#FAF7F0]">
              {lang === 'bn'
                ? gateStatus?.website_name_bn || '১ দিনের সস্তায় ট্যুর'
                : gateStatus?.website_name_en || 'Ek Diner Sostay Tour'}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-[#C45C3E] dark:text-[#E58A6E]">
              {lang === 'bn'
                ? gateStatus?.tagline_bn || 'প্ল্যান ক্যানসেল না হইলেই হয়।'
                : gateStatus?.tagline_en || "As long as the plan doesn't get cancelled."}
            </p>
            <p className="mt-3 text-sm text-[#4A5850] dark:text-[#B9C4BC]">
              {t.gate.subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#4A5850] dark:text-[#B9C4BC] mb-1.5">
                {t.gate.studentIdLabel}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#14452F]/60 dark:text-[#D4AF37]/70" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder={t.gate.studentIdPlaceholder}
                  className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14452F] dark:focus:ring-[#D4AF37]"
                />
              </div>
            </div>

            {gateStatus?.require_group_passcode && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4A5850] dark:text-[#B9C4BC] mb-1.5">
                  {t.gate.passcodeLabel}
                </label>
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={t.gate.passcodePlaceholder}
                  className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14452F] dark:focus:ring-[#D4AF37]"
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-[#C45C3E]/12 border border-[#C45C3E]/30 px-3.5 py-2.5 text-xs font-medium text-[#9D3B20] dark:text-[#F49B82]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#14452F] hover:bg-[#1B5B3E] disabled:opacity-60 text-[#FAF7F0] font-semibold py-3.5 text-sm transition shadow-md cursor-pointer"
            >
              {submitting ? t.gate.verifying : t.gate.enterBtn}
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2 text-xs text-[#5B6860] dark:text-[#98A69D]">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#14452F] dark:text-[#D4AF37]" />
            <p>{t.gate.privacyNote}</p>
          </div>

          {!isSupabaseMode && (
            <div className="mt-5 rounded-2xl border border-[#C89F3C]/40 bg-[#C89F3C]/10 p-3.5 text-xs">
              <p className="font-semibold text-[#8A6914] dark:text-[#E8C56E]">
                {t.gate.devHintTitle}
              </p>
              <p className="mt-1 text-[#5A4B23] dark:text-[#D9C796]">{t.gate.devHintBody}</p>
              <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[11px] text-[#3B3117] dark:text-[#F2E3B8]">
                <span>Mahadi: DIU-101</span>
                <span>Shahriar (Admin): DIU-102</span>
                <span>Seam: DIU-103</span>
                <span>Ashik: DIU-104</span>
                <span>Safin: DIU-105</span>
                <span>Shoaib: DIU-106</span>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 text-center py-4 text-xs text-white/60">
        28 Nov 2026 • C&amp;B Savar → Panam Nagar → Puran Dhaka
      </footer>
    </div>
  );
};
