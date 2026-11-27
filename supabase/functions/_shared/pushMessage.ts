// Shared server-side financial balance calculator and personalized Bangla
// lock-screen Web Push payload generator (keeps calculations 100% authoritative).

export interface MemberRow {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string;
  role: string;
  is_active: boolean;
}

export interface ContributionRow {
  id: string;
  member_id: string;
  amount: number;
  payment_method: string;
  is_correction: boolean;
  created_by: string;
  created_at: string;
}

export interface AllocationRow {
  member_id: string;
  allocated_amount: number;
}

export interface EditHistoryRow {
  id: string;
  edited_by: string;
  reason: string;
  previous_snapshot?: Record<string, unknown>;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  title: string;
  category: string;
  total_amount: number;
  payer_member_id?: string | null;
  funding_source: 'group_cash' | 'personal_payer';
  is_reimbursed: boolean;
  voided_by_correction: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  allocations: AllocationRow[];
  edit_history?: EditHistoryRow[];
}

export interface PushNotificationContent {
  title: string;
  body: string;
  tag: string;
  eventKey: string;
  tab: string;
  url: string;
  kind: string;
  icon: string;
  badge: string;
  timestamp: number;
}

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

const CATEGORY_BN: Record<string, string> = {
  Transport: 'যাতায়াত',
  Food: 'খাবার',
  Tickets: 'টিকিট',
  Shopping: 'কেনাকাটা',
  Accommodation: 'থাকা/বিশ্রাম',
  Miscellaneous: 'বিবিধ',
  Other: 'অন্যান্য',
};

function roundMoney(v: number): number {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100;
}

function toBanglaDigits(v: string | number): string {
  return String(v).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

export function formatBanglaTaka(amount: number): string {
  const abs = roundMoney(Math.abs(amount));
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${toBanglaDigits(formatted)} টাকা`;
}

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickVariant(variants: string[], seed: string): string {
  return variants[stableHash(seed) % variants.length] || '';
}

function categoryEmoji(cat: string): string {
  switch (cat) {
    case 'Food':
      return '🍵';
    case 'Tickets':
      return '🎟️';
    case 'Transport':
      return '🚌';
    case 'Shopping':
      return '🛍️';
    case 'Accommodation':
      return '⛺';
    default:
      return '💸';
  }
}

export function computeServerBalances(
  contributions: ContributionRow[],
  expenses: ExpenseRow[],
): {
  remainingGroupCash: number;
  memberBalances: Map<string, number>;
  personalUnreimbursedByPayer: Map<string, number>;
} {
  const active = expenses.filter((e) => !e.voided_by_correction);
  const totalCollected = roundMoney(contributions.reduce((s, c) => s + Number(c.amount), 0));
  const groupCashSpent = roundMoney(
    active.filter((e) => e.funding_source === 'group_cash').reduce((s, e) => s + Number(e.total_amount), 0),
  );
  const personalReimbursed = roundMoney(
    active
      .filter((e) => e.funding_source === 'personal_payer' && e.is_reimbursed)
      .reduce((s, e) => s + Number(e.total_amount), 0),
  );
  const remainingGroupCash = roundMoney(totalCollected - groupCashSpent - personalReimbursed);

  const memberContribs = new Map<string, number>();
  for (const c of contributions) {
    memberContribs.set(c.member_id, roundMoney((memberContribs.get(c.member_id) ?? 0) + Number(c.amount)));
  }

  const memberAllocs = new Map<string, number>();
  const personalUnreimbursedByPayer = new Map<string, number>();
  for (const e of active) {
    for (const a of e.allocations) {
      memberAllocs.set(
        a.member_id,
        roundMoney((memberAllocs.get(a.member_id) ?? 0) + Number(a.allocated_amount)),
      );
    }
    if (e.funding_source === 'personal_payer' && !e.is_reimbursed && e.payer_member_id) {
      personalUnreimbursedByPayer.set(
        e.payer_member_id,
        roundMoney((personalUnreimbursedByPayer.get(e.payer_member_id) ?? 0) + Number(e.total_amount)),
      );
    }
  }

  const memberBalances = new Map<string, number>();
  const allIds = new Set([...memberContribs.keys(), ...memberAllocs.keys()]);
  for (const id of allIds) {
    memberBalances.set(
      id,
      roundMoney((memberContribs.get(id) ?? 0) - (memberAllocs.get(id) ?? 0)),
    );
  }

  return { remainingGroupCash, memberBalances, personalUnreimbursedByPayer };
}

function cashPhrase(val: number, prefix: string): string {
  const txt = formatBanglaTaka(val);
  return val >= 0 ? `${prefix} এখনো ${txt} বাকি!` : `${prefix} ${txt} ঘাটতি!`;
}

export function buildPushNotificationForRecipient(params: {
  kind: string;
  eventKey: string;
  recipientMember: MemberRow;
  members: MemberRow[];
  contributions: ContributionRow[];
  expenses: ExpenseRow[];
  targetContribution?: ContributionRow | null;
  targetExpense?: ExpenseRow | null;
}): PushNotificationContent {
  const {
    kind,
    eventKey,
    recipientMember,
    members,
    contributions,
    expenses,
    targetContribution,
    targetExpense,
  } = params;

  const balances = computeServerBalances(contributions, expenses);
  const groupCash = balances.remainingGroupCash;
  const recipientBal = balances.memberBalances.get(recipientMember.id) ?? 0;
  const url = `/?tab=money&notif=${encodeURIComponent(eventKey)}`;

  if (kind === 'test') {
    return {
      title: '🔔 পুশ নোটিফিকেশন চালু!',
      body: `${recipientMember.name_bn} ভাই, আপনার ডিভাইসে ব্যাকগ্রাউন্ড ট্যুর এলার্ট সঠিকভাবে কাজ করছে! ফান্ডে এখনো ${formatBanglaTaka(groupCash)}।`,
      tag: eventKey,
      eventKey,
      tab: 'home',
      url: '/?tab=home',
      kind: 'test',
      icon: '/images/logo.jpg',
      badge: '/icons/icon.svg',
      timestamp: Date.now(),
    };
  }

  if (targetContribution) {
    const targetMember = members.find((m) => m.id === targetContribution.member_id);
    const targetName = targetMember?.name_bn || 'বন্ধু';
    const amtText = formatBanglaTaka(targetContribution.amount);
    const targetBal = balances.memberBalances.get(targetContribution.member_id) ?? 0;

    if (targetContribution.amount < 0) {
      return {
        title: `🔄 ${targetName} • টাকা ফেরত`,
        body: pickVariant(
          [
            `${targetName}-এর পকেটে ${amtText} ফেরত/সমন্বয়! ${cashPhrase(groupCash, 'ফান্ডে')}`,
            `রিফান্ড অ্যালার্ট! ${targetName} ${amtText} ফেরত পেয়েছেন — ${cashPhrase(targetBal, 'ব্যালেন্স')}`,
          ],
          eventKey,
        ),
        tag: eventKey,
        eventKey,
        tab: 'money',
        url,
        kind: 'contribution_refund',
        icon: '/images/logo.jpg',
        badge: '/icons/icon.svg',
        timestamp: Date.now(),
      };
    }

    return {
      title: targetContribution.is_correction
        ? `📝 ${targetName} • হিসাব সমন্বয়`
        : `💰 ${targetName} টাকা জমা দিয়েছেন!`,
      body: targetContribution.is_correction
        ? `${targetName}-এর খাতায় ${amtText} সমন্বয় হয়েছে! ${cashPhrase(groupCash, 'ট্যুর ফান্ডে')}`
        : pickVariant(
            [
              `${targetName} ভাই ${amtText} জমা দিয়েছেন! ট্যুর ফান্ডে প্রাণ ফিরে আসছে (${formatBanglaTaka(groupCash)})!`,
              `পকেটে টাকা এসেছে! ${targetName} ${amtText} দেওয়ায় আবার খরচ করার লাইসেন্স পেলেন — ফান্ড এখন ${formatBanglaTaka(groupCash)}!`,
            ],
            eventKey,
          ),
      tag: eventKey,
      eventKey,
      tab: 'money',
      url,
      kind: targetContribution.is_correction ? 'contribution_refund' : 'contribution_added',
      icon: '/images/logo.jpg',
      badge: '/icons/icon.svg',
      timestamp: Date.now(),
    };
  }

  if (targetExpense) {
    const emoji = categoryEmoji(targetExpense.category);
    const catBn = CATEGORY_BN[targetExpense.category] || targetExpense.category;
    const amtText = formatBanglaTaka(targetExpense.total_amount);
    const titleShort = targetExpense.title.trim() || catBn;
    const actor = members.find((m) => m.id === (targetExpense.edit_history?.[0]?.edited_by || targetExpense.created_by));
    const actorName = actor?.name_bn || 'শাহরিয়ার';

    if (targetExpense.voided_by_correction || kind === 'expense_voided') {
      return {
        title: `♻️ খরচ বাতিল: ${titleShort}`,
        body: pickVariant(
          [
            `'${titleShort}' (${amtText}) বাতিল হয়ে টাকা ফান্ডে ফেরত! ${cashPhrase(groupCash, 'এখনো')}`,
            `যাদুর মতো ${amtText} ফান্ডে ফিরে এলো! ${cashPhrase(groupCash, 'গ্রুপ ক্যাশে')}`,
          ],
          eventKey,
        ),
        tag: eventKey,
        eventKey,
        tab: 'money',
        url,
        kind: 'expense_voided',
        icon: '/images/logo.jpg',
        badge: '/icons/icon.svg',
        timestamp: Date.now(),
      };
    }

    if (kind === 'expense_reimbursed') {
      const payer = members.find((m) => m.id === targetExpense.payer_member_id);
      const payerName = payer?.name_bn || actorName;
      return {
        title: `🎊 ${payerName} • রিফান্ড সম্পন্ন`,
        body: `পকেটে ${amtText} ফেরত এসেছে! '${titleShort}'-এর পাওনা মিটিয়ে ${cashPhrase(groupCash, 'ফান্ডে')}`,
        tag: eventKey,
        eventKey,
        tab: 'money',
        url,
        kind: 'expense_reimbursed',
        icon: '/images/logo.jpg',
        badge: '/icons/icon.svg',
        timestamp: Date.now(),
      };
    }

    if (kind === 'expense_updated') {
      return {
        title: `✏️ আপডেট: ${titleShort}`,
        body: `${actorName} '${titleShort}' এডিট করে ${amtText} করেছেন! ${cashPhrase(groupCash, 'ফান্ডে')}`,
        tag: eventKey,
        eventKey,
        tab: 'money',
        url,
        kind: 'expense_updated',
        icon: '/images/logo.jpg',
        badge: '/icons/icon.svg',
        timestamp: Date.now(),
      };
    }

    if (targetExpense.funding_source === 'personal_payer') {
      const payer = members.find((m) => m.id === targetExpense.payer_member_id);
      const payerName = payer?.name_bn || actorName;
      const owed = balances.personalUnreimbursedByPayer.get(payer?.id || '') ?? targetExpense.total_amount;
      return {
        title: `💳 ${payerName} পকেট থেকে দিয়েছেন`,
        body: `${payerName} '${titleShort}'-এ ${amtText} দিয়েছেন! তার পাওনা ${formatBanglaTaka(owed)}, ফান্ড ${formatBanglaTaka(groupCash)} অক্ষত!`,
        tag: eventKey,
        eventKey,
        tab: 'money',
        url,
        kind: 'expense_created',
        icon: '/images/logo.jpg',
        badge: '/icons/icon.svg',
        timestamp: Date.now(),
      };
    }

    const singleAlloc =
      targetExpense.allocations.length === 1 ? targetExpense.allocations[0] : null;
    const singleTarget = singleAlloc
      ? members.find((m) => m.id === singleAlloc.member_id)
      : undefined;

    if (singleTarget) {
      const sBal = balances.memberBalances.get(singleTarget.id) ?? 0;
      return {
        title: `${emoji} ${singleTarget.name_bn} • ${catBn}`,
        body: pickVariant(
          [
            `${singleTarget.name_bn}-এর পকেট থেকে টাকা উধাও! ${amtText} খরচ (${titleShort}), ${cashPhrase(sBal, 'এখনো')}`,
            `'${titleShort}' করতে গিয়ে ${singleTarget.name_bn}-এর ${amtText} শেষ! ${cashPhrase(sBal, 'ব্যালেন্স')}`,
          ],
          eventKey,
        ),
        tag: eventKey,
        eventKey,
        tab: 'money',
        url,
        kind: 'expense_created',
        icon: '/images/logo.jpg',
        badge: '/icons/icon.svg',
        timestamp: Date.now(),
      };
    }

    const viewerAlloc = targetExpense.allocations.find(
      (a) => a.member_id === recipientMember.id,
    );
    const tailText = viewerAlloc
      ? `আপনার ভাগ ${formatBanglaTaka(viewerAlloc.allocated_amount)}, আপনার ব্যালেন্স ${formatBanglaTaka(recipientBal)}!`
      : cashPhrase(groupCash, 'ফান্ডে');

    return {
      title: `${emoji} ${titleShort} (${amtText})`,
      body: pickVariant(
        [
          `${titleShort} (${catBn})-এ ${amtText} শেষ! ${tailText}`,
          `${actorName}-এর ${amtText} খরচের গতি দেখে মনে হচ্ছে পকেট দ্রুত খালি হচ্ছে! ${tailText}`,
        ],
        eventKey,
      ),
      tag: eventKey,
      eventKey,
      tab: 'money',
      url,
      kind: 'expense_created',
      icon: '/images/logo.jpg',
      badge: '/icons/icon.svg',
      timestamp: Date.now(),
    };
  }

  return {
    title: '💸 ট্যুর ফান্ড আপডেট',
    body: `হিসাব আপডেট হয়েছে! ${cashPhrase(groupCash, 'ট্যুর ফান্ডে')}`,
    tag: eventKey,
    eventKey,
    tab: 'money',
    url,
    kind,
    icon: '/images/logo.jpg',
    badge: '/icons/icon.svg',
    timestamp: Date.now(),
  };
}
