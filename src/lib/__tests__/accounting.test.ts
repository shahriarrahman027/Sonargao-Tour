import { describe, expect, it } from 'vitest';
import { DEFAULT_MEMBERS, DEFAULT_TOUR_SETTINGS } from '../../data/defaultSeed';
import type { Contribution, Expense } from '../../types/tour';
import {
  computeEqualAllocations,
  computeFinancialSummary,
  validateAllocationsMatchTotal,
} from '../accounting';

describe('Tour Financial Accounting Engine', () => {
  const m = DEFAULT_MEMBERS;

  it('splits equal allocations accurately across 6 members without losing poisha', () => {
    const allocs = computeEqualAllocations(100, m.map((x) => x.id));
    expect(allocs).toHaveLength(6);
    const check = validateAllocationsMatchTotal(100, allocs);
    expect(check.valid).toBe(true);
    expect(check.allocationSum).toBe(100);
  });

  it('rejects allocations whose sum does not match the expense total', () => {
    const check = validateAllocationsMatchTotal(500, [
      { member_id: m[0].id, allocated_amount: 160 },
      { member_id: m[1].id, allocated_amount: 290 },
    ]);
    expect(check.valid).toBe(false);
    expect(check.difference).toBe(50);
  });

  it('computes Group Cash and Individual Balances accurately for equal + custom + personal payer expenses', () => {
    const contributions: Contribution[] = m.map((member, idx) => ({
      id: `c-${idx}`,
      member_id: member.id,
      amount: idx === 5 ? 500 : 1000, // Shoaib gave 500, others 1000 -> total 5500
      payment_method: 'Cash',
      contributed_at: '2026-11-28T06:30:00Z',
      notes: 'Initial cash',
      reference_code: '',
      is_correction: false,
      created_by: m[1].id,
      created_at: '2026-11-28T06:30:00Z',
    }));

    const expenses: Expense[] = [
      // Expense 1: Museum ticket 20 * 6 = 120 from Group Cash
      {
        id: 'e-1',
        title: 'Panam Nagar Tickets',
        category: 'Tickets',
        expense_at: '2026-11-28T10:00:00Z',
        total_amount: 120,
        description: '',
        funding_source: 'group_cash',
        allocation_mode: 'equal',
        is_reimbursed: false,
        is_correction: false,
        voided_by_correction: false,
        created_by: m[1].id,
        created_at: '2026-11-28T10:00:00Z',
        updated_at: '2026-11-28T10:00:00Z',
        allocations: computeEqualAllocations(120, m.map((x) => x.id)),
        items: [],
      },
      // Expense 2: Puran Dhaka Biriyani custom allocation (160 + 290 + 390 = 840) from Group Cash
      {
        id: 'e-2',
        title: 'Nazirabazar Biriyani',
        category: 'Food',
        expense_at: '2026-11-28T18:30:00Z',
        total_amount: 840,
        description: 'Individual orders',
        funding_source: 'group_cash',
        allocation_mode: 'custom',
        is_reimbursed: false,
        is_correction: false,
        voided_by_correction: false,
        created_by: m[1].id,
        created_at: '2026-11-28T18:30:00Z',
        updated_at: '2026-11-28T18:30:00Z',
        allocations: [
          { member_id: m[0].id, allocated_amount: 160, note: 'Half biriyani' },
          { member_id: m[1].id, allocated_amount: 290, note: 'Full biriyani' },
          { member_id: m[2].id, allocated_amount: 390, note: 'Full biriyani + borhani' },
        ],
        items: [],
      },
      // Expense 3: Rickshaw fare 180 paid personally by Ashik (m[3]), NOT yet reimbursed
      {
        id: 'e-3',
        title: 'Old Dhaka Rickshaws',
        category: 'Transport',
        expense_at: '2026-11-28T16:45:00Z',
        total_amount: 180,
        description: '',
        payer_member_id: m[3].id,
        funding_source: 'personal_payer',
        allocation_mode: 'equal',
        is_reimbursed: false,
        is_correction: false,
        voided_by_correction: false,
        created_by: m[1].id,
        created_at: '2026-11-28T16:45:00Z',
        updated_at: '2026-11-28T16:45:00Z',
        allocations: computeEqualAllocations(180, m.map((x) => x.id)),
        items: [],
      },
    ];

    const summary = computeFinancialSummary(m, contributions, expenses, DEFAULT_TOUR_SETTINGS);

    // Total collected = 5500
    expect(summary.totalCollected).toBe(5500);
    // Group cash spent = 120 + 840 = 960 (personal payer 180 must NOT reduce group cash)
    expect(summary.totalGroupCashSpent).toBe(960);
    expect(summary.remainingGroupCash).toBe(5500 - 960);
    // Personal paid tracked separately
    expect(summary.totalPersonalPaidSpent).toBe(180);
    expect(summary.totalPersonalUnreimbursed).toBe(180);
    expect(summary.hasDiscrepancy).toBe(false);

    // Mahadi (m[0]): 1000 - (20 + 160 + 30) = 790
    expect(summary.memberSummaries[0].balance).toBe(790);
    // Seam (m[2]): 1000 - (20 + 390 + 30) = 560
    expect(summary.memberSummaries[2].balance).toBe(560);
    // Ashik (m[3]): 1000 - (20 + 30) = 950, plus 180 personal unreimbursed
    expect(summary.memberSummaries[3].balance).toBe(950);
    expect(summary.memberSummaries[3].personalPaidUnreimbursed).toBe(180);
    // Shoaib (m[5]) underpaid by 500
    expect(summary.underpaidMembers.map((u) => u.member.slug)).toEqual(['shoaib']);
  });
});
