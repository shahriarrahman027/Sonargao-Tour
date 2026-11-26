import React, { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { translations } from '../lib/i18n';
import type { ThemeMode } from '../types/tour';

interface Props {
  variant?: 'default' | 'gate';
}

export const ThemeSelector: React.FC<Props> = ({ variant = 'default' }) => {
  const { lang, theme, resolvedTheme, setTheme } = useTour();
  const t = translations[lang];
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'light',
      label: lang === 'bn' ? 'লাইট' : 'Light',
      icon: <Sun className="w-4 h-4 shrink-0 text-[#C89F3C]" />,
    },
    {
      mode: 'dark',
      label: lang === 'bn' ? 'ডার্ক' : 'Dark',
      icon: <Moon className="w-4 h-4 shrink-0 text-[#D4AF37]" />,
    },
    {
      mode: 'system',
      label: t.common.systemMode,
      icon: <Monitor className="w-4 h-4 shrink-0" />,
    },
  ];

  const activeLabel =
    theme === 'light'
      ? t.common.lightMode
      : theme === 'dark'
        ? t.common.darkMode
        : `${t.common.systemMode} (${resolvedTheme === 'dark' ? t.common.darkMode : t.common.lightMode})`;

  const triggerIcon =
    theme === 'system' ? (
      <Monitor className="w-4 h-4" />
    ) : resolvedTheme === 'dark' ? (
      <Sun className="w-4 h-4 text-[#D4AF37]" />
    ) : (
      <Moon className="w-4 h-4" />
    );

  const triggerClass =
    variant === 'gate'
      ? 'rounded-xl border border-white/20 bg-white/10 p-2 text-[#FAF7F0] hover:bg-white/20 transition cursor-pointer flex items-center justify-center'
      : 'p-2 rounded-xl border border-[#14452F]/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer flex items-center justify-center';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={activeLabel}
        title={activeLabel}
        className={triggerClass}
      >
        {triggerIcon}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={lang === 'bn' ? 'থিম নির্বাচন' : 'Theme mode'}
          className="absolute right-0 mt-2 w-44 rounded-2xl border border-[#14452F]/15 dark:border-white/15 bg-[#FAF7F0] dark:bg-[#131F19] text-[#1A241E] dark:text-[#F2EFE7] shadow-xl p-1.5 space-y-0.5 z-50"
        >
          {options.map((opt) => {
            const active = theme === opt.mode;
            const resolvedHint =
              opt.mode === 'system'
                ? resolvedTheme === 'dark'
                  ? lang === 'bn'
                    ? 'ডার্ক'
                    : 'Dark'
                  : lang === 'bn'
                    ? 'লাইট'
                    : 'Light'
                : null;

            return (
              <button
                key={opt.mode}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(opt.mode);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-[#14452F] text-[#FAF7F0] dark:bg-[#D4AF37] dark:text-[#0E1612]'
                    : 'text-[#314037] dark:text-[#CFD9D2] hover:bg-[#14452F]/8 dark:hover:bg-white/8'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                  {resolvedHint && (
                    <span
                      className={`text-[10px] font-normal ${
                        active ? 'opacity-85' : 'text-[#5C6A62] dark:text-[#9AA89F]'
                      }`}
                    >
                      ({resolvedHint})
                    </span>
                  )}
                </span>
                {active && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
