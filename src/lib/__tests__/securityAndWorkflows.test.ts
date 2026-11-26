import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatBDT, toBanglaDigits } from '../i18n';
import { tourApi } from '../tourApi';

// Minimal in-memory localStorage polyfill for Node test environment
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

describe('Access Control, RBAC, Offline Guard & Persistence', () => {
  beforeEach(() => {
    installStorageMock();
  });

  it('rejects unauthorized DIU student IDs and grants access to valid members', async () => {
    await expect(tourApi.loginWithStudentId('FAKE-999')).rejects.toThrow(/Unauthorized/i);

    const session = await tourApi.loginWithStudentId('DIU-101');
    expect(session.member.slug).toBe('mahadi');
    expect(session.isAdmin).toBe(false);
  });

  it('blocks non-admin members from unlocking Admin Dashboard or modifying finances', async () => {
    await tourApi.loginWithStudentId('DIU-101'); // Mahadi (member)
    await expect(tourApi.elevateAdmin('secret123')).rejects.toThrow(/Only Shahriar/i);

    await expect(
      tourApi.recordContribution({
        member_id: '11111111-1111-4111-8111-111111111101',
        amount: 1000,
        payment_method: 'Cash',
        notes: 'Unauthorized attempt',
      }),
    ).rejects.toThrow(/Forbidden/i);
  });

  it('allows Shahriar to elevate admin, record contribution, create & audit-edit expenses, and persist across reload', async () => {
    const sess = await tourApi.loginWithStudentId('DIU-102'); // Shahriar
    expect(sess.member.role).toBe('admin');

    await tourApi.elevateAdmin('shahriar-secure-pass');

    await tourApi.recordContribution({
      member_id: '11111111-1111-4111-8111-111111111101',
      amount: 1000,
      payment_method: 'Cash',
      notes: 'Cash at Savar',
    });

    await tourApi.createExpense({
      title: 'Panam Entry Tickets',
      category: 'Tickets',
      total_amount: 120,
      funding_source: 'group_cash',
      allocation_mode: 'equal',
      allocations: [
        { member_id: '11111111-1111-4111-8111-111111111101', allocated_amount: 60 },
        { member_id: '11111111-1111-4111-8111-111111111102', allocated_amount: 60 },
      ],
    });

    const restored = await tourApi.restoreSession();
    expect(restored?.isAdmin).toBe(true);

    const state = await tourApi.fetchFullState();
    expect(state.contributions).toHaveLength(1);
    expect(state.expenses).toHaveLength(1);

    // Editing expense requires an audit reason
    await expect(
      tourApi.updateExpenseWithAudit({
        expense_id: state.expenses[0].id,
        reason: '',
        title: 'Updated',
        category: 'Tickets',
        total_amount: 120,
        funding_source: 'group_cash',
        allocation_mode: 'equal',
        allocations: state.expenses[0].allocations,
      }),
    ).rejects.toThrow(/reason/i);

    await tourApi.updateExpenseWithAudit({
      expense_id: state.expenses[0].id,
      reason: 'Corrected ticket count',
      title: 'Panam Tickets (Updated)',
      category: 'Tickets',
      total_amount: 140,
      funding_source: 'group_cash',
      allocation_mode: 'equal',
      allocations: [
        { member_id: '11111111-1111-4111-8111-111111111101', allocated_amount: 70 },
        { member_id: '11111111-1111-4111-8111-111111111102', allocated_amount: 70 },
      ],
    });

    const updatedState = await tourApi.fetchFullState();
    expect(updatedState.expenses[0].total_amount).toBe(140);
    expect(updatedState.expenses[0].edit_history).toHaveLength(1);
  });

  it('blocks financial mutations while offline so fake saves never happen', async () => {
    await tourApi.loginWithStudentId('DIU-102');
    await tourApi.elevateAdmin('shahriar-secure-pass');

    vi.stubGlobal('navigator', { onLine: false, userAgent: 'vitest' });

    await expect(
      tourApi.recordContribution({
        member_id: '11111111-1111-4111-8111-111111111101',
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
