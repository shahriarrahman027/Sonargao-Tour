import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { BadgeCheck, IdCard, Moon, ShieldCheck, Sparkles, Sun, Ticket, Users } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { translations } from '../lib/i18n';
import { GlobalMusicControl } from './GlobalMusicControl';

export const AccessGate: React.FC = () => {
  const { lang, toggleLang, theme, toggleTheme, gateStatus, login, isSupabaseMode } = useTour();
  const t = translations[lang];
  const [studentId, setStudentId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(studentId, passcode || undefined);
      setVerifiedName(lang === 'bn' ? 'মামা' : 'Crew Member');
      void confetti({ particleCount: 45, spread: 60, origin: { y: 0.65 } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/unauthorized|invalid diu/i.test(msg)) {
        setError(t.gate.invalidId);
      } else {
        setError(msg || t.gate.invalidId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const brandName =
    lang === 'bn'
      ? gateStatus?.website_name_bn || 'সস্তায় ১ দিনের ট্যুর'
      : gateStatus?.website_name_en || 'Sostay 1 diner tour';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#14452F] text-[#FAF7F0] flex flex-col justify-between">
      {/* Background visual */}
      <img
        src="/images/panam-hero.svg"
        alt="Panam Nagar Heritage"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0E2F20]/85 via-[#14452F]/78 to-[#0B1F16]" />

      {/* Top utility bar */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 max-w-5xl w-full mx-auto gap-2">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs tracking-wider uppercase text-[#D4AF37] font-semibold">
          <Users className="w-4 h-4 shrink-0" />
          <span className="truncate">{t.gate.badge}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <GlobalMusicControl variant="gate" />
          <button
            type="button"
            onClick={toggleLang}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition cursor-pointer"
          >
            {lang === 'bn' ? 'EN' : 'বাংলা'}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-xl border border-white/20 bg-white/10 p-2 hover:bg-white/20 transition cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-[#D4AF37]" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Playful ID-Card Gate */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-md relative">
          {/* Lanyard Clip Visual */}
          <div className="mx-auto w-24 h-4 rounded-t-2xl bg-[#D4AF37]/85 border-x border-t border-[#FAF7F0]/30 flex items-center justify-center shadow-md">
            <span className="w-8 h-1 rounded-full bg-[#14452F]" />
          </div>

          <div className="rounded-3xl border-2 border-[#D4AF37]/35 bg-[#FAF7F0] dark:bg-[#131F19] text-[#1A241E] dark:text-[#F2EFE7] shadow-2xl overflow-hidden transition-transform duration-300">
            {/* ID Card Header Band */}
            <div className="bg-[#14452F] text-[#FAF7F0] px-5 sm:px-6 py-4 flex items-center justify-between gap-3 border-b border-[#D4AF37]/30">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/images/logo.jpg"
                  alt={brandName}
                  className="w-12 h-12 rounded-full object-contain shrink-0 ring-2 ring-[#D4AF37]/60 shadow-sm"
                />
                <div className="min-w-0">
                  <div className="font-editorial text-lg sm:text-xl font-bold truncate">
                    {brandName}
                  </div>
                  <div className="text-[11px] text-[#F2D184] truncate">
                    {lang === 'bn'
                      ? gateStatus?.tagline_bn || 'প্ল্যান ক্যানসেল না হইলেই হয়।'
                      : gateStatus?.tagline_en || "As long as the plan doesn't get cancelled."}
                  </div>
                </div>
              </div>
              <div className="shrink-0 rounded-xl bg-white/10 border border-white/15 px-2.5 py-1.5 text-center">
                <Ticket className="w-4 h-4 mx-auto text-[#D4AF37]" />
                <span className="block text-[9px] uppercase tracking-widest font-bold text-white/80 mt-0.5">
                  CREW PASS
                </span>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-6 sm:p-7">
              <div className="mb-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C45C3E]/12 text-[#C45C3E] dark:text-[#F29A7E] px-3 py-1 text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'গেটকিপার চেকপোস্ট' : 'Gatekeeper Checkpoint'}</span>
                </span>

                <h1 className="font-editorial mt-3 text-2xl sm:text-3xl font-bold tracking-tight leading-snug text-[#14452F] dark:text-[#FAF7F0]">
                  {t.gate.heading}
                </h1>
                <p className="mt-2 text-sm text-[#4A5850] dark:text-[#B9C4BC] leading-relaxed">
                  {t.gate.subtitle}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="student-id-input"
                    className="block text-xs font-bold tracking-wide text-[#14452F] dark:text-[#D4AF37] mb-1.5"
                  >
                    {t.gate.studentIdLabel}
                  </label>
                  <div className="relative">
                    <IdCard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#14452F]/70 dark:text-[#D4AF37]/80" />
                    <input
                      id="student-id-input"
                      type="text"
                      required
                      autoComplete="off"
                      value={studentId}
                      onChange={(e) => {
                        setStudentId(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder={t.gate.studentIdPlaceholder}
                      className="w-full rounded-xl border-2 border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:border-[#14452F] dark:focus:border-[#D4AF37] transition"
                    />
                  </div>
                </div>

                {gateStatus?.require_group_passcode && (
                  <div>
                    <label
                      htmlFor="group-passcode-input"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#4A5850] dark:text-[#B9C4BC] mb-1.5"
                    >
                      {t.gate.passcodeLabel}
                    </label>
                    <input
                      id="group-passcode-input"
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
                  <div
                    role="alert"
                    className="rounded-2xl bg-[#C45C3E]/12 border border-[#C45C3E]/35 px-4 py-3 text-xs sm:text-sm font-semibold text-[#9D3B20] dark:text-[#F49B82] animate-[pulse_0.4s_ease-in-out_1]"
                  >
                    {error}
                  </div>
                )}

                {verifiedName && (
                  <div className="rounded-2xl bg-[#14452F]/12 border border-[#14452F]/30 px-4 py-3 text-xs font-bold text-[#14452F] dark:text-[#A9E0BE] flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 shrink-0" />
                    <span>
                      {lang === 'bn' ? 'আইডি ভেরিফায়েড!' : 'ID Verified!'}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#14452F] hover:bg-[#1B5B3E] active:scale-[0.99] disabled:opacity-60 text-[#FAF7F0] font-bold py-3.5 text-sm transition shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-[#FAF7F0] border-t-transparent animate-spin" />
                      <span>{t.gate.verifying}</span>
                    </>
                  ) : (
                    <span>{t.gate.enterBtn}</span>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-[#14452F]/10 dark:border-white/10 flex items-start gap-2 text-xs text-[#5B6860] dark:text-[#98A69D]">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#14452F] dark:text-[#D4AF37]" />
                <p>{t.gate.privacyNote}</p>
              </div>

              {!isSupabaseMode && (
                <div className="mt-3 rounded-xl border border-[#C89F3C]/35 bg-[#C89F3C]/10 px-3 py-2 text-[11px] text-[#6B5112] dark:text-[#E8C56E]">
                  <strong>{t.gate.devHintTitle}:</strong> {t.gate.devHintBody}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center py-4 text-xs text-white/65 px-4">
        28 Nov 2026 • C&amp;B Savar → Panam Nagar → Puran Dhaka
      </footer>
    </div>
  );
};
