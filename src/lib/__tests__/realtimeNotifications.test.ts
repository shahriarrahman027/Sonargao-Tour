import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MEMBERS } from '../../data/defaultSeed';
import { computeEqualAllocations } from '../accounting';
import {
  buildQuietSeedNotifications,
  createNotificationBaseline,
  extractNewMoneyNotifications,
  formatBanglaTaka,
  loadNotifSoundEnabled,
  loadNotificationBaseline,
  loadStoredNotifications,
  saveNotifSoundEnabled,
  saveNotificationBaseline,
  saveStoredNotifications,
} from '../notifications';
import { soundEngine } from '../sound';
import { tourApi } from '../tourApi';
import type { RealtimeMoneySignal } from '../../types/tour';

function installBrowserEnvironmentMocks() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  });
  vi.stubGlobal('navigator', { onLine: true, userAgent: 'vitest' });
}

describe('Real-Time Expense Notification System & Multi-Member Delivery', () => {
  beforeEach(() => {
    installBrowserEnvironmentMocks();
    soundEngine.setMuted(false);
  });

  it('delivers exactly one real-time notification per transaction across all 6 member baselines without duplicates', async () => {
    await tourApi.loginWithStudentId('251-15-027'); // Shahriar
    await tourApi.elevateAdmin('admin-pass');

    // Capture independent online baselines for all 6 members
    const initialState = await tourApi.fetchFullState();
    const memberBaselines = new Map(
      DEFAULT_MEMBERS.map((m) => [m.id, createNotificationBaseline(initialState)]),
    );
    const memberSeenKeys = new Map(
      DEFAULT_MEMBERS.map((m) => [m.id, new Set<string>()]),
    );

    const emittedSignals: Array<RealtimeMoneySignal | undefined> = [];
    const unsubscribe = tourApi.subscribeToRealtime((signal) => {
      emittedSignals.push(signal);
    });

    // Step 1: Record Safin's ৳1,000 contribution
    const safin = DEFAULT_MEMBERS.find((m) => m.slug === 'safin')!;
    const mahadi = DEFAULT_MEMBERS.find((m) => m.slug === 'mahadi')!;
    await tourApi.recordContribution({
      member_id: safin.id,
      amount: 1000,
      payment_method: 'Cash',
      notes: 'Tour cash fund',
    });

    expect(emittedSignals).toHaveLength(1);
    expect(emittedSignals[0]?.kind).toBe('contribution_added');

    const afterContribState = await tourApi.fetchFullState();
    for (const member of DEFAULT_MEMBERS) {
      const seen = memberSeenKeys.get(member.id)!;
      const res = extractNewMoneyNotifications({
        prevBaseline: memberBaselines.get(member.id)!,
        nextState: afterContribState,
        viewerMemberId: member.id,
        seenEventKeys: seen,
      });
      expect(res.notifications).toHaveLength(1);
      const n = res.notifications[0];
      expect(n.kind).toBe('contribution_added');
      expect(n.message_bn).toContain(safin.name_bn);
      expect(n.message_bn).toContain('১,০০০ টাকা');
      expect(n.remainingGroupCash).toBe(1000);
      expect(n.affectedLabelBn).toContain(safin.name_bn);
      n.eventKey && seen.add(n.eventKey);
      memberBaselines.set(member.id, res.nextBaseline);

      // Re-processing the same state / duplicate event yields ZERO additional notifications
      const dupCheck = extractNewMoneyNotifications({
        prevBaseline: res.nextBaseline,
        nextState: afterContribState,
        viewerMemberId: member.id,
        seenEventKeys: seen,
      });
      expect(dupCheck.notifications).toHaveLength(0);
    }

    // Step 2: Mahadi contributes ৳1,000, then add a ৳20 ticket expense solely for Mahadi
    await tourApi.recordContribution({
      member_id: mahadi.id,
      amount: 1000,
      payment_method: 'Cash',
      notes: 'Mahadi fund',
    });

    let state = await tourApi.fetchFullState();
    for (const member of DEFAULT_MEMBERS) {
      const res = extractNewMoneyNotifications({
        prevBaseline: memberBaselines.get(member.id)!,
        nextState: state,
        viewerMemberId: member.id,
        seenEventKeys: memberSeenKeys.get(member.id)!,
      });
      expect(res.notifications).toHaveLength(1);
      res.notifications.forEach((n) => memberSeenKeys.get(member.id)!.add(n.eventKey));
      memberBaselines.set(member.id, res.nextBaseline);
    }

    // Single expense touching expense + 6 allocations + itemized lines still generates ONLY ONE event
    const signalCountBeforeExpense = emittedSignals.length;
    await tourApi.createExpense({
      title: 'Panam Nagar Tickets',
      category: 'Tickets',
      total_amount: 120,
      funding_source: 'group_cash',
      allocation_mode: 'equal',
      allocations: computeEqualAllocations(120, DEFAULT_MEMBERS.map((m) => m.id)),
      items: DEFAULT_MEMBERS.map((m) => ({
        member_id: m.id,
        item_name: 'Gate Ticket',
        quantity: 1,
        unit_price: 20,
        line_total: 20,
      })),
    });

    expect(emittedSignals.length - signalCountBeforeExpense).toBe(1);
    expect(emittedSignals[emittedSignals.length - 1]?.kind).toBe('expense_created');

    state = await tourApi.fetchFullState();
    for (const member of DEFAULT_MEMBERS) {
      const seen = memberSeenKeys.get(member.id)!;
      const res = extractNewMoneyNotifications({
        prevBaseline: memberBaselines.get(member.id)!,
        nextState: state,
        viewerMemberId: member.id,
        seenEventKeys: seen,
      });
      expect(res.notifications).toHaveLength(1);
      const n = res.notifications[0];
      expect(n.kind).toBe('expense_created');
      expect(n.amount).toBe(120);
      expect(n.remainingGroupCash).toBe(1880); // 2000 collected - 120 tickets
      if (member.id === mahadi.id) {
        expect(n.viewerBalance).toBe(980); // 1000 - 20
      } else if (member.id === safin.id) {
        expect(n.viewerBalance).toBe(980); // 1000 - 20
      }
      seen.add(n.eventKey);
      memberBaselines.set(member.id, res.nextBaseline);
    }

    unsubscribe();
  });

  it('generates varied Bangla messages and accurately handles single-member expenses, refunds, edits, reimbursements, and voids', async () => {
    await tourApi.loginWithStudentId('251-15-027');
    await tourApi.elevateAdmin('admin-pass');

    const mahadi = DEFAULT_MEMBERS.find((m) => m.slug === 'mahadi')!;
    const ashik = DEFAULT_MEMBERS.find((m) => m.slug === 'ashik')!;

    await tourApi.recordContribution({
      member_id: mahadi.id,
      amount: 1000,
      payment_method: 'Cash',
      notes: 'Cash',
    });

    let baseline = createNotificationBaseline(await tourApi.fetchFullState());
    const seen = new Set<string>();

    // Single-member expense (৳20 Ticket for Mahadi -> ৳980 remaining)
    await tourApi.createExpense({
      title: 'টিকিট',
      category: 'Tickets',
      total_amount: 20,
      funding_source: 'group_cash',
      allocation_mode: 'custom',
      allocations: [{ member_id: mahadi.id, allocated_amount: 20, note: 'Entry' }],
    });

    let state = await tourApi.fetchFullState();
    let res = extractNewMoneyNotifications({
      prevBaseline: baseline,
      nextState: state,
      viewerMemberId: mahadi.id,
      seenEventKeys: seen,
    });
    expect(res.notifications).toHaveLength(1);
    const singleExpNotif = res.notifications[0];
    expect(singleExpNotif.message_bn).toContain('মাহাদি');
    expect(singleExpNotif.message_bn).toContain('২০ টাকা');
    expect(singleExpNotif.message_bn).toContain('৯৮০ টাকা');
    expect(singleExpNotif.remainingGroupCash).toBe(980);
    seen.add(singleExpNotif.eventKey);
    baseline = res.nextBaseline;

    // Personal payer expense -> reimbursed refund
    await tourApi.createExpense({
      title: 'আশিকের রিকশা ভাড়া',
      category: 'Transport',
      total_amount: 100,
      funding_source: 'personal_payer',
      payer_member_id: ashik.id,
      allocation_mode: 'custom',
      allocations: [{ member_id: mahadi.id, allocated_amount: 100 }],
    });
    state = await tourApi.fetchFullState();
    res = extractNewMoneyNotifications({
      prevBaseline: baseline,
      nextState: state,
      viewerMemberId: ashik.id,
      seenEventKeys: seen,
    });
    expect(res.notifications[0].kind).toBe('expense_created');
    expect(res.notifications[0].remainingGroupCash).toBe(980); // Group cash untouched before reimbursement
    expect(res.notifications[0].message_bn).toContain('আশিক');
    res.notifications.forEach((n) => seen.add(n.eventKey));
    baseline = res.nextBaseline;

    const personalExp = state.expenses.find((e) => e.title === 'আশিকের রিকশা ভাড়া')!;
    await tourApi.updateExpenseWithAudit({
      expense_id: personalExp.id,
      reason: 'Cash reimbursed from pouch',
      title: personalExp.title,
      category: personalExp.category,
      total_amount: 100,
      funding_source: 'personal_payer',
      payer_member_id: ashik.id,
      allocation_mode: 'custom',
      allocations: [{ member_id: mahadi.id, allocated_amount: 100 }],
      is_reimbursed: true,
    });

    state = await tourApi.fetchFullState();
    res = extractNewMoneyNotifications({
      prevBaseline: baseline,
      nextState: state,
      viewerMemberId: ashik.id,
      seenEventKeys: seen,
    });
    expect(res.notifications).toHaveLength(1);
    expect(res.notifications[0].kind).toBe('expense_reimbursed');
    expect(res.notifications[0].remainingGroupCash).toBe(880); // 980 - 100 reimbursed
    expect(res.notifications[0].message_bn).toContain('আশিক');
    res.notifications.forEach((n) => seen.add(n.eventKey));
    baseline = res.nextBaseline;

    // Regular expense edit
    await tourApi.updateExpenseWithAudit({
      expense_id: personalExp.id,
      reason: 'Included tea tip',
      title: 'আশিকের রিকশা + চা',
      category: 'Transport',
      total_amount: 120,
      funding_source: 'personal_payer',
      payer_member_id: ashik.id,
      allocation_mode: 'custom',
      allocations: [{ member_id: mahadi.id, allocated_amount: 120 }],
      is_reimbursed: true,
    });
    state = await tourApi.fetchFullState();
    res = extractNewMoneyNotifications({
      prevBaseline: baseline,
      nextState: state,
      viewerMemberId: mahadi.id,
      seenEventKeys: seen,
    });
    expect(res.notifications).toHaveLength(1);
    expect(res.notifications[0].kind).toBe('expense_updated');
    expect(res.notifications[0].remainingGroupCash).toBe(860);
    res.notifications.forEach((n) => seen.add(n.eventKey));
    baseline = res.nextBaseline;

    // Void / reverse expense (must emit ONLY 1 expense_voided, never also expense_updated)
    await tourApi.voidExpenseWithAudit(personalExp.id, 'Duplicate bill');
    state = await tourApi.fetchFullState();
    res = extractNewMoneyNotifications({
      prevBaseline: baseline,
      nextState: state,
      viewerMemberId: mahadi.id,
      seenEventKeys: seen,
    });
    expect(res.notifications).toHaveLength(1);
    expect(res.notifications[0].kind).toBe('expense_voided');
    expect(res.notifications[0].remainingGroupCash).toBe(980);
    res.notifications.forEach((n) => seen.add(n.eventKey));
    baseline = res.nextBaseline;

    // Refund / negative contribution adjustment
    await tourApi.recordContribution({
      member_id: mahadi.id,
      amount: -180,
      payment_method: 'Adjustment',
      notes: 'Partial cash refund',
      is_correction: true,
    });
    state = await tourApi.fetchFullState();
    res = extractNewMoneyNotifications({
      prevBaseline: baseline,
      nextState: state,
      viewerMemberId: mahadi.id,
      seenEventKeys: seen,
    });
    expect(res.notifications).toHaveLength(1);
    expect(res.notifications[0].kind).toBe('contribution_refund');
    expect(res.notifications[0].remainingGroupCash).toBe(800);
    expect(res.notifications[0].message_bn).toContain('১৮০ টাকা');

    // Variation diversity across multiple distinct events
    const variants = new Set<string>();
    for (let i = 1; i <= 8; i += 1) {
      await tourApi.createExpense({
        title: `Tea Stop ${i}`,
        category: 'Food',
        total_amount: 10,
        funding_source: 'group_cash',
        allocation_mode: 'custom',
        allocations: [{ member_id: mahadi.id, allocated_amount: 10 }],
      });
      state = await tourApi.fetchFullState();
      res = extractNewMoneyNotifications({
        prevBaseline: baseline,
        nextState: state,
        viewerMemberId: mahadi.id,
        seenEventKeys: seen,
      });
      variants.add(res.notifications[0].message_bn);
      seen.add(res.notifications[0].eventKey);
      baseline = res.nextBaseline;
    }
    expect(variants.size).toBeGreaterThanOrEqual(2);
  });

  it('catches up missed offline transactions on reconnect and persists per-member notification state', async () => {
    const shoaib = DEFAULT_MEMBERS.find((m) => m.slug === 'shoaib')!;
    const initialState = await tourApi.fetchFullState();
    const shoaibBaseline = createNotificationBaseline(initialState);
    saveNotificationBaseline(shoaib.id, shoaibBaseline);

    // Seed quiet baseline check (fresh login produces read=true items)
    const quiet = buildQuietSeedNotifications(initialState, shoaib.id);
    expect(quiet.every((n) => n.read)).toBe(true);

    // While Shoaib is offline, Shahriar logs 2 transactions
    await tourApi.loginWithStudentId('251-15-027');
    await tourApi.elevateAdmin('admin-pass');
    await tourApi.recordContribution({
      member_id: shoaib.id,
      amount: 1000,
      payment_method: 'Cash',
      notes: 'Shoaib deposit',
    });
    await tourApi.createExpense({
      title: 'Morning Tea',
      category: 'Food',
      total_amount: 10,
      funding_source: 'group_cash',
      allocation_mode: 'custom',
      allocations: [{ member_id: shoaib.id, allocated_amount: 10 }],
    });
    await tourApi.logout();

    // Shoaib reconnects and loads stored baseline
    const restoredBaseline = loadNotificationBaseline(shoaib.id)!;
    const latestState = await tourApi.fetchFullState();
    const seen = new Set<string>();
    const caughtUp = extractNewMoneyNotifications({
      prevBaseline: restoredBaseline,
      nextState: latestState,
      viewerMemberId: shoaib.id,
      seenEventKeys: seen,
    });

    expect(caughtUp.notifications).toHaveLength(2);
    expect(caughtUp.notifications.every((n) => n.read === false)).toBe(true);

    saveStoredNotifications(shoaib.id, caughtUp.notifications);
    expect(loadStoredNotifications(shoaib.id)).toHaveLength(2);

    // Sound preference & helper formatting checks
    saveNotifSoundEnabled(false);
    expect(loadNotifSoundEnabled()).toBe(false);
    saveNotifSoundEnabled(true);
    expect(loadNotifSoundEnabled()).toBe(true);
    expect(formatBanglaTaka(900)).toBe('৯০০ টাকা');
  });
});
