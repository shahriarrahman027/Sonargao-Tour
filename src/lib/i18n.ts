import type { ExpenseCategory, Language } from '../types/tour';

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

export function formatNumber(val: number, lang: Language): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(val) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(val);
  return lang === 'bn' ? toBanglaDigits(formatted) : formatted;
}

export function formatBDT(val: number, lang: Language): string {
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs);
  const numStr = lang === 'bn' ? toBanglaDigits(formatted) : formatted;
  return val < 0 ? `-৳${numStr}` : `৳${numStr}`;
}

export function formatDateTime(iso: string, lang: Language): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  if (lang === 'bn') {
    const str = dt.toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    return str;
  }
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const CATEGORY_LABELS: Record<ExpenseCategory, { bn: string; en: string }> = {
  Transport: { bn: 'যাতায়াত', en: 'Transport' },
  Food: { bn: 'খাবার', en: 'Food' },
  Tickets: { bn: 'টিকিট', en: 'Tickets' },
  Shopping: { bn: 'কেনাকাটা', en: 'Shopping' },
  Accommodation: { bn: 'থাকা/বিশ্রাম', en: 'Accommodation' },
  Miscellaneous: { bn: 'বিবিধ', en: 'Miscellaneous' },
  Other: { bn: 'অন্যান্য', en: 'Other' },
};

export const translations = {
  bn: {
    nav: {
      home: 'হোম',
      explore: 'গন্তব্য',
      journey: 'ভ্রমণপথ',
      crew: 'টিম',
      money: 'হিসাব',
      expenses: 'খরচ',
      more: 'আরও',
      photos: 'ছবি',
      social: 'ভোট ও নোট',
      checklist: 'চেকলিস্ট',
      report: 'রিপোর্ট',
      admin: 'অ্যাডমিন',
    },
    gate: {
      badge: '৬ বন্ধুর প্রাইভেট ট্যুর গেট • DIU',
      heading: 'আরেহ! মামা আইডি কার্ড দেখান আগে:',
      subtitle: 'চুপচাপ বাসে উঠে পড়ার কোনো সুযোগ নাই! ৬ বন্ধুর প্রাইভেট ট্যুর হেডকোয়ার্টার্সে ঢুকতে আগে কার্ড চেক করান।',
      studentIdLabel: '( আইডি নম্বর দেন মামা)',
      studentIdPlaceholder: '( আইডি নম্বর দেন মামা)',
      passcodeLabel: 'গ্রুপ পাসকোড',
      passcodePlaceholder: 'গ্রুপ পাসকোড লিখুন',
      enterBtn: 'কার্ড চেক করে ঢুকান মামা!',
      verifying: 'আইডি কার্ড স্ক্যান হচ্ছে মামা...',
      invalidId: 'এইডা আবার কার আইডি মামা? আমাদের লিস্টে তো নাই! 😅',
      privacyNote: 'চিন্তা নাই—আইডি নম্বর কখনোই পাবলিকলি দেখানো হয় না, শুধুমাত্র হ্যাশ যাচাই হয়।',
      devHintTitle: 'লোকাল ডেভেলপমেন্ট মোড',
      devHintBody: 'Supabase সংযুক্ত না থাকায় লোকাল সেশন মোডে চলছে। শুধুমাত্র অনুমোদিত ৬ বন্ধুর হ্যাশকৃত আইডি কাজ করবে।',
    },
    common: {
      offlineBanner: 'আপনি এখন অফলাইনে আছেন। ভ্রমণসূচি ও চেকলিস্ট দেখা যাবে, তবে নতুন আর্থিক লেনদেন অনলাইনে ফিরে সেভ হবে।',
      devBanner: 'ডেভেলপমেন্ট মোড (লোকাল ব্রাউজার স্টোরেজ) — প্রোডাকশনের জন্য Supabase সংযুক্ত করুন।',
      save: 'সংরক্ষণ করুন',
      cancel: 'বাতিল',
      edit: 'সম্পাদনা',
      delete: 'মুছে ফেলুন',
      add: 'যোগ করুন',
      close: 'বন্ধ করুন',
      search: 'খুঁজুন...',
      loading: 'লোড হচ্ছে...',
      logout: 'লগ আউট',
      adminMode: 'অ্যাডমিন আনলকড',
      unlockAdmin: 'অ্যাডমিন লগইন',
      soundOn: 'সাউন্ড চালু',
      soundOff: 'সাউন্ড মিউট',
      musicOn: 'মিউজিক চালু',
      musicOff: 'মিউজিক বন্ধ',
      darkMode: 'ডার্ক মোড',
      lightMode: 'লাইট মোড',
      systemMode: 'সিস্টেম',
      days: 'দিন',
      hours: 'ঘণ্টা',
      minutes: 'মিনিট',
      seconds: 'সেকেন্ড',
      tourDayLive: 'আজ আমাদের ট্যুর!',
      cashMethod: 'নগদ (Cash)',
      exportCsv: 'CSV ডাউনলোড',
      printReport: 'প্রিন্ট / PDF',
    },
    hero: {
      dateLabel: 'ট্যুরের তারিখ',
      routeLabel: 'যাত্রা ও গন্তব্য',
      budgetLabel: 'আনুমানিক বাজেট',
      perPerson: 'প্রতিজন',
      countdownTitle: 'যাত্রা শুরু হতে বাকি',
      scrollHint: 'ভ্রমণ বৃত্তান্ত দেখুন',
      exploreMoney: 'টাকার হিসাব দেখুন',
      explorePlan: 'ভ্রমণসূচি ও ম্যাপ',
    },
    money: {
      title: 'ট্যুর ফান্ড ও খরচ ব্যবস্থাপনা',
      subtitle: 'স্বচ্ছ নগদ হিসাব — প্রতিটি টাকা ও ব্যক্তিগত বণ্টনের নির্ভুল রেকর্ড',
      remainingCash: 'অবশিষ্ট ক্যাশ ফান্ড',
      totalCollected: 'মোট জমা',
      totalSpent: 'মোট খরচ (গ্রুপ ক্যাশ)',
      personalPaid: 'ব্যক্তিগতভাবে পরিশোধিত',
      unreimbursed: 'ফেরতযোগ্য (ব্যক্তিগত)',
      expenseCount: 'মোট খরচের সংখ্যা',
      collectionProgress: 'ফান্ড সংগ্রহের অগ্রগতি',
      memberBalances: 'সদস্যদের ব্যক্তিগত ব্যালেন্স',
      underpaidAlert: 'বাকি থাকা জমা',
      categoryChart: 'খাত অনুযায়ী খরচ',
      timelineChart: 'খরচের সময়রেখা',
      collectedVsSpent: 'জমা বনাম খরচ',
      ledger: 'সম্পূর্ণ লেজার ও লেনদেন',
      auditLog: 'আর্থিক অডিট লগ',
      addContribution: 'জমা রেকর্ড করুন',
      addExpense: 'নতুন খরচ যোগ করুন',
      allCategories: 'সব খাত',
      formulaNote: 'ব্যালেন্স = মোট জমা − ব্যক্তিগত খরচ বণ্টন | গ্রুপ ক্যাশ = মোট জমা − গ্রুপ ক্যাশ থেকে খরচ',
      reconciledOk: 'হিসাব ১০০% মিলেছে — কোনো গরমিল নেই',
      discrepancyAlert: 'সতর্কতা: হিসাবের গরমিল পাওয়া গেছে',
      budgetWarning: 'সতর্কতা: অনুমোদিত বাজেটের সীমা প্রায় পূর্ণ!',
      adminOnlyNotice: 'শুধুমাত্র অ্যাডমিন (শাহরিয়ার) আর্থিক তথ্য যোগ বা সংশোধন করতে পারবেন।',
    },
  },
  en: {
    nav: {
      home: 'Home',
      explore: 'Explore',
      journey: 'Journey',
      crew: 'Crew',
      money: 'Money',
      expenses: 'Expenses',
      more: 'More',
      photos: 'Photos',
      social: 'Polls & Notes',
      checklist: 'Checklist',
      report: 'Report',
      admin: 'Admin',
    },
    gate: {
      badge: 'PRIVATE CREW GATE • 6 FRIENDS',
      heading: 'Whoa mama! Show your ID card first:',
      subtitle: 'No sneaking onto the bus! Flash your DIU crew ID to unlock our private tour headquarters.',
      studentIdLabel: '( Enter your ID number, mama )',
      studentIdPlaceholder: '( Enter your ID number, mama )',
      passcodeLabel: 'Group Passcode',
      passcodePlaceholder: 'Enter shared group passcode',
      enterBtn: 'Verify Card & Hop In!',
      verifying: 'Scanning your crew ID...',
      invalidId: 'এইডা আবার কার আইডি মামা? আমাদের লিস্টে তো নাই! 😅',
      privacyNote: 'Student IDs are never displayed publicly and are verified securely via SHA-256.',
      devHintTitle: 'Local Development Mode',
      devHintBody: 'Running in local session mode without Supabase. Only the 6 authorized crew IDs are accepted.',
    },
    common: {
      offlineBanner: 'You are offline. Itinerary and checklist remain readable; financial edits require an internet connection.',
      devBanner: 'Development Mode (Local Browser Storage) — Connect Supabase for production persistence & RLS.',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      add: 'Add',
      close: 'Close',
      search: 'Search...',
      loading: 'Loading...',
      logout: 'Log Out',
      adminMode: 'Admin Unlocked',
      unlockAdmin: 'Admin Login',
      soundOn: 'SFX On',
      soundOff: 'SFX Muted',
      musicOn: 'Music On',
      musicOff: 'Music Off',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
      systemMode: 'System',
      days: 'Days',
      hours: 'Hours',
      minutes: 'Mins',
      seconds: 'Secs',
      tourDayLive: 'Tour Day is Here!',
      cashMethod: 'Cash',
      exportCsv: 'Export CSV',
      printReport: 'Print / PDF',
    },
    hero: {
      dateLabel: 'Tour Date',
      routeLabel: 'Route Overview',
      budgetLabel: 'Estimated Budget',
      perPerson: 'per person',
      countdownTitle: 'Countdown to Departure',
      scrollHint: 'Scroll to explore',
      exploreMoney: 'Open Money Ledger',
      explorePlan: 'Itinerary & Map',
    },
    money: {
      title: 'Tour Fund & Expense Ledger',
      subtitle: 'Transparent cash accounting with exact per-person allocations and audit history',
      remainingCash: 'Remaining Cash Fund',
      totalCollected: 'Total Collected',
      totalSpent: 'Group Cash Spent',
      personalPaid: 'Paid Personally',
      unreimbursed: 'Owed to Payers',
      expenseCount: 'Recorded Expenses',
      collectionProgress: 'Collection Progress',
      memberBalances: 'Individual Member Balances',
      underpaidAlert: 'Pending Contributions',
      categoryChart: 'Spending by Category',
      timelineChart: 'Spending Timeline',
      collectedVsSpent: 'Collected vs Spent',
      ledger: 'Full Transaction Ledger',
      auditLog: 'Financial Audit Log',
      addContribution: 'Record Contribution',
      addExpense: 'Add Expense',
      allCategories: 'All Categories',
      formulaNote: 'Member Balance = Contributions − Allocations | Group Cash = Contributions − Group Cash Expenses',
      reconciledOk: 'Ledger reconciled 100% — zero discrepancies',
      discrepancyAlert: 'Warning: Accounting discrepancy detected',
      budgetWarning: 'Budget Warning: Approaching estimated tour budget!',
      adminOnlyNotice: 'Only Treasurer/Admin (Shahriar) can record, edit, or correct financial entries.',
    },
  },
} as const;
