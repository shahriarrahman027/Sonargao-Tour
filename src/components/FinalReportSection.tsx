import React from 'react';
import { Download, Printer } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { CATEGORY_LABELS, formatBDT, formatDateTime } from '../lib/i18n';

export const FinalReportSection: React.FC = () => {
  const { lang, state, finance } = useTour();

  if (!state || !finance) return null;

  const memberName = (id: string) => {
    const m = state.members.find((x) => x.id === id);
    return m ? (lang === 'bn' ? m.name_bn : m.name_en) : '';
  };

  const downloadMarkdown = () => {
    const lines = [
      `# ${state.settings.website_name_bn} — Final Tour Report`,
      `Tour Date: ${state.settings.tour_date}`,
      `Route: ${state.settings.start_location_en} -> ${state.settings.destinations_en}`,
      '',
      '## Financial Summary',
      `- Total Collected: ৳${finance.totalCollected}`,
      `- Group Cash Spent: ৳${finance.totalGroupCashSpent}`,
      `- Personal Paid: ৳${finance.totalPersonalPaidSpent}`,
      `- Remaining Cash Fund: ৳${finance.remainingGroupCash}`,
      '',
      '## Individual Member Settlement',
      ...finance.memberSummaries.map(
        (m) =>
          `- ${m.member.name_en}: Contributed ৳${m.totalContributed}, Allocated ৳${m.totalAllocated}, Final Balance ৳${m.balance}`,
      ),
      '',
      '## Expense Breakdown',
      ...state.expenses.map(
        (e) => `- ${e.title} (${e.category}, ${e.funding_source}): ৳${e.total_amount}`,
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `final-tour-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
            {lang === 'bn' ? 'চূড়ান্ত ট্যুর রিপোর্ট' : 'FINAL TOUR REPORT'}
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-[#14452F] dark:text-[#FAF7F0] mt-1">
            {lang === 'bn' ? state.settings.website_name_bn : state.settings.website_name_en}
          </h2>
          <p className="text-sm text-[#5C6A62] mt-1">
            {lang === 'bn' ? state.settings.destinations_bn : state.settings.destinations_en}
          </p>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadMarkdown}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#14452F]/20 dark:border-white/15 px-4 py-2.5 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'bn' ? 'রিপোর্ট ডাউনলোড (.md)' : 'Download Report'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#14452F] text-white px-4 py-2.5 text-xs font-bold cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{lang === 'bn' ? 'প্রিন্ট / PDF সংরক্ষণ' : 'Print / Save PDF'}</span>
          </button>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print-break-inside-avoid">
        <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-black/10 dark:border-white/10 p-4">
          <div className="text-xs text-[#5C6A62]">{lang === 'bn' ? 'মোট জমা' : 'Total Collected'}</div>
          <div className="font-editorial text-2xl font-bold mt-1 text-[#14452F] dark:text-[#A9E0BE]">
            {formatBDT(finance.totalCollected, lang)}
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-black/10 dark:border-white/10 p-4">
          <div className="text-xs text-[#5C6A62]">{lang === 'bn' ? 'সর্বমোট খরচ' : 'Total Spent'}</div>
          <div className="font-editorial text-2xl font-bold mt-1 text-[#C45C3E]">
            {formatBDT(finance.totalAllExpenses, lang)}
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-black/10 dark:border-white/10 p-4">
          <div className="text-xs text-[#5C6A62]">{lang === 'bn' ? 'অবশিষ্ট ক্যাশ' : 'Remaining Cash'}</div>
          <div className="font-editorial text-2xl font-bold mt-1">
            {formatBDT(finance.remainingGroupCash, lang)}
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-black/10 dark:border-white/10 p-4">
          <div className="text-xs text-[#5C6A62]">{lang === 'bn' ? 'স্মৃতির ছবি' : 'Photos Saved'}</div>
          <div className="font-editorial text-2xl font-bold mt-1">{state.photos.length}</div>
        </div>
      </div>

      {/* Individual Settlement Table */}
      <div className="rounded-3xl bg-white dark:bg-[#131F19] border border-black/10 dark:border-white/10 p-6 print-break-inside-avoid overflow-x-auto">
        <h3 className="font-editorial text-xl font-bold mb-4">
          {lang === 'bn' ? 'সদস্যদের চূড়ান্ত হিসাব ও সমন্বয়' : 'Final Individual Member Settlement'}
        </h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 text-xs uppercase text-[#5C6A62]">
              <th className="py-2 pr-4">{lang === 'bn' ? 'সদস্য' : 'Member'}</th>
              <th className="py-2 pr-4">{lang === 'bn' ? 'জমা' : 'Contributed'}</th>
              <th className="py-2 pr-4">{lang === 'bn' ? 'বণ্টনকৃত খরচ' : 'Allocated'}</th>
              <th className="py-2 pr-4">{lang === 'bn' ? 'নিজস্ব পাওনা' : 'Owed (Personal)'}</th>
              <th className="py-2 text-right">{lang === 'bn' ? 'চূড়ান্ত ব্যালেন্স' : 'Final Balance'}</th>
            </tr>
          </thead>
          <tbody>
            {finance.memberSummaries.map((m) => (
              <tr key={m.member.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 pr-4 font-semibold">
                  {lang === 'bn' ? m.member.name_bn : m.member.name_en}
                </td>
                <td className="py-3 pr-4">{formatBDT(m.totalContributed, lang)}</td>
                <td className="py-3 pr-4">{formatBDT(m.totalAllocated, lang)}</td>
                <td className="py-3 pr-4">{formatBDT(m.personalPaidUnreimbursed, lang)}</td>
                <td
                  className={`py-3 text-right font-bold ${
                    m.balance >= 0 ? 'text-[#14452F] dark:text-[#A9E0BE]' : 'text-[#C45C3E]'
                  }`}
                >
                  {formatBDT(m.balance, lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Category & Poll Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-break-inside-avoid">
        <div className="rounded-3xl bg-white dark:bg-[#131F19] border border-black/10 dark:border-white/10 p-6">
          <h3 className="font-editorial text-lg font-bold mb-3">
            {lang === 'bn' ? 'খাতভিত্তিক খরচ' : 'Spending by Category'}
          </h3>
          {finance.categoryTotals.length === 0 ? (
            <p className="text-xs text-[#5C6A62]">—</p>
          ) : (
            <div className="space-y-2 text-sm">
              {finance.categoryTotals.map((c) => (
                <div key={c.category} className="flex justify-between">
                  <span>{CATEGORY_LABELS[c.category][lang]}</span>
                  <span className="font-semibold">
                    {formatBDT(c.amount, lang)} ({c.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white dark:bg-[#131F19] border border-black/10 dark:border-white/10 p-6">
          <h3 className="font-editorial text-lg font-bold mb-3">
            {lang === 'bn' ? 'ভোটিং ফলাফল' : 'Poll Outcomes'}
          </h3>
          <div className="space-y-3 text-xs">
            {state.polls.map((poll) => (
              <div key={poll.id}>
                <div className="font-bold">{lang === 'bn' ? poll.question_bn : poll.question_en}</div>
                {poll.options.map((o) => (
                  <div key={o.id} className="flex justify-between text-[#5C6A62] mt-0.5">
                    <span>{lang === 'bn' ? o.label_bn : o.label_en}</span>
                    <span>{poll.votes.filter((v) => v.option_id === o.id).length} votes</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full Transaction History */}
      <div className="rounded-3xl bg-white dark:bg-[#131F19] border border-black/10 dark:border-white/10 p-6">
        <h3 className="font-editorial text-xl font-bold mb-3">
          {lang === 'bn' ? 'সম্পূর্ণ লেনদেন ইতিহাস' : 'Transaction History'}
        </h3>
        {state.expenses.length === 0 && state.contributions.length === 0 ? (
          <p className="text-sm text-[#5C6A62]">
            {lang === 'bn' ? 'কোনো লেনদেন এখনো রেকর্ড হয়নি।' : 'No transactions recorded yet.'}
          </p>
        ) : (
          <div className="space-y-2 text-xs">
            {state.expenses.map((e) => (
              <div key={e.id} className="flex justify-between py-2 border-b border-black/5 dark:border-white/5">
                <div>
                  <strong>{e.title}</strong> ({CATEGORY_LABELS[e.category][lang]}) •{' '}
                  {formatDateTime(e.expense_at, lang)}
                </div>
                <span className="font-bold text-[#C45C3E]">-{formatBDT(e.total_amount, lang)}</span>
              </div>
            ))}
            {state.contributions.map((c) => (
              <div key={c.id} className="flex justify-between py-2 border-b border-black/5 dark:border-white/5">
                <div>
                  <strong>{memberName(c.member_id)}</strong> ({c.payment_method}) •{' '}
                  {formatDateTime(c.contributed_at, lang)}
                </div>
                <span className="font-bold text-[#14452F] dark:text-[#A9E0BE]">
                  +{formatBDT(c.amount, lang)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
