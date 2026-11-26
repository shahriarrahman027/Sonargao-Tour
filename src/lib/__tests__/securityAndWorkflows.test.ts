import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MEMBERS } from '../../data/defaultSeed';
import { computeEqualAllocations, computeFinancialSummary } from '../accounting';
import { formatBDT, toBanglaDigits } from '../i18n';
import { tourApi } from '../tourApi';

function installStorageMock() {
  const store = new Map<string, string>();
  const storageMock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal('localStorage', storageMock);
  vi.stubGlobal('navigator', { onLine: true, userAgent: 'vitest' });
}

describe('End-to-End QA: Finance, Access Control, Audit & Workflows', () => {
  beforeEach(() => {
    installStorageMock();
  });

  it('allows all 6 authorized student IDs individually (with space trimming) and rejects invalid IDs', async () => {
    const validCases = [
      ['251-15-008', 'mahadi', 'member'],
      [' 251-15-053 ', 'seam', 'member'],
      ['251-15-554', 'ashik', 'member'],
      ['251-15-871', 'safin', 'member'],
      ['253-15-078', 'shoaib', 'member'],
      ['  251-15-027  ', 'shahriar', 'admin'],
    ] as const;

    for (const [id, expectedSlug, expectedRole] of validCases) {
      const sess = await tourApi.loginWithStudentId(id);
      expect(sess.member.slug).toBe(expectedSlug);
      expect(sess.member.role).toBe(expectedRole);
      expect(sess.isAdmin).toBe(false);
      await tourApi.logout();
    }

    await expect(tourApi.loginWithStudentId('FAKE-999')).rejects.toThrow(/Unauthorized/i);
    await expect(tourApi.loginWithStudentId('251-15-999')).rejects.toThrow(/Unauthorized/i);
    await expect(tourApi.loginWithStudentId('DIU-101')).rejects.toThrow(/Unauthorized/i);
  });

  it('enforces group passcode when enabled', async () => {
    await tourApi.loginWithStudentId('251-15-027');
    await tourApi.elevateAdmin('shahriar-pass');
    await tourApi.updateGroupPasscode(true, 'tour2026');
    await tourApi.logout();

    await expect(tourApi.loginWithStudentId('251-15-008')).rejects.toThrow(/passcode/i);
    await expect(tourApi.loginWithStudentId('251-15-008', 'wrong')).rejects.toThrow(/passcode/i);

    const session = await tourApi.loginWithStudentId('251-15-008', 'tour2026');
    expect(session.member.slug).toBe('mahadi');
    expect(session.isAdmin).toBe(false);
  });

  it('prevents regular members from elevating admin or modifying financial records', async () => {
    await tourApi.loginWithStudentId('251-15-008');
    await expect(tourApi.elevateAdmin('secret123')).rejects.toThrow(/Only Shahriar/i);

    await expect(
      tourApi.recordContribution({
        member_id: DEFAULT_MEMBERS[0].id,
        amount: 1000,
        payment_method: 'Cash',
        notes: 'Unauthorized attempt',
      }),
    ).rejects.toThrow(/Forbidden/i);

    await expect(
      tourApi.createExpense({
        title: 'Fake Expense',
        category: 'Food',
        total_amount: 100,
        funding_source: 'group_cash',
        allocation_mode: 'equal',
        allocations: [{ member_id: DEFAULT_MEMBERS[0].id, allocated_amount: 100 }],
      }),
    ).rejects.toThrow(/Forbidden/i);
  });

  it('runs full 6-member tour accounting scenario: contributions, equal tickets, custom biriyani, personal expense, edit, void, and persistence', async () => {
    await tourApi.loginWithStudentId('251-15-027'); // Shahriar
    await tourApi.elevateAdmin('shahriar-secure-pass');

    // 1. Add ৳1,000 cash contributions from all 6 members (= ৳6,000 total)
    for (const member of DEFAULT_MEMBERS) {
      await tourApi.recordContribution({
        member_id: member.id,
        amount: 1000,
        payment_method: 'Cash',
        notes: 'Initial tour fund',
      });
    }

    // 2. Add tickets: ৳20 x 6 = ৳120 equally allocated from Group Cash
    await tourApi.createExpense({
      title: 'Panam Nagar Tickets',
      category: 'Tickets',
      total_amount: 120,
      funding_source: 'group_cash',
      allocation_mode: 'equal',
      allocations: computeEqualAllocations(120, DEFAULT_MEMBERS.map((m) => m.id)),
    });

    // 3. Reject mismatched allocation total
    await expect(
      tourApi.createExpense({
        title: 'Bad Biriyani',
        category: 'Food',
        total_amount: 500,
        funding_source: 'group_cash',
        allocation_mode: 'custom',
        allocations: [
          { member_id: DEFAULT_MEMBERS[0].id, allocated_amount: 160 },
          { member_id: DEFAULT_MEMBERS[1].id, allocated_amount: 290 },
        ],
      }),
    ).rejects.toThrow(/must match total/i);

    // 4. Add custom Biriyani expense (160 + 290 + 390 = 840) from Group Cash
    await tourApi.createExpense({
      title: 'Nazirabazar Biriyani',
      category: 'Food',
      total_amount: 840,
      funding_source: 'group_cash',
      allocation_mode: 'custom',
      allocations: [
        { member_id: DEFAULT_MEMBERS[0].id, allocated_amount: 160, note: 'Half biriyani' },
        { member_id: DEFAULT_MEMBERS[1].id, allocated_amount: 290, note: 'Full biriyani' },
        { member_id: DEFAULT_MEMBERS[2].id, allocated_amount: 390, note: 'Full biriyani + borhani' },
      ],
    });

    // 5. Add personal-paid expense (৳180 paid by Ashik, equally allocated to all 6)
    await tourApi.createExpense({
      title: 'Old Dhaka Rickshaw',
      category: 'Transport',
      total_amount: 180,
      funding_source: 'personal_payer',
      payer_member_id: DEFAULT_MEMBERS[3].id,
      allocation_mode: 'equal',
      allocations: computeEqualAllocations(180, DEFAULT_MEMBERS.map((m) => m.id)),
    });

    // Verify calculations before edit/void
    let state = await tourApi.fetchFullState();
    let summary = computeFinancialSummary(state.members, state.contributions, state.expenses, state.settings);

    expect(summary.totalCollected).toBe(6000);
    expect(summary.totalGroupCashSpent).toBe(960); // 120 + 840 (personal 180 excluded!)
    expect(summary.remainingGroupCash).toBe(5040); // 6000 - 960
    expect(summary.totalPersonalPaidSpent).toBe(180);
    expect(summary.totalPersonalUnreimbursed).toBe(180);
    expect(summary.hasDiscrepancy).toBe(false);
    // Mahadi (0): 1000 - (20 + 160 + 30) = 790
    expect(summary.memberSummaries[0].balance).toBe(790);
    // Seam (2): 1000 - (20 + 390 + 30) = 560
    expect(summary.memberSummaries[2].balance).toBe(560);
    // Safin (4): 1000 - (20 + 30) = 950
    expect(summary.memberSummaries[4].balance).toBe(950);

    // 6. Test audited edit and audited void
    const ticketExp = state.expenses.find((e) => e.title === 'Panam Nagar Tickets')!;
    await tourApi.updateExpenseWithAudit({
      expense_id: ticketExp.id,
      reason: 'Extra guide ticket',
      title: 'Panam Nagar Tickets + Guide',
      category: 'Tickets',
      total_amount: 180,
      funding_source: 'group_cash',
      allocation_mode: 'equal',
      allocations: computeEqualAllocations(180, DEFAULT_MEMBERS.map((m) => m.id)),
    });

    const rickshawExp = state.expenses.find((e) => e.title === 'Old Dhaka Rickshaw')!;
    await tourApi.voidExpenseWithAudit(rickshawExp.id, 'Duplicate entry');

    // Verify reload persistence
    const restoredSession = await tourApi.restoreSession();
    expect(restoredSession?.isAdmin).toBe(true);
    state = await tourApi.fetchFullState();
    summary = computeFinancialSummary(state.members, state.contributions, state.expenses, state.settings);

    expect(summary.expenseCount).toBe(2); // 1 active ticket (180) + 1 biriyani (840); rickshaw is voided
    expect(summary.remainingGroupCash).toBe(6000 - (180 + 840));
    expect(summary.totalPersonalPaidSpent).toBe(0);
    expect(state.expenses.find((e) => e.id === rickshawExp.id)?.voided_by_correction).toBe(true);
    expect(state.activityLog.some((l) => l.action_type === 'expense_voided')).toBe(true);
  });

  it('blocks financial mutations while offline and supports social/checklist workflows', async () => {
    const sess = await tourApi.loginWithStudentId('251-15-027');
    await tourApi.elevateAdmin('shahriar-secure-pass');

    // Polls, notes, checklist
    await tourApi.castVote('poll-1', 'opt-1', sess.member.id, false);
    await tourApi.addNote({ title: 'Meetup', content: 'At Savar C&B', is_pinned: true });
    await tourApi.toggleChecklistItem('chk-1', true);

    const state = await tourApi.fetchFullState();
    expect(state.polls[0].votes).toHaveLength(1);
    expect(state.notes.some((n) => n.title === 'Meetup' && n.is_pinned)).toBe(true);
    expect(state.checklist.find((c) => c.id === 'chk-1')?.is_completed).toBe(true);

    // Offline guard
    vi.stubGlobal('navigator', { onLine: false, userAgent: 'vitest' });
    await expect(
      tourApi.recordContribution({
        member_id: DEFAULT_MEMBERS[0].id,
        amount: 500,
        payment_method: 'Cash',
        notes: 'Offline test',
      }),
    ).rejects.toThrow(/Offline/i);
  });

  it('formats Bangla digits and BDT currency accurately', () => {
    expect(toBanglaDigits('2026')).toBe('২০২৬');
    expect(formatBDT(1000, 'bn')).toBe('৳১,০০০');
    expect(formatBDT(1000, 'en')).toBe('৳1,000');
  });
});
