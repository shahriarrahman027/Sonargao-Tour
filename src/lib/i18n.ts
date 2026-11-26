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
      photos: 'ছবি',
      social: 'ভোট ও নোট',
      fun: 'ফান জোন',
      checklist: 'চেকলিস্ট',
      report: 'রিপোর্ট',
      admin: 'অ্যাডমিন',
    },
    gate: {
      badge: 'প্রাইভেট ট্যুর হেডকোয়ার্টার্স • ৬ বন্ধু',
      subtitle: 'প্রবেশ করতে আপনার অনুমোদিত DIU স্টুডেন্ট আইডি লিখুন।',
      studentIdLabel: 'DIU স্টুডেন্ট আইডি',
      studentIdPlaceholder: 'যেমন: 221-15-XXXX',
      passcodeLabel: 'গ্রুপ পাসকোড',
      passcodePlaceholder: 'গ্রুপ পাসকোড লিখুন',
      enterBtn: 'ট্যুর পোর্টালে প্রবেশ করুন',
      verifying: 'যাচাই করা হচ্ছে...',
      privacyNote: 'স্টুডেন্ট আইডি কখনো পাবলিকলি দেখানো হয় না এবং সেশন সুরক্ষিতভাবে যাচাই করা হয়।',
      devHintTitle: 'ডেভেলপমেন্ট মোড সক্রিয়',
      devHintBody: 'Supabase সংযুক্ত না থাকায় লোকাল ব্রাউজার স্টোরেজ মোড চলছে। টেস্ট আইডি .env বা নিচের নমুনা থেকে দেখুন:',
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
      photos: 'Photos',
      social: 'Polls & Notes',
      fun: 'Fun Zone',
      checklist: 'Checklist',
      report: 'Report',
      admin: 'Admin',
    },
    gate: {
      badge: 'PRIVATE TOUR HEADQUARTERS • 6 FRIENDS',
      subtitle: 'Enter your authorized DIU Student ID to access our private tour hub.',
      studentIdLabel: 'DIU Student ID',
      studentIdPlaceholder: 'e.g. 221-15-XXXX',
      passcodeLabel: 'Group Passcode',
      passcodePlaceholder: 'Enter shared group passcode',
      enterBtn: 'Enter Tour Portal',
      verifying: 'Verifying access...',
      privacyNote: 'Student IDs are never displayed publicly. Sessions are verified securely.',
      devHintTitle: 'Development Mode Active',
      devHintBody: 'Supabase credentials are not configured yet, so local browser storage mode is active.',
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
