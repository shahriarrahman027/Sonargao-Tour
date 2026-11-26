import React from 'react';
import { Facebook, Github } from 'lucide-react';

const DEVELOPER = {
  name: 'Md. Shahriar Rahman',
  university: 'Daffodil International University (DIU)',
  photoUrl: '/images/developer-shahriar.jpg',
  note: 'Designed & developed with care.',
  facebookUrl: 'https://www.facebook.com/shahriarrahman.shuvo.16',
  githubUrl: 'https://github.com/shahriarrahman027',
} as const;

export const DeveloperCredit: React.FC = () => (
  <div className="mt-5 pt-5 border-t border-[#14452F]/10 dark:border-white/10 max-w-xl mx-auto">
    <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-5">
      <div className="flex items-center gap-3 text-left min-w-0">
        <img
          src={DEVELOPER.photoUrl}
          alt={DEVELOPER.name}
          loading="lazy"
          className="w-10 h-10 rounded-full object-cover object-center shrink-0 ring-1 ring-[#14452F]/20 dark:ring-[#D4AF37]/40 shadow-xs"
        />
        <div className="min-w-0 leading-snug">
          <div className="font-editorial text-[13px] font-semibold text-[#1A241E] dark:text-[#F2EFE7] truncate">
            {DEVELOPER.name}
          </div>
          <div className="text-[11px] text-[#5C6A62] dark:text-[#9AA89F] truncate">
            {DEVELOPER.university}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={DEVELOPER.facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Md. Shahriar Rahman on Facebook"
          title="Facebook"
          className="p-2 rounded-xl border border-[#14452F]/12 dark:border-white/12 bg-white/70 dark:bg-white/[0.04] text-[#4A5850] dark:text-[#B9C4BC] hover:border-[#14452F]/35 dark:hover:border-[#D4AF37]/45 hover:text-[#14452F] dark:hover:text-[#D4AF37] transition"
        >
          <Facebook className="w-3.5 h-3.5" />
        </a>
        <a
          href={DEVELOPER.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Md. Shahriar Rahman on GitHub"
          title="GitHub"
          className="p-2 rounded-xl border border-[#14452F]/12 dark:border-white/12 bg-white/70 dark:bg-white/[0.04] text-[#4A5850] dark:text-[#B9C4BC] hover:border-[#14452F]/35 dark:hover:border-[#D4AF37]/45 hover:text-[#14452F] dark:hover:text-[#D4AF37] transition"
        >
          <Github className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>

    <p className="mt-2.5 text-[11px] text-[#5C6A62]/85 dark:text-[#9AA89F]/80">
      {DEVELOPER.note}
    </p>
  </div>
);
