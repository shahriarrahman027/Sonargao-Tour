import type {
  Contribution,
  Expense,
  ExpenseAllocation,
  ExpenseCategory,
  Member,
  TourSettings,
} from '../types/tour';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Transport',
  'Food',
  'Tickets',
  'Shopping',
  'Accommodation',
  'Miscellaneous',
  'Other',
];

export interface MemberFinancialSummary {
  member: Member;
  totalContributed: number;
  totalAllocated: number;
  /** Member Balance = Member Contributions - Member Expense Allocations */
  balance: number;
  targetContribution: number;
  outstandingContribution: number;
  personalPaidTotal: number;
  personalPaidUnreimbursed: number;
  contributionCount: number;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  amount: number;
  count: number;
  percentage: number;
}

export interface TimelinePoint {
  dateLabel: string;
  timestamp: number;
  spent: number;
  cumulativeSpent: number;
}

export interface FinancialSummary {
  totalCollected: number;
  totalGroupCashSpent: number;
  totalPersonalPaidSpent: number;
  totalPersonalUnreimbursed: number;
  totalAllExpenses: number;
  /** Group Cash = Total Contributions - Expenses Paid From Group Cash (and reimbursed personal expenses if settled from cash) */
  remainingGroupCash: number;
  expenseCount: number;
  contributionCount: number;
  estimatedGroupBudget: number;
  targetGroupCollection: number;
  collectionProgressPct: number;
  budgetUsedPct: number;
  budgetWarningActive: boolean;
  hasDiscrepancy: boolean;
  discrepancyAmount: number;
  memberSummaries: MemberFinancialSummary[];
  underpaidMembers: MemberFinancialSummary[];
  categoryTotals: CategoryTotal[];
  spendingTimeline: TimelinePoint[];
}

export function roundMoney(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Validates that individual allocations sum cleanly to total_amount (in poisha).
 */
export function validateAllocationsMatchTotal(
  totalAmount: number,
  allocations: ExpenseAllocation[],
): { valid: boolean; allocationSum: number; difference: number } {
  const sum = roundMoney(
    allocations.reduce((acc, a) => acc + (Number(a.allocated_amount) || 0), 0),
  );
  const total = roundMoney(Number(totalAmount) || 0);
  const diff = roundMoney(total - sum);
  return {
    valid: Math.abs(diff) < 0.01 && total > 0 && allocations.length > 0,
    allocationSum: sum,
    difference: diff,
  };
}

/**
 * Splits an equal amount cleanly across N members so the sum matches total exactly
 * (assigning any 1-poisha remainder to the first participant).
 */
export function computeEqualAllocations(
  totalAmount: number,
  participantIds: string[],
  note = '',
): ExpenseAllocation[] {
  if (participantIds.length === 0 || totalAmount <= 0) return [];
  const totalPoisha = Math.round(totalAmount * 100);
  const basePoisha = Math.floor(totalPoisha / participantIds.length);
  const remainder = totalPoisha - basePoisha * participantIds.length;

  return participantIds.map((memberId, index) => ({
    member_id: memberId,
    allocated_amount: (basePoisha + (index === 0 ? remainder : 0)) / 100,
    note,
  }));
}

export function computeFinancialSummary(
  members: Member[],
  contributions: Contribution[],
  expenses: Expense[],
  settings: TourSettings,
): FinancialSummary {
  const activeExpenses = expenses.filter((e) => !e.voided_by_correction);

  const totalCollected = roundMoney(
    contributions.reduce((sum, c) => sum + Number(c.amount), 0),
  );

  const totalGroupCashSpent = roundMoney(
    activeExpenses
      .filter((e) => e.funding_source === 'group_cash')
      .reduce((sum, e) => sum + Number(e.total_amount), 0),
  );

  const personalExpenses = activeExpenses.filter(
    (e) => e.funding_source === 'personal_payer',
  );

  const totalPersonalPaidSpent = roundMoney(
    personalExpenses.reduce((sum, e) => sum + Number(e.total_amount), 0),
  );

  const totalPersonalUnreimbursed = roundMoney(
    personalExpenses
      .filter((e) => !e.is_reimbursed)
      .reduce((sum, e) => sum + Number(e.total_amount), 0),
  );

  const totalPersonalReimbursed = roundMoney(
    personalExpenses
      .filter((e) => e.is_reimbursed)
      .reduce((sum, e) => sum + Number(e.total_amount), 0),
  );

  const totalAllExpenses = roundMoney(
    activeExpenses.reduce((sum, e) => sum + Number(e.total_amount), 0),
  );

  // Group cash decreases for group_cash expenses AND any personal expenses reimbursed from group cash
  const remainingGroupCash = roundMoney(
    totalCollected - totalGroupCashSpent - totalPersonalReimbursed,
  );

  const targetPerPerson = Number(settings.target_contribution_per_person || 0);
  const estimatedPerPerson = Number(settings.estimated_budget_per_person || 0);
  const memberCount = members.length || 6;

  const memberSummaries: MemberFinancialSummary[] = members.map((member) => {
    const memberContribs = contributions.filter((c) => c.member_id === member.id);
    const totalContributed = roundMoney(
      memberContribs.reduce((sum, c) => sum + Number(c.amount), 0),
    );

    const totalAllocated = roundMoney(
      activeExpenses.reduce((sum, exp) => {
        const alloc = exp.allocations.find((a) => a.member_id === member.id);
        return sum + (alloc ? Number(alloc.allocated_amount) : 0);
      }, 0),
    );

    const personalPaidTotal = roundMoney(
      personalExpenses
        .filter((e) => e.payer_member_id === member.id)
        .reduce((sum, e) => sum + Number(e.total_amount), 0),
    );

    const personalPaidUnreimbursed = roundMoney(
      personalExpenses
        .filter((e) => e.payer_member_id === member.id && !e.is_reimbursed)
        .reduce((sum, e) => sum + Number(e.total_amount), 0),
    );

    const balance = roundMoney(totalContributed - totalAllocated);
    const outstandingContribution = roundMoney(
      Math.max(0, targetPerPerson - totalContributed),
    );

    return {
      member,
      totalContributed,
      totalAllocated,
      balance,
      targetContribution: targetPerPerson,
      outstandingContribution,
      personalPaidTotal,
      personalPaidUnreimbursed,
      contributionCount: memberContribs.length,
    };
  });

  // Check accounting identity:
  // Sum of member allocations should equal totalAllExpenses
  const totalAllocatedAcrossMembers = roundMoney(
    memberSummaries.reduce((s, m) => s + m.totalAllocated, 0),
  );
  const discrepancyAmount = roundMoney(totalAllExpenses - totalAllocatedAcrossMembers);
  const hasDiscrepancy = Math.abs(discrepancyAmount) >= 0.01;

  const targetGroupCollection = roundMoney(targetPerPerson * memberCount);
  const estimatedGroupBudget = roundMoney(estimatedPerPerson * memberCount);

  const collectionProgressPct =
    targetGroupCollection > 0
      ? Math.min(100, Math.round((totalCollected / targetGroupCollection) * 100))
      : 0;

  const budgetUsedPct =
    estimatedGroupBudget > 0
      ? Math.round((totalAllExpenses / estimatedGroupBudget) * 100)
      : 0;

  const budgetWarningActive =
    estimatedGroupBudget > 0 &&
    budgetUsedPct >= (settings.budget_warning_threshold_pct || 85);

  const catMap = new Map<ExpenseCategory, { amount: number; count: number }>();
  for (const cat of EXPENSE_CATEGORIES) {
    catMap.set(cat, { amount: 0, count: 0 });
  }
  for (const exp of activeExpenses) {
    const entry = catMap.get(exp.category) ?? { amount: 0, count: 0 };
    entry.amount = roundMoney(entry.amount + Number(exp.total_amount));
    entry.count += 1;
    catMap.set(exp.category, entry);
  }

  const categoryTotals: CategoryTotal[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
      percentage:
        totalAllExpenses > 0
          ? Math.round((data.amount / totalAllExpenses) * 100)
          : 0,
    }))
    .filter((c) => c.amount > 0 || c.count > 0)
    .sort((a, b) => b.amount - a.amount);

  const sortedByTime = [...activeExpenses].sort(
    (a, b) => new Date(a.expense_at).getTime() - new Date(b.expense_at).getTime(),
  );
  let cumulative = 0;
  const spendingTimeline: TimelinePoint[] = sortedByTime.map((exp) => {
    cumulative = roundMoney(cumulative + Number(exp.total_amount));
    const dt = new Date(exp.expense_at);
    return {
      dateLabel: dt.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' · ' + dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      timestamp: dt.getTime(),
      spent: Number(exp.total_amount),
      cumulativeSpent: cumulative,
    };
  });

  return {
    totalCollected,
    totalGroupCashSpent,
    totalPersonalPaidSpent,
    totalPersonalUnreimbursed,
    totalAllExpenses,
    remainingGroupCash,
    expenseCount: activeExpenses.length,
    contributionCount: contributions.length,
    estimatedGroupBudget,
    targetGroupCollection,
    collectionProgressPct,
    budgetUsedPct,
    budgetWarningActive,
    hasDiscrepancy,
    discrepancyAmount,
    memberSummaries,
    underpaidMembers: memberSummaries.filter((m) => m.outstandingContribution > 0),
    categoryTotals,
    spendingTimeline,
  };
}
