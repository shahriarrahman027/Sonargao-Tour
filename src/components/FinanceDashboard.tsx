import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  Edit3,
  History,
  Info,
  Plus,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTour } from '../context/TourContext';
import { EXPENSE_CATEGORIES } from '../lib/accounting';
import { CATEGORY_LABELS, formatBDT, formatDateTime, translations } from '../lib/i18n';
import { tourApi } from '../lib/tourApi';
import type { Contribution, Expense, ExpenseCategory } from '../types/tour';
import { ContributionModal } from './ContributionModal';
import { ExpenseFormModal } from './ExpenseFormModal';

const CHART_COLORS = ['#14452F', '#C45C3E', '#C89F3C', '#2E7D5B', '#7B5E42', '#4D7C8A', '#8E6C88'];

export const FinanceDashboard: React.FC = () => {
  const { lang, state, finance, session, isOnline, refreshState, showToast } = useTour();
  const t = translations[lang].money;

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<'ALL' | ExpenseCategory>('ALL');
  const [ledgerTab, setLedgerTab] = useState<'all' | 'expenses' | 'contributions' | 'audit'>('all');
  const [contribModalOpen, setContribModalOpen] = useState(false);
  const [correctingContrib, setCorrectingContrib] = useState<Contribution | null>(null);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const members = state?.members || [];
  const memberName = (id?: string | null) => {
    const m = members.find((x) => x.id === id);
    if (!m) return lang === 'bn' ? 'অজানা' : 'Unknown';
    return lang === 'bn' ? m.name_bn : m.name_en;
  };

  const filteredExpenses = useMemo(() => {
    const list = state?.expenses || [];
    return list.filter((e) => {
      if (catFilter !== 'ALL' && e.category !== catFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state?.expenses, catFilter, search]);

  const filteredContributions = useMemo(() => {
    const list = state?.contributions || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        memberName(c.member_id).toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q) ||
        c.reference_code.toLowerCase().includes(q),
    );
  }, [state?.contributions, search, members, lang]);

  const exportCsv = () => {
    if (!state || !finance) return;
    const rows = [
      ['Type', 'Date', 'Title/Member', 'Category/Method', 'Funding', 'Amount (BDT)', 'Details'],
      ...state.contributions.map((c) => [
        'Contribution',
        c.contributed_at,
        memberName(c.member_id),
        c.payment_method,
        'Cash Pouch',
        String(c.amount),
        c.notes,
      ]),
      ...state.expenses.map((e) => [
        'Expense',
        e.expense_at,
        e.title,
        e.category,
        e.funding_source,
        String(e.total_amount),
        e.allocations.map((a) => `${memberName(a.member_id)}:${a.allocated_amount}`).join(' | '),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonargaon-tour-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!state || !finance) return null;

  const isAdmin = Boolean(session?.isAdmin);
  const collectedVsSpentData = [
    {
      name: lang === 'bn' ? 'মোট জমা' : 'Collected',
      amount: finance.totalCollected,
      fill: '#14452F',
    },
    {
      name: lang === 'bn' ? 'ক্যাশ খরচ' : 'Cash Spent',
      amount: finance.totalGroupCashSpent,
      fill: '#C45C3E',
    },
    {
      name: lang === 'bn' ? 'অবশিষ্ট ক্যাশ' : 'Remaining',
      amount: Math.max(0, finance.remainingGroupCash),
      fill: '#C89F3C',
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header & Admin Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C45C3E] dark:text-[#E58A6E]">
            {lang === 'bn' ? 'স্বচ্ছ নগদ লেজার' : 'TRANSPARENT CASH LEDGER'}
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-[#14452F] dark:text-[#FAF7F0] mt-1">
            {t.title}
          </h2>
          <p className="text-sm text-[#4A5850] dark:text-[#B9C4BC] mt-1">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#14452F]/20 dark:border-white/15 px-3.5 py-2.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{translations[lang].common.exportCsv}</span>
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                disabled={!isOnline}
                onClick={() => setContribModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#C89F3C] hover:bg-[#B58C2C] disabled:opacity-50 text-[#111914] px-4 py-2.5 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addContribution}</span>
              </button>
              <button
                type="button"
                disabled={!isOnline}
                onClick={() => {
                  setEditingExpense(null);
                  setExpenseModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#14452F] hover:bg-[#1B5B3E] disabled:opacity-50 text-[#FAF7F0] px-4 py-2.5 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addExpense}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-2xl border border-[#14452F]/15 dark:border-white/10 bg-[#DCE6DF]/50 dark:bg-white/5 px-4 py-3 text-xs flex items-center gap-2 text-[#2C3B32] dark:text-[#C5D1C9]">
          <Info className="w-4 h-4 shrink-0 text-[#14452F] dark:text-[#D4AF37]" />
          <span>{t.adminOnlyNotice}</span>
        </div>
      )}

      {/* Alerts: Budget Warning & Reconciliation */}
      {(finance.budgetWarningActive || finance.hasDiscrepancy) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {finance.budgetWarningActive && (
            <div className="rounded-2xl border border-[#C45C3E]/40 bg-[#C45C3E]/10 px-4 py-3 flex items-center gap-3 text-sm font-medium text-[#9D3B20] dark:text-[#F49B82]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                {t.budgetWarning} ({finance.budgetUsedPct}% {lang === 'bn' ? 'ব্যবহৃত' : 'used'})
              </span>
            </div>
          )}
          {finance.hasDiscrepancy && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 flex items-center gap-3 text-sm font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                {t.discrepancyAlert}: {formatBDT(finance.discrepancyAmount, lang)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Hero Remaining Cash Card + KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-3xl bg-[#14452F] text-[#FAF7F0] p-6 sm:p-7 shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-[#D4AF37]/15 blur-xl" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                {t.remainingCash}
              </span>
              <Wallet className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="font-editorial text-4xl sm:text-5xl font-bold mt-3 tracking-tight">
              {formatBDT(finance.remainingGroupCash, lang)}
            </div>
            <p className="mt-2 text-xs text-white/75">{t.formulaNote}</p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/15 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>{t.collectionProgress}</span>
              <span className="font-bold">
                {formatBDT(finance.totalCollected, lang)} / {formatBDT(finance.targetGroupCollection, lang)} ({finance.collectionProgressPct}%)
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#D4AF37] transition-all duration-500"
                style={{ width: `${finance.collectionProgressPct}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#A9E0BE] pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t.reconciledOk}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4">
            <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">{t.totalCollected}</div>
            <div className="font-editorial text-2xl font-bold text-[#14452F] dark:text-[#A9E0BE] mt-1">
              {formatBDT(finance.totalCollected, lang)}
            </div>
            <div className="text-[11px] text-[#5C6A62] mt-1">
              {finance.contributionCount} {lang === 'bn' ? 'টি জমা' : 'deposits'}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4">
            <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">{t.totalSpent}</div>
            <div className="font-editorial text-2xl font-bold text-[#C45C3E] mt-1">
              {formatBDT(finance.totalGroupCashSpent, lang)}
            </div>
            <div className="text-[11px] text-[#5C6A62] mt-1">
              {lang === 'bn' ? 'ক্যাশ ব্যাগ থেকে' : 'From cash pouch'}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4">
            <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">{t.expenseCount}</div>
            <div className="font-editorial text-2xl font-bold mt-1">{finance.expenseCount}</div>
            <div className="text-[11px] text-[#5C6A62] mt-1">
              {lang === 'bn' ? 'সর্বমোট খরচ:' : 'All expenses:'} {formatBDT(finance.totalAllExpenses, lang)}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4">
            <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">{t.personalPaid}</div>
            <div className="font-editorial text-2xl font-bold mt-1">
              {formatBDT(finance.totalPersonalPaidSpent, lang)}
            </div>
            <div className="text-[11px] text-[#5C6A62] mt-1">
              {lang === 'bn' ? 'ক্যাশ ব্যালেন্স থেকে আলাদা' : 'Tracked separately'}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4">
            <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">{t.unreimbursed}</div>
            <div className="font-editorial text-2xl font-bold text-[#C89F3C] mt-1">
              {formatBDT(finance.totalPersonalUnreimbursed, lang)}
            </div>
            <div className="text-[11px] text-[#5C6A62] mt-1">
              {lang === 'bn' ? 'দাতাকে ফেরত দিতে হবে' : 'Pending reimbursement'}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4">
            <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">{t.underpaidAlert}</div>
            <div className="font-editorial text-2xl font-bold mt-1">
              {finance.underpaidMembers.length} {lang === 'bn' ? 'জন' : 'members'}
            </div>
            <div className="text-[11px] text-[#5C6A62] mt-1 truncate">
              {finance.underpaidMembers.length > 0
                ? finance.underpaidMembers.map((m) => (lang === 'bn' ? m.member.name_bn : m.member.name_en)).join(', ')
                : lang === 'bn'
                  ? 'সবার জমা পূর্ণ!'
                  : 'All settled!'}
            </div>
          </div>
        </div>
      </div>

      {/* Member Individual Balances */}
      <div>
        <h3 className="font-editorial text-xl font-bold text-[#14452F] dark:text-[#FAF7F0] mb-3">
          {t.memberBalances}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {finance.memberSummaries.map((ms) => {
            const positive = ms.balance >= 0;
            return (
              <div
                key={ms.member.id}
                className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-base">
                      {lang === 'bn' ? ms.member.name_bn : ms.member.name_en}
                    </div>
                    <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">
                      {lang === 'bn' ? ms.member.nickname_bn : ms.member.nickname_en}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      positive
                        ? 'bg-[#14452F]/10 text-[#14452F] dark:bg-[#1E5C40]/35 dark:text-[#A9E0BE]'
                        : 'bg-[#C45C3E]/12 text-[#C45C3E]'
                    }`}
                  >
                    {positive ? '+' : ''}
                    {formatBDT(ms.balance, lang)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs pt-3 border-t border-black/5 dark:border-white/10">
                  <div>
                    <span className="text-[#5C6A62] dark:text-[#9AA89F] block">
                      {lang === 'bn' ? 'মোট জমা' : 'Contributed'}
                    </span>
                    <span className="font-semibold">{formatBDT(ms.totalContributed, lang)}</span>
                  </div>
                  <div>
                    <span className="text-[#5C6A62] dark:text-[#9AA89F] block">
                      {lang === 'bn' ? 'ব্যক্তিগত খরচ' : 'Allocated'}
                    </span>
                    <span className="font-semibold">{formatBDT(ms.totalAllocated, lang)}</span>
                  </div>
                </div>

                {(ms.outstandingContribution > 0 || ms.personalPaidUnreimbursed > 0) && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
                    {ms.outstandingContribution > 0 && (
                      <span className="rounded-lg bg-[#C89F3C]/15 text-[#7A5B12] dark:text-[#F0D38C] px-2 py-0.5 font-medium">
                        {lang === 'bn' ? 'জমা বাকি:' : 'Due:'} {formatBDT(ms.outstandingContribution, lang)}
                      </span>
                    )}
                    {ms.personalPaidUnreimbursed > 0 && (
                      <span className="rounded-lg bg-[#C45C3E]/15 text-[#C45C3E] px-2 py-0.5 font-medium">
                        {lang === 'bn' ? 'পাওনা:' : 'Owed:'} {formatBDT(ms.personalPaidUnreimbursed, lang)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5">
          <h4 className="font-semibold text-sm mb-3">{t.collectedVsSpent}</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectedVsSpentData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {collectedVsSpentData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5">
          <h4 className="font-semibold text-sm mb-3">{t.categoryChart}</h4>
          {finance.categoryTotals.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[#5C6A62]">
              {lang === 'bn' ? 'এখনো কোনো খরচ রেকর্ড হয়নি' : 'No expenses recorded yet'}
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={finance.categoryTotals.map((c) => ({
                      name: CATEGORY_LABELS[c.category][lang],
                      value: c.amount,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {finance.categoryTotals.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5">
          <h4 className="font-semibold text-sm mb-3">{t.timelineChart}</h4>
          {finance.spendingTimeline.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[#5C6A62]">
              {lang === 'bn' ? 'খরচ যোগ হলে গ্রাফ দেখা যাবে' : 'Timeline appears once expenses are added'}
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={finance.spendingTimeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="cumulativeSpent" stroke="#14452F" fill="#14452F" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Ledger & Search */}
      <div className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', lang === 'bn' ? 'সব লেনদেন' : 'All'],
                ['expenses', lang === 'bn' ? 'খরচসমূহ' : 'Expenses'],
                ['contributions', lang === 'bn' ? 'জমাসমূহ' : 'Contributions'],
                ['audit', t.auditLog],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setLedgerTab(key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                  ledgerTab === key
                    ? 'bg-[#14452F] text-white dark:bg-[#D4AF37] dark:text-[#0E1612]'
                    : 'bg-black/5 dark:bg-white/5'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6A62]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={translations[lang].common.search}
                className="rounded-xl border border-[#14452F]/15 dark:border-white/15 bg-transparent pl-9 pr-3 py-1.5 text-xs"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as 'ALL' | ExpenseCategory)}
              className="rounded-xl border border-[#14452F]/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-xs"
            >
              <option value="ALL">{t.allCategories}</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c][lang]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Expenses List */}
        {(ledgerTab === 'all' || ledgerTab === 'expenses') && (
          <div className="space-y-3 mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C6A62]">
              {lang === 'bn' ? 'খরচের তালিকা' : 'Recorded Expenses'} ({filteredExpenses.length})
            </h4>
            {filteredExpenses.length === 0 ? (
              <p className="text-sm text-[#5C6A62] py-4">
                {lang === 'bn' ? 'কোনো খরচ পাওয়া যায়নি।' : 'No expenses recorded yet.'}
              </p>
            ) : (
              filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => setDetailExpense(exp)}
                  className="rounded-2xl border border-[#14452F]/10 dark:border-white/10 p-4 hover:bg-[#FAF7F0] dark:hover:bg-white/5 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-[#C45C3E]/12 text-[#C45C3E]">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{exp.title}</div>
                      <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F] mt-0.5 flex flex-wrap gap-2">
                        <span>{CATEGORY_LABELS[exp.category][lang]}</span>
                        <span>•</span>
                        <span>{formatDateTime(exp.expense_at, lang)}</span>
                        <span>•</span>
                        <span>
                          {exp.funding_source === 'group_cash'
                            ? lang === 'bn'
                              ? 'গ্রুপ ক্যাশ'
                              : 'Group Cash'
                            : `${lang === 'bn' ? 'ব্যক্তিগত:' : 'Paid by:'} ${memberName(exp.payer_member_id)}`}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {exp.allocations.map((a) => (
                          <span
                            key={a.member_id}
                            className="rounded-md bg-black/5 dark:bg-white/8 px-2 py-0.5 text-[11px]"
                          >
                            {memberName(a.member_id)}: {formatBDT(a.allocated_amount, lang)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="font-editorial text-lg font-bold text-[#C45C3E]">
                      {formatBDT(exp.total_amount, lang)}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setEditingExpense(exp);
                          setExpenseModalOpen(true);
                        }}
                        className="p-2 rounded-xl border border-[#14452F]/15 hover:bg-black/5 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Contributions List */}
        {(ledgerTab === 'all' || ledgerTab === 'contributions') && (
          <div className="space-y-2.5 mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C6A62]">
              {lang === 'bn' ? 'জমার ইতিহাস' : 'Contribution History'} ({filteredContributions.length})
            </h4>
            {filteredContributions.length === 0 ? (
              <p className="text-sm text-[#5C6A62] py-3">
                {lang === 'bn' ? 'এখনো কোনো জমা রেকর্ড হয়নি।' : 'No contributions recorded yet.'}
              </p>
            ) : (
              filteredContributions.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-[#14452F]/10 dark:border-white/10 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#14452F]/12 text-[#14452F] dark:text-[#A9E0BE]">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">
                        {memberName(c.member_id)}{' '}
                        {c.is_correction && (
                          <span className="text-[10px] rounded bg-[#C89F3C]/20 px-1.5 py-0.5 ml-1">
                            {lang === 'bn' ? 'সংশোধন' : 'Correction'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#5C6A62] dark:text-[#9AA89F]">
                        {c.payment_method} • {formatDateTime(c.contributed_at, lang)}
                        {c.notes ? ` • ${c.notes}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`font-editorial text-base font-bold ${
                        c.amount >= 0 ? 'text-[#14452F] dark:text-[#A9E0BE]' : 'text-[#C45C3E]'
                      }`}
                    >
                      {c.amount >= 0 ? '+' : ''}
                      {formatBDT(c.amount, lang)}
                    </div>
                    {isAdmin && !c.is_correction && (
                      <button
                        type="button"
                        disabled={!isOnline}
                        title={lang === 'bn' ? 'সংশোধন এন্ট্রি যোগ করুন' : 'Create correction/offset entry'}
                        onClick={() => {
                          setCorrectingContrib(c);
                          setContribModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl border border-[#14452F]/15 hover:bg-black/5 disabled:opacity-45 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Audit Log */}
        {ledgerTab === 'audit' && (
          <div className="space-y-2">
            {state.activityLog.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-xl border border-black/5 dark:border-white/10 p-3 text-xs"
              >
                <History className="w-4 h-4 shrink-0 mt-0.5 text-[#14452F] dark:text-[#D4AF37]" />
                <div className="flex-1">
                  <div className="font-medium">{lang === 'bn' ? log.summary_bn : log.summary_en}</div>
                  <div className="text-[11px] text-[#5C6A62] mt-0.5">
                    {formatDateTime(log.created_at, lang)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expense Details Modal */}
      {detailExpense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setDetailExpense(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-[#FAF7F0] dark:bg-[#131F19] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-editorial text-xl font-bold">{detailExpense.title}</h4>
                <p className="text-xs text-[#5C6A62]">
                  {CATEGORY_LABELS[detailExpense.category][lang]} • {formatDateTime(detailExpense.expense_at, lang)}
                </p>
              </div>
              <span className="font-editorial text-xl font-bold text-[#C45C3E]">
                {formatBDT(detailExpense.total_amount, lang)}
              </span>
            </div>
            {detailExpense.description && <p className="text-sm">{detailExpense.description}</p>}
            {detailExpense.receipt_url && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#5C6A62] mb-1.5">
                  {lang === 'bn' ? 'সংযুক্ত রসিদ' : 'Attached Receipt'}
                </h5>
                <img
                  src={detailExpense.receipt_url}
                  alt="Expense receipt"
                  className="max-h-48 rounded-2xl border border-black/10 object-contain"
                />
              </div>
            )}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#5C6A62] mb-2">
                {lang === 'bn' ? 'সদস্যভিত্তিক বণ্টন' : 'Member Allocations'}
              </h5>
              <div className="space-y-1.5">
                {detailExpense.allocations.map((a) => (
                  <div key={a.member_id} className="flex justify-between text-sm py-1 border-b border-black/5 dark:border-white/5">
                    <span>
                      {memberName(a.member_id)} {a.note ? `(${a.note})` : ''}
                    </span>
                    <span className="font-semibold">{formatBDT(a.allocated_amount, lang)}</span>
                  </div>
                ))}
              </div>
            </div>
            {detailExpense.edit_history && detailExpense.edit_history.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#C45C3E] mb-1">
                  {lang === 'bn' ? 'সম্পাদনা ইতিহাস' : 'Edit Audit Trail'}
                </h5>
                {detailExpense.edit_history.map((h) => (
                  <div key={h.id} className="text-xs bg-black/5 dark:bg-white/5 rounded-lg p-2 mb-1">
                    <strong>{h.reason}</strong> — {formatDateTime(h.created_at, lang)}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDetailExpense(null)}
                className="rounded-xl bg-[#14452F] text-white px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                {translations[lang].common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void / Reverse Expense Modal */}
      {voidingExpense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setVoidingExpense(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await tourApi.voidExpenseWithAudit(voidingExpense.id, voidReason);
              await refreshState();
              showToast(lang === 'bn' ? 'খরচ অডিটসহ বাতিল হয়েছে' : 'Expense voided with audit log');
              setVoidingExpense(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#FAF7F0] dark:bg-[#131F19] p-6 shadow-2xl space-y-4"
          >
            <h4 className="font-editorial text-lg font-bold text-[#C45C3E]">
              {lang === 'bn' ? 'খরচ বাতিল / রিভার্স করুন' : 'Void / Reverse Expense'}
            </h4>
            <p className="text-xs text-[#4A5850] dark:text-[#B9C4BC]">
              {lang === 'bn'
                ? `ঐতিহাসিক রেকর্ড মুছে ফেলা হবে না—শুধুমাত্র "${voidingExpense.title}" (${formatBDT(voidingExpense.total_amount, lang)}) অডিট লগসহ রিভার্সড হিসেবে চিহ্নিত হবে।`
                : `History is never silently deleted. "${voidingExpense.title}" (${formatBDT(voidingExpense.total_amount, lang)}) will be marked voided with an audit entry.`}
            </p>
            <input
              type="text"
              required
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder={lang === 'bn' ? 'বাতিলের কারণ লিখুন...' : 'Reason for voiding (required)...'}
              className="w-full rounded-xl border border-[#C45C3E]/40 bg-white dark:bg-[#0D1511] px-3.5 py-2.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setVoidingExpense(null)} className="px-4 py-2 text-xs">
                {translations[lang].common.cancel}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#C45C3E] text-white px-4 py-2 text-xs font-bold cursor-pointer"
              >
                {lang === 'bn' ? 'নিশ্চিত করুন' : 'Confirm Void'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modals */}
      {contribModalOpen && (
        <ContributionModal
          open={contribModalOpen}
          correctingContribution={correctingContrib}
          onClose={() => {
            setContribModalOpen(false);
            setCorrectingContrib(null);
          }}
        />
      )}
      {expenseModalOpen && (
        <ExpenseFormModal
          open={expenseModalOpen}
          editingExpense={editingExpense}
          onClose={() => {
            setExpenseModalOpen(false);
            setEditingExpense(null);
          }}
        />
      )}
    </section>
  );
};
