import React from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { formatBDT } from '../lib/i18n';

interface Props {
  onOpenMoney: () => void;
}

export const MoneyNotificationToast: React.FC<Props> = ({ onOpenMoney }) => {
  const { lang, activeMoneyToast, dismissMoneyToast, markNotificationRead } = useTour();

  if (!activeMoneyToast) return null;

  const n = activeMoneyToast;
  const isCredit =
    n.kind === 'contribution_added' ||
    n.kind === 'expense_voided' ||
    n.kind === 'expense_reimbursed' ||
    n.amount < 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed top-[4.5rem] inset-x-3 sm:left-auto sm:right-5 sm:w-[24rem] z-50 rounded-2xl border border-[#14452F]/20 dark:border-[#D4AF37]/40 bg-[#FAF7F0] dark:bg-[#131F19] text-[#1A241E] dark:text-[#F2EFE7] shadow-2xl p-3.5 sm:p-4"
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
            isCredit
              ? 'bg-[#14452F]/12 dark:bg-[#1E5C40]/40'
              : 'bg-[#C45C3E]/12 dark:bg-[#C45C3E]/25'
          }`}
          aria-hidden="true"
        >
          {n.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#C45C3E] dark:text-[#D4AF37] truncate">
              {lang === 'bn' ? n.title_bn : n.title_en}
            </span>
            <button
              type="button"
              onClick={dismissMoneyToast}
              aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
              className="p-1 -mr-1 -mt-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#5C6A62] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="mt-1 text-xs sm:text-[13px] font-semibold leading-snug">
            {n.message_bn}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4A5850] dark:text-[#B9C4BC]">
            <span className="truncate">
              {lang === 'bn' ? n.actorNameBn : n.actorNameEn} →{' '}
              {lang === 'bn' ? n.affectedLabelBn : n.affectedLabelEn} •{' '}
              <strong
                className={
                  isCredit
                    ? 'text-[#14452F] dark:text-[#A9E0BE]'
                    : 'text-[#C45C3E] dark:text-[#F49B82]'
                }
              >
                {formatBDT(Math.abs(n.amount), lang)}
              </strong>
            </span>

            <button
              type="button"
              onClick={() => {
                markNotificationRead(n.id);
                dismissMoneyToast();
                onOpenMoney();
              }}
              className="inline-flex items-center gap-1 font-bold text-[#14452F] dark:text-[#D4AF37] hover:underline shrink-0 cursor-pointer"
            >
              <span>{lang === 'bn' ? 'হিসাব' : 'Ledger'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
