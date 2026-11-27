import { computeFinancialSummary, roundMoney } from './accounting';
import { CATEGORY_LABELS, formatBDT, toBanglaDigits } from './i18n';
import type {
  Contribution,
  Expense,
  Member,
  MoneyNotification,
  MoneyNotificationKind,
  TourSettings,
} from '../types/tour';

export interface NotificationBaseline {
  contributionIds: string[];
  expenseIds: string[];
  editHistoryIds: string[];
  voidedExpenseIds: string[];
  reimbursedExpenseIds: string[];
}

export interface FinancialStateSlice {
  settings: TourSettings;
  members: Member[];
  contributions: Contribution[];
  expenses: Expense[];
}

const MAX_STORED_NOTIFICATIONS = 50;
const NOTIF_STORAGE_PREFIX = 'ek_diner_tour_notifs_v1_';
const BASELINE_STORAGE_PREFIX = 'ek_diner_tour_notif_baseline_v1_';
const NOTIF_SOUND_KEY = 'ek_diner_tour_notif_sound_v1';

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickVariant(variants: string[], seed: string): string {
  if (variants.length === 0) return '';
  return variants[stableHash(seed) % variants.length];
}

export function formatBanglaTaka(amount: number): string {
  const rounded = roundMoney(Math.abs(amount));
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `${toBanglaDigits(formatted)} টাকা`;
}

function balanceStatusBn(amount: number, subjectPrefix: string): string {
  const absText = formatBanglaTaka(Math.abs(amount));
  if (amount >= 0) {
    return `${subjectPrefix} এখনো ${absText} অবশিষ্ট`;
  }
  return `${subjectPrefix} ${absText} ঘাটতি চলছে`;
}

function findMember(members: Member[], id?: string | null): Member | undefined {
  if (!id) return undefined;
  return members.find((m) => m.id === id);
}

function categoryEmoji(cat: Expense['category']): string {
  switch (cat) {
    case 'Food':
      return '🍲';
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

function formatAffectedLabel(
  members: Member[],
  memberIds: string[],
): { bn: string; en: string } {
  const uniqueIds = Array.from(new Set(memberIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { bn: 'গ্রুপ ফান্ড', en: 'Group Fund' };
  }
  if (members.length > 0 && uniqueIds.length >= members.length) {
    return {
      bn: `সবাই (${toBanglaDigits(uniqueIds.length)} জন)`,
      en: `Everyone (${uniqueIds.length})`,
    };
  }
  const namesBn = uniqueIds
    .map((id) => findMember(members, id)?.name_bn)
    .filter(Boolean) as string[];
  const namesEn = uniqueIds
    .map((id) => findMember(members, id)?.name_en)
    .filter(Boolean) as string[];

  if (namesBn.length <= 2) {
    return {
      bn: namesBn.join(', ') || 'টিম সদস্য',
      en: namesEn.join(', ') || 'Crew Member',
    };
  }
  return {
    bn: `${namesBn[0]} ও আরও ${toBanglaDigits(namesBn.length - 1)} জন`,
    en: `${namesEn[0]} +${namesEn.length - 1} others`,
  };
}

export function createNotificationBaseline(state: FinancialStateSlice): NotificationBaseline {
  return {
    contributionIds: state.contributions.map((c) => c.id),
    expenseIds: state.expenses.map((e) => e.id),
    editHistoryIds: state.expenses.flatMap((e) => (e.edit_history || []).map((h) => h.id)),
    voidedExpenseIds: state.expenses.filter((e) => e.voided_by_correction).map((e) => e.id),
    reimbursedExpenseIds: state.expenses.filter((e) => e.is_reimbursed).map((e) => e.id),
  };
}

function buildContributionNotification(
  contrib: Contribution,
  state: FinancialStateSlice,
  finance: ReturnType<typeof computeFinancialSummary>,
  viewerMemberId?: string | null,
  read = false,
): MoneyNotification {
  const eventKey = `contrib:${contrib.id}`;
  const target = findMember(state.members, contrib.member_id);
  const actor = findMember(state.members, contrib.created_by);
  const targetNameBn = target?.name_bn || 'বন্ধু';
  const targetNameEn = target?.name_en || 'Crew Member';
  const actorNameBn = actor?.name_bn || 'ট্রেজারার';
  const actorNameEn = actor?.name_en || 'Treasurer';

  const targetSummary = finance.memberSummaries.find((s) => s.member.id === contrib.member_id);
  const viewerSummary = viewerMemberId
    ? finance.memberSummaries.find((s) => s.member.id === viewerMemberId)
    : undefined;

  const targetBalance = targetSummary?.balance ?? 0;
  const groupCash = finance.remainingGroupCash;
  const absAmountText = formatBanglaTaka(contrib.amount);
  const groupCashText = balanceStatusBn(groupCash, 'ট্যুর ফান্ডে');
  const targetBalText = balanceStatusBn(targetBalance, `${targetNameBn}-এর হিসাবে`);

  const isRefund = contrib.amount < 0 || contrib.is_correction;
  const kind: MoneyNotificationKind = isRefund ? 'contribution_refund' : 'contribution_added';
  const emoji = contrib.amount < 0 ? '🔄' : isRefund ? '📝' : '💰';

  let message_bn: string;
  if (contrib.amount < 0) {
    message_bn = pickVariant(
      [
        `🔄 ${targetNameBn}-এর পকেটে ${absAmountText} ফেরত/সমন্বয় হয়েছে! ${targetBalText} (ফান্ডে ${formatBanglaTaka(Math.max(0, groupCash))})।`,
        `🪙 রিফান্ড অ্যালার্ট! ${targetNameBn} ${absAmountText} ফেরত পেয়েছেন — ${groupCashText}!`,
        `💸 ${actorNameBn} ${targetNameBn}-এর নামে ${absAmountText} রিফান্ড সমন্বয় করেছেন! ট্যুর ক্যাশ এখন ${formatBanglaTaka(groupCash)}।`,
        `✨ ${targetNameBn}-এর পকেটে ${absAmountText} ফিরে এলো! হিসাব আপডেট: গ্রুপ ক্যাশ ${formatBanglaTaka(groupCash)}।`,
      ],
      eventKey,
    );
  } else if (contrib.is_correction) {
    message_bn = pickVariant(
      [
        `📝 ${targetNameBn}-এর হিসাবে ${absAmountText} সমন্বয় যোগ হয়েছে! ${targetBalText}।`,
        `⚖️ ${actorNameBn} ${targetNameBn}-এর জমার খাতা ঠিক করেছেন (+${absAmountText})! গ্রুপ ক্যাশ এখন ${formatBanglaTaka(groupCash)}।`,
        `✨ জমার সমন্বয় সম্পন্ন! ${targetNameBn}-এর খাতায় ${absAmountText} যুক্ত হয়ে ফান্ডে এখন ${formatBanglaTaka(groupCash)}।`,
        `🔧 ${targetNameBn}-এর ফান্ড অ্যাডজাস্টমেন্ট +${absAmountText}! ${groupCashText}।`,
      ],
      eventKey,
    );
  } else {
    message_bn = pickVariant(
      [
        `💰 ${targetNameBn} ভাই ${absAmountText} জমা দিয়েছেন! ট্যুর ফান্ডে প্রাণ ফিরে আসছে — ফান্ডে এখন ${formatBanglaTaka(groupCash)}!`,
        `🎉 পকেটে টাকা এসেছে! ${targetNameBn} ${absAmountText} জমা দেওয়ায় আবার খরচ করার লাইসেন্স পেয়ে গেলেন — মোট ক্যাশ ${formatBanglaTaka(groupCash)}!`,
        `🏦 টিং-টং! ${targetNameBn}-এর ${absAmountText} জমার সাথে ফান্ড চাঙ্গা — ${groupCashText}।`,
        `⚡ বাহ ${targetNameBn}! ${absAmountText} জমা হয়েছে — ${targetBalText} (গ্রুপ ক্যাশ: ${formatBanglaTaka(groupCash)})।`,
      ],
      eventKey,
    );
  }

  return {
    eventKey,
    id: eventKey,
    kind,
    emoji,
    title_bn:
      contrib.amount < 0
        ? 'টাকা ফেরত / রিফান্ড'
        : isRefund
          ? 'জমার সমন্বয়'
          : 'ফান্ডে নতুন জমা',
    title_en:
      contrib.amount < 0
        ? 'Contribution Refund / Offset'
        : isRefund
          ? 'Contribution Adjustment'
          : 'New Fund Contribution',
    message_bn,
    actorMemberId: contrib.created_by,
    actorNameBn,
    actorNameEn,
    affectedMemberIds: [contrib.member_id],
    affectedLabelBn: targetNameBn,
    affectedLabelEn: targetNameEn,
    amount: contrib.amount,
    fundingSource: 'group_cash',
    relevantBalanceLabelBn: `${targetNameBn}: ${formatBDT(targetBalance, 'bn')} • ফান্ড: ${formatBDT(groupCash, 'bn')}`,
    relevantBalanceLabelEn: `${targetNameEn}: ${formatBDT(targetBalance, 'en')} • Fund: ${formatBDT(groupCash, 'en')}`,
    remainingGroupCash: groupCash,
    viewerBalance: viewerSummary?.balance ?? null,
    createdAt: contrib.created_at || contrib.contributed_at,
    read,
    dismissed: false,
  };
}

function buildExpenseNotification(
  exp: Expense,
  kind: 'expense_created' | 'expense_updated' | 'expense_voided' | 'expense_reimbursed',
  eventKey: string,
  state: FinancialStateSlice,
  finance: ReturnType<typeof computeFinancialSummary>,
  options?: {
    actorMemberId?: string | null;
    reason?: string;
    occurredAt?: string;
    viewerMemberId?: string | null;
    read?: boolean;
  },
): MoneyNotification {
  const actorId = options?.actorMemberId ?? exp.created_by;
  const actor = findMember(state.members, actorId) ?? findMember(state.members, exp.created_by);
  const actorNameBn = actor?.name_bn || 'ট্রেজারার';
  const actorNameEn = actor?.name_en || 'Treasurer';

  const affectedIds = exp.allocations.map((a) => a.member_id);
  const affectedLabel = formatAffectedLabel(state.members, affectedIds);
  const payer = findMember(state.members, exp.payer_member_id);
  const payerNameBn = payer?.name_bn || actorNameBn;
  const payerNameEn = payer?.name_en || actorNameEn;

  const groupCash = finance.remainingGroupCash;
  const viewerId = options?.viewerMemberId;
  const viewerSummary = viewerId
    ? finance.memberSummaries.find((s) => s.member.id === viewerId)
    : undefined;
  const viewerAlloc = viewerId
    ? exp.allocations.find((a) => a.member_id === viewerId)
    : undefined;

  const singleTargetId = affectedIds.length === 1 ? affectedIds[0] : null;
  const singleTarget = singleTargetId ? findMember(state.members, singleTargetId) : undefined;
  const singleSummary = singleTargetId
    ? finance.memberSummaries.find((s) => s.member.id === singleTargetId)
    : undefined;

  const catBn = CATEGORY_LABELS[exp.category]?.bn || exp.category;
  const amountText = formatBanglaTaka(exp.total_amount);
  const groupCashPhrase = balanceStatusBn(groupCash, 'ফান্ডে');
  const titleClean = exp.title.trim() || catBn;

  let emoji = categoryEmoji(exp.category);
  let title_bn = 'নতুন খরচ রেকর্ড';
  let title_en = 'New Expense Recorded';
  let message_bn: string;

  if (kind === 'expense_voided') {
    emoji = '♻️';
    title_bn = 'খরচ বাতিল / টাকা ফেরত';
    title_en = 'Expense Voided / Refunded';
    message_bn = pickVariant(
      [
        `♻️ '${titleClean}' (${amountText})-এর খরচটি বাতিল করা হয়েছে! টাকা ফিরে এসে গ্রুপ ক্যাশ এখন ${formatBanglaTaka(groupCash)}।`,
        `🪄 যাদুর মতো '${titleClean}'-এর ${amountText} ফান্ডে ফেরত! ${groupCashPhrase}।`,
        `🚫 ${actorNameBn} '${titleClean}' (${amountText}) বাতিল করেছেন — পকেটে স্বস্তি ফিরে ফান্ডে এখন ${formatBanglaTaka(groupCash)}!`,
        `✅ হিসাব রিভার্স! '${titleClean}' বাদ হওয়ায় ${amountText} বাঁচলো — ফান্ড ব্যালেন্স এখন ${formatBanglaTaka(groupCash)}।`,
      ],
      eventKey,
    );
  } else if (kind === 'expense_reimbursed') {
    emoji = '🎊';
    title_bn = 'ব্যক্তিগত খরচ রিফান্ড';
    title_en = 'Personal Expense Reimbursed';
    message_bn = pickVariant(
      [
        `🎊 পকেটে টাকা এসেছে! '${titleClean}'-এর ${amountText} ${payerNameBn} ফেরত পেয়েছেন — আবার খরচ করার লাইসেন্স পেলেন! (${groupCashPhrase})`,
        `💸 রিফান্ড সম্পন্ন! ${payerNameBn}-কে '${titleClean}' বাবদ ${amountText} বুঝিয়ে দেওয়া হয়েছে — গ্রুপ ক্যাশ এখনো ${formatBanglaTaka(groupCash)}।`,
        `🤝 পাওনা মিটে গেছে! ${payerNameBn}-এর পকেটে ${amountText} ফেরত এসেছে — ${groupCashPhrase}।`,
        `🏦 '${titleClean}'-এর ব্যক্তিগত বিল ${amountText} ক্যাশ ফান্ড থেকে পরিশোধ! ফান্ডে বাকি ${formatBanglaTaka(groupCash)}।`,
      ],
      eventKey,
    );
  } else if (kind === 'expense_updated') {
    emoji = '✏️';
    title_bn = 'খরচের হিসাব আপডেট';
    title_en = 'Expense Updated';
    const reasonBit = options?.reason ? ` (${options.reason})` : '';
    message_bn = pickVariant(
      [
        `✏️ ${actorNameBn} '${titleClean}' খরচটি আপডেট করে ${amountText} করেছেন${reasonBit}! ${groupCashPhrase}।`,
        `📝 হিসাব সংশোধন! '${titleClean}' (${catBn}) এখন ${amountText} — আপডেটের পর গ্রুপ ক্যাশ ${formatBanglaTaka(groupCash)}।`,
        `🔍 ${actorNameBn} '${titleClean}'-এর হিসাব ঠিক করেছেন (${amountText})! ${groupCashPhrase}।`,
        `📊 '${titleClean}' এডিট হয়ে ${amountText} দাঁড়িয়েছে${reasonBit} — ক্যাশ ফান্ডে বাকি ${formatBanglaTaka(groupCash)}।`,
      ],
      eventKey,
    );
  } else if (exp.funding_source === 'personal_payer') {
    emoji = '💳';
    title_bn = 'ব্যক্তিগত পকেট থেকে খরচ';
    title_en = 'Personal Payer Expense';
    const payerSummary = finance.memberSummaries.find((s) => s.member.id === exp.payer_member_id);
    const owedText = formatBanglaTaka(payerSummary?.personalPaidUnreimbursed ?? exp.total_amount);
    message_bn = pickVariant(
      [
        `💳 বাহ ${payerNameBn}! নিজের পকেট থেকে '${titleClean}'-এর ${amountText} দিয়েছেন — ফান্ডে তার পাওনা এখন ${owedText} (গ্রুপ ক্যাশ ${formatBanglaTaka(groupCash)} সুরক্ষিত)।`,
        `🦸 ${payerNameBn} আপাতত ${amountText} পকেট থেকে মিটিয়ে '${titleClean}' সামলেছেন! গ্রুপ ফান্ডে এখনো ${formatBanglaTaka(groupCash)} অবশিষ্ট।`,
        `🤝 ব্যক্তিগত পেমেন্ট! '${titleClean}' (${catBn})-এ ${payerNameBn}-এর ${amountText} খরচ হলো — ফান্ড থেকে পরে ফেরত পাবেন ${owedText}।`,
        `💼 ${payerNameBn}-এর পকেট হালকা হলো ${amountText}! ট্যুর ফান্ডের ঝুলিতে এখনো ${formatBanglaTaka(groupCash)} অক্ষত।`,
      ],
      eventKey,
    );
  } else if (singleTarget && singleSummary) {
    const singleBalText = balanceStatusBn(singleSummary.balance, 'এখনো');
    message_bn = pickVariant(
      [
        `${emoji} ${singleTarget.name_bn}-এর পকেট থেকে ${amountText} উধাও! '${titleClean}' (${catBn}) শেষে ${singleBalText}।`,
        `🥤 '${titleClean}' করতে গিয়ে ${singleTarget.name_bn}-এর ${amountText} শেষ! ব্যক্তিগত ব্যালেন্স ${formatBanglaTaka(singleSummary.balance)} (ফান্ড: ${formatBanglaTaka(groupCash)})।`,
        `🧾 ${singleTarget.name_bn}-এর খাতায় ${amountText}-এর '${titleClean}' যোগ হলো! ${balanceStatusBn(singleSummary.balance, 'হিসাবে')}।`,
        `⚡ সাবধান ${singleTarget.name_bn}! '${titleClean}'-এ ${amountText} খরচ হয়ে গেল — ${balanceStatusBn(singleSummary.balance, 'ব্যালেন্সে')}!`,
      ],
      eventKey,
    );
  } else {
    const viewerBal = viewerSummary?.balance;
    const viewerNote =
      viewerSummary && viewerAlloc && viewerBal !== undefined
        ? `আপনার ভাগ ${formatBanglaTaka(viewerAlloc.allocated_amount)}, আপনার ব্যালেন্স ${formatBanglaTaka(viewerBal)}`
        : groupCashPhrase;

    const categoryVariants: string[] = [
      `${emoji} '${titleClean}' (${catBn})-এ ${amountText} শেষ! ${groupCashPhrase}, হিসাব করে চলুন!`,
      `💸 ${actorNameBn}-এর '${titleClean}'-এ ${amountText} খরচের গতি দেখে মনে হচ্ছে পকেট দ্রুত খালি হচ্ছে! ${viewerNote}।`,
      `🧾 টিং-টং! ${actorNameBn} '${titleClean}' বাবদ ${amountText} লিখে ফেললেন — ${groupCashPhrase}।`,
      `🏃‍♂️ ফান্ড থেকে ${amountText} উধাও! '${titleClean}' (${catBn}) শেষে ${viewerNote}।`,
    ];

    if (exp.category === 'Tickets') {
      categoryVariants.push(
        `🎟️ '${titleClean}'-এর টিকিট কাটতে গিয়ে ${amountText} উধাও! ${viewerNote}।`,
      );
    } else if (exp.category === 'Food') {
      categoryVariants.push(
        `🍲 পেটপূজায় ${amountText} শেষ ('${titleClean}')! ${groupCashPhrase} — আর কত খাওয়াবেন মামা!`,
      );
    } else if (exp.category === 'Transport') {
      categoryVariants.push(
        `🚌 '${titleClean}'-এর ভাড়ায় ${amountText} চলে গেল! ${groupCashPhrase} — চাকা থামবে না!`,
      );
    }

    if (finance.budgetWarningActive) {
      categoryVariants.push(
        `⚠️ ${actorNameBn}-এর টাকা খরচের গতি দেখে মনে হচ্ছে ট্যুরের আগেই দেউলিয়া! '${titleClean}' (${amountText}) শেষে ${groupCashPhrase}!`,
      );
    }

    message_bn = pickVariant(categoryVariants, eventKey);
  }

  let relevantBalanceLabelBn = `গ্রুপ ক্যাশ: ${formatBDT(groupCash, 'bn')}`;
  let relevantBalanceLabelEn = `Group Cash: ${formatBDT(groupCash, 'en')}`;

  if (singleTarget && singleSummary) {
    relevantBalanceLabelBn = `${singleTarget.name_bn}: ${formatBDT(singleSummary.balance, 'bn')} • ফান্ড: ${formatBDT(groupCash, 'bn')}`;
    relevantBalanceLabelEn = `${singleTarget.name_en}: ${formatBDT(singleSummary.balance, 'en')} • Fund: ${formatBDT(groupCash, 'en')}`;
  } else if (viewerSummary) {
    const viewerNameBn = viewerSummary.member.name_bn;
    const viewerNameEn = viewerSummary.member.name_en;
    relevantBalanceLabelBn = `${viewerNameBn}: ${formatBDT(viewerSummary.balance, 'bn')} • ফান্ড: ${formatBDT(groupCash, 'bn')}`;
    relevantBalanceLabelEn = `${viewerNameEn}: ${formatBDT(viewerSummary.balance, 'en')} • Fund: ${formatBDT(groupCash, 'en')}`;
  }

  const occurredAt = options?.occurredAt || exp.updated_at || exp.created_at || exp.expense_at;

  return {
    eventKey,
    id: eventKey,
    kind,
    emoji,
    title_bn,
    title_en,
    message_bn,
    actorMemberId: actorId,
    actorNameBn,
    actorNameEn,
    affectedMemberIds:
      exp.funding_source === 'personal_payer' && exp.payer_member_id
        ? Array.from(new Set([exp.payer_member_id, ...affectedIds]))
        : affectedIds,
    affectedLabelBn:
      kind === 'expense_reimbursed'
        ? payerNameBn
        : exp.funding_source === 'personal_payer'
          ? `${payerNameBn} → ${affectedLabel.bn}`
          : affectedLabel.bn,
    affectedLabelEn:
      kind === 'expense_reimbursed'
        ? payerNameEn
        : exp.funding_source === 'personal_payer'
          ? `${payerNameEn} → ${affectedLabel.en}`
          : affectedLabel.en,
    amount: exp.total_amount,
    category: exp.category,
    fundingSource: exp.funding_source,
    relevantBalanceLabelBn,
    relevantBalanceLabelEn,
    remainingGroupCash: groupCash,
    viewerBalance: viewerSummary?.balance ?? null,
    createdAt: occurredAt,
    read: Boolean(options?.read),
    dismissed: false,
  };
}

/**
 * Generates up to `limit` quiet historical notifications on fresh login without
 * emitting unread badges, popup toasts, or alert sounds.
 */
export function buildQuietSeedNotifications(
  state: FinancialStateSlice,
  viewerMemberId?: string | null,
  limit = 6,
): MoneyNotification[] {
  const finance = computeFinancialSummary(
    state.members,
    state.contributions,
    state.expenses,
    state.settings,
  );

  const items: MoneyNotification[] = [];

  for (const c of state.contributions) {
    items.push(buildContributionNotification(c, state, finance, viewerMemberId, true));
  }

  for (const exp of state.expenses) {
    if (exp.voided_by_correction) {
      items.push(
        buildExpenseNotification(exp, 'expense_voided', `expense_void:${exp.id}`, state, finance, {
          actorMemberId: exp.edit_history?.[0]?.edited_by ?? exp.created_by,
          occurredAt: exp.updated_at || exp.created_at,
          viewerMemberId,
          read: true,
        }),
      );
    } else {
      items.push(
        buildExpenseNotification(exp, 'expense_created', `expense:${exp.id}`, state, finance, {
          actorMemberId: exp.created_by,
          occurredAt: exp.created_at || exp.expense_at,
          viewerMemberId,
          read: true,
        }),
      );
    }
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/**
 * Diffs a freshly fetched state against the prior baseline and produces at most ONE
 * notification per unique committed financial transaction (preventing allocation/item duplicates).
 */
export function extractNewMoneyNotifications(params: {
  prevBaseline: NotificationBaseline;
  nextState: FinancialStateSlice;
  viewerMemberId?: string | null;
  seenEventKeys: Set<string>;
}): { notifications: MoneyNotification[]; nextBaseline: NotificationBaseline } {
  const { prevBaseline, nextState, viewerMemberId, seenEventKeys } = params;
  const finance = computeFinancialSummary(
    nextState.members,
    nextState.contributions,
    nextState.expenses,
    nextState.settings,
  );

  const prevContribSet = new Set(prevBaseline.contributionIds);
  const prevExpenseSet = new Set(prevBaseline.expenseIds);
  const prevEditSet = new Set(prevBaseline.editHistoryIds);
  const prevVoidedSet = new Set(prevBaseline.voidedExpenseIds);
  const prevReimbSet = new Set(prevBaseline.reimbursedExpenseIds);

  const emitted: MoneyNotification[] = [];

  // 1. New contributions / refunds / corrections
  for (const contrib of nextState.contributions) {
    if (prevContribSet.has(contrib.id)) continue;
    const notif = buildContributionNotification(contrib, nextState, finance, viewerMemberId, false);
    if (!seenEventKeys.has(notif.eventKey)) {
      emitted.push(notif);
    }
  }

  // 2. New, voided, reimbursed, or edited expenses (at most 1 notification per transaction)
  for (const exp of nextState.expenses) {
    const isNewlyVoided = exp.voided_by_correction && !prevVoidedSet.has(exp.id);
    if (isNewlyVoided) {
      const voidKey = `expense_void:${exp.id}`;
      const latestEdit = (exp.edit_history || [])[0];
      if (!seenEventKeys.has(voidKey)) {
        emitted.push(
          buildExpenseNotification(exp, 'expense_voided', voidKey, nextState, finance, {
            actorMemberId: latestEdit?.edited_by ?? exp.created_by,
            reason: latestEdit?.reason?.replace(/^VOIDED:\s*/i, ''),
            occurredAt: latestEdit?.created_at || exp.updated_at,
            viewerMemberId,
            read: false,
          }),
        );
      }
      continue;
    }

    if (!prevExpenseSet.has(exp.id)) {
      const createKey = `expense:${exp.id}`;
      if (!seenEventKeys.has(createKey)) {
        emitted.push(
          buildExpenseNotification(exp, 'expense_created', createKey, nextState, finance, {
            actorMemberId: exp.created_by,
            occurredAt: exp.created_at || exp.expense_at,
            viewerMemberId,
            read: false,
          }),
        );
      }
      continue;
    }

    // Existing expense: check reimbursement transition or new edit history entries
    const isNewlyReimbursed = exp.is_reimbursed && !prevReimbSet.has(exp.id);
    const unseenEdits = (exp.edit_history || []).filter(
      (h) => !prevEditSet.has(h.id) && !/^VOIDED:/i.test(h.reason || ''),
    );

    if (unseenEdits.length > 0) {
      const latestEdit = unseenEdits[0];
      const editKey = `expense_edit:${latestEdit.id}`;
      if (!seenEventKeys.has(editKey)) {
        emitted.push(
          buildExpenseNotification(
            exp,
            isNewlyReimbursed ? 'expense_reimbursed' : 'expense_updated',
            editKey,
            nextState,
            finance,
            {
              actorMemberId: latestEdit.edited_by,
              reason: latestEdit.reason,
              occurredAt: latestEdit.created_at,
              viewerMemberId,
              read: false,
            },
          ),
        );
      }
    } else if (isNewlyReimbursed) {
      const reimbKey = `expense_reimb:${exp.id}`;
      if (!seenEventKeys.has(reimbKey)) {
        emitted.push(
          buildExpenseNotification(exp, 'expense_reimbursed', reimbKey, nextState, finance, {
            actorMemberId: exp.created_by,
            occurredAt: exp.updated_at,
            viewerMemberId,
            read: false,
          }),
        );
      }
    }
  }

  emitted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    notifications: emitted,
    nextBaseline: createNotificationBaseline(nextState),
  };
}

export function loadStoredNotifications(memberId: string): MoneyNotification[] {
  try {
    const raw = localStorage.getItem(`${NOTIF_STORAGE_PREFIX}${memberId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MoneyNotification[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredNotifications(memberId: string, items: MoneyNotification[]): void {
  try {
    localStorage.setItem(
      `${NOTIF_STORAGE_PREFIX}${memberId}`,
      JSON.stringify(items.slice(0, MAX_STORED_NOTIFICATIONS)),
    );
  } catch {
    // ignore storage quota errors
  }
}

export function loadNotificationBaseline(memberId: string): NotificationBaseline | null {
  try {
    const raw = localStorage.getItem(`${BASELINE_STORAGE_PREFIX}${memberId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotificationBaseline>;
    if (!Array.isArray(parsed.contributionIds) || !Array.isArray(parsed.expenseIds)) {
      return null;
    }
    return {
      contributionIds: parsed.contributionIds,
      expenseIds: parsed.expenseIds,
      editHistoryIds: Array.isArray(parsed.editHistoryIds) ? parsed.editHistoryIds : [],
      voidedExpenseIds: Array.isArray(parsed.voidedExpenseIds) ? parsed.voidedExpenseIds : [],
      reimbursedExpenseIds: Array.isArray(parsed.reimbursedExpenseIds)
        ? parsed.reimbursedExpenseIds
        : [],
    };
  } catch {
    return null;
  }
}

export function saveNotificationBaseline(
  memberId: string,
  baseline: NotificationBaseline,
): void {
  try {
    localStorage.setItem(`${BASELINE_STORAGE_PREFIX}${memberId}`, JSON.stringify(baseline));
  } catch {
    // ignore storage quota errors
  }
}

export function loadNotifSoundEnabled(): boolean {
  try {
    const saved = localStorage.getItem(NOTIF_SOUND_KEY);
    return saved === 'false' ? false : true;
  } catch {
    return true;
  }
}

export function saveNotifSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(NOTIF_SOUND_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}
