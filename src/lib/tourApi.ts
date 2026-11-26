import {
  DEFAULT_ACTIVITY_LOG,
  DEFAULT_BADGES,
  DEFAULT_CHECKLIST,
  DEFAULT_CONTRIBUTIONS,
  DEFAULT_EXPENSES,
  DEFAULT_EXPLORE_DESTINATIONS,
  DEFAULT_FUN_EVENTS,
  DEFAULT_ITINERARY,
  DEFAULT_MEMBERS,
  DEFAULT_NOTES,
  DEFAULT_PHOTOS,
  DEFAULT_POLLS,
  DEFAULT_TOUR_PROGRESS,
  DEFAULT_TOUR_SETTINGS,
  DEV_MEMBER_HASH_MAP,
} from '../data/defaultSeed';
import type {
  ActivityLogEntry,
  AllocationMode,
  Badge,
  ChecklistItem,
  Contribution,
  Expense,
  ExpenseAllocation,
  ExpenseCategory,
  ExpenseItem,
  FunEvent,
  FundingSource,
  GateStatus,
  ItineraryItem,
  Member,
  Poll,
  SessionInfo,
  SharedNote,
  TourPhoto,
  TourProgress,
  TourSettings,
} from '../types/tour';
import { roundMoney, validateAllocationsMatchTotal } from './accounting';
import { saveOfflineSnapshot } from './offlineCache';
import {
  getStoredSessionToken,
  getSupabaseClient,
  isSupabaseConfigured,
  setStoredSessionToken,
} from './supabaseClient';

export interface FullTourState {
  settings: TourSettings;
  members: Member[];
  contributions: Contribution[];
  expenses: Expense[];
  itinerary: ItineraryItem[];
  checklist: ChecklistItem[];
  polls: Poll[];
  notes: SharedNote[];
  photos: TourPhoto[];
  progress: TourProgress;
  badges: Badge[];
  funEvents: FunEvent[];
  activityLog: ActivityLogEntry[];
}

// ============================================================================
// Local Development Store (used ONLY when Supabase credentials are absent)
// ============================================================================
const DEV_STORE_KEY = 'ek_diner_tour_dev_db_v1';
const DEV_ADMIN_HASH_KEY = 'ek_diner_tour_dev_admin_hash_v1';
const DEV_PASSCODE_HASH_KEY = 'ek_diner_tour_dev_passcode_hash_v1';
const DEV_SESSION_KEY = 'ek_diner_tour_dev_session_v1';
const DEV_RATE_KEY = 'ek_diner_tour_dev_rate_v1';

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadDevDb(): FullTourState {
  try {
    const raw = localStorage.getItem(DEV_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FullTourState;
      if (parsed.settings) {
        if (parsed.settings.website_name_bn === '১ দিনের সস্তায় ট্যুর') {
          parsed.settings.website_name_bn = DEFAULT_TOUR_SETTINGS.website_name_bn;
        }
        if (parsed.settings.website_name_en === 'Ek Diner Sostay Tour') {
          parsed.settings.website_name_en = DEFAULT_TOUR_SETTINGS.website_name_en;
        }
      }
      return parsed;
    }
  } catch {
    // fallback to seed
  }
  const initial: FullTourState = {
    settings: DEFAULT_TOUR_SETTINGS,
    members: DEFAULT_MEMBERS,
    contributions: DEFAULT_CONTRIBUTIONS,
    expenses: DEFAULT_EXPENSES,
    itinerary: DEFAULT_ITINERARY,
    checklist: DEFAULT_CHECKLIST,
    polls: DEFAULT_POLLS,
    notes: DEFAULT_NOTES,
    photos: DEFAULT_PHOTOS,
    progress: DEFAULT_TOUR_PROGRESS,
    badges: DEFAULT_BADGES,
    funEvents: DEFAULT_FUN_EVENTS,
    activityLog: DEFAULT_ACTIVITY_LOG,
  };
  saveDevDb(initial);
  return initial;
}

function saveDevDb(state: FullTourState) {
  localStorage.setItem(DEV_STORE_KEY, JSON.stringify(state));
}

function checkDevRateLimit(key: string, maxAttempts: number): void {
  try {
    const raw = localStorage.getItem(DEV_RATE_KEY);
    const map: Record<string, { count: number; lockedUntil: number | null }> = raw ? JSON.parse(raw) : {};
    const entry = map[key] || { count: 0, lockedUntil: null };
    if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
      throw new Error('Too many failed attempts. Please wait a few minutes.');
    }
    if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
      entry.count = 0;
      entry.lockedUntil = null;
    }
    entry.count += 1;
    if (entry.count > maxAttempts) {
      entry.lockedUntil = Date.now() + 5 * 60 * 1000;
      map[key] = entry;
      localStorage.setItem(DEV_RATE_KEY, JSON.stringify(map));
      throw new Error('Too many failed attempts. Temporarily locked for 5 minutes.');
    }
    map[key] = entry;
    localStorage.setItem(DEV_RATE_KEY, JSON.stringify(map));
  } catch (err) {
    if (err instanceof Error && err.message.includes('attempts')) throw err;
  }
}

function clearDevRateLimit(key: string) {
  try {
    const raw = localStorage.getItem(DEV_RATE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, unknown>;
    delete map[key];
    localStorage.setItem(DEV_RATE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function getDevSession(): SessionInfo | null {
  try {
    const raw = localStorage.getItem(DEV_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionInfo;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(DEV_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function requireDevAdmin(): { state: FullTourState; session: SessionInfo } {
  const session = getDevSession();
  if (!session || !session.isAdmin) {
    throw new Error('Forbidden: Admin authentication required.');
  }
  return { state: loadDevDb(), session };
}

function requireDevMember(): { state: FullTourState; session: SessionInfo } {
  const session = getDevSession();
  if (!session) {
    throw new Error('Unauthorized: Active member session required.');
  }
  return { state: loadDevDb(), session };
}

function assertOnlineForFinance() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Offline: Financial operations require an internet connection so records are never lost.');
  }
}

let activeSupabaseMemberId: string | null = null;

async function resolveSupabaseMemberId(): Promise<string> {
  if (activeSupabaseMemberId) return activeSupabaseMemberId;
  const sb = getSupabaseClient();
  if (!sb) throw new Error('Supabase client unavailable');
  const { data } = await sb.rpc('get_current_session_info');
  const res = data as { member?: Member } | null;
  if (!res?.member?.id) throw new Error('Unauthorized: Active member session required.');
  activeSupabaseMemberId = res.member.id;
  return activeSupabaseMemberId;
}

// ============================================================================
// Unified API (Supabase Production + Local Dev Mode)
// ============================================================================
export const tourApi = {
  isSupabaseMode(): boolean {
    return isSupabaseConfigured;
  },

  hasDevAdminConfigured(): boolean {
    return Boolean(localStorage.getItem(DEV_ADMIN_HASH_KEY));
  },

  async getGateStatus(): Promise<GateStatus> {
    const sb = getSupabaseClient();
    if (!sb) {
      const db = loadDevDb();
      return {
        website_name_bn: db.settings.website_name_bn,
        website_name_en: db.settings.website_name_en,
        tagline_bn: db.settings.tagline_bn,
        tagline_en: db.settings.tagline_en,
        require_group_passcode: db.settings.require_group_passcode,
      };
    }
    const { data, error } = await sb.rpc('get_gate_status');
    if (error || !data) {
      return {
        website_name_bn: DEFAULT_TOUR_SETTINGS.website_name_bn,
        website_name_en: DEFAULT_TOUR_SETTINGS.website_name_en,
        tagline_bn: DEFAULT_TOUR_SETTINGS.tagline_bn,
        tagline_en: DEFAULT_TOUR_SETTINGS.tagline_en,
        require_group_passcode: false,
      };
    }
    return data as GateStatus;
  },

  async restoreSession(): Promise<SessionInfo | null> {
    const sb = getSupabaseClient();
    if (!sb) {
      return getDevSession();
    }
    const token = getStoredSessionToken();
    if (!token) return null;

    const { data, error } = await sb.rpc('get_current_session_info');
    if (error || !data) {
      setStoredSessionToken(null);
      return null;
    }
    const res = data as { is_admin: boolean; member: Member };
    activeSupabaseMemberId = res.member.id;
    return {
      token,
      member: res.member,
      isAdmin: res.is_admin,
      expiresAt: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
    };
  },

  async loginWithStudentId(studentId: string, groupPasscode?: string): Promise<SessionInfo> {
    const sb = getSupabaseClient();
    if (!sb) {
      checkDevRateLimit('member_login', 8);
      const cleanId = studentId.replace(/\s+/g, '').toUpperCase();
      if (cleanId.length < 5) {
        throw new Error('Unauthorized DIU Student ID.');
      }
      const idHash = await sha256Hex(cleanId);
      const memberId = DEV_MEMBER_HASH_MAP[idHash];
      if (!memberId) {
        throw new Error('Unauthorized DIU Student ID.');
      }
      const db = loadDevDb();
      if (db.settings.require_group_passcode) {
        const storedHash = localStorage.getItem(DEV_PASSCODE_HASH_KEY);
        const inputHash = await sha256Hex(groupPasscode || '');
        if (!storedHash || storedHash !== inputHash) {
          throw new Error('Incorrect group passcode.');
        }
      }
      const member = db.members.find((m) => m.id === memberId);
      if (!member) throw new Error('Member record missing.');
      clearDevRateLimit('member_login');
      const session: SessionInfo = {
        token: crypto.randomUUID(),
        member,
        isAdmin: false,
        expiresAt: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
      };
      localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(session));
      return session;
    }

    const { data, error } = await sb.rpc('verify_member_access', {
      p_student_id: studentId,
      p_group_passcode: groupPasscode || null,
      p_client_hint: navigator.userAgent.slice(0, 64),
    });
    if (error) throw new Error(error.message);
    const payload = data as { token: string; is_admin: boolean; expires_at: string; member: Member };
    setStoredSessionToken(payload.token);
    activeSupabaseMemberId = payload.member.id;
    return {
      token: payload.token,
      member: payload.member,
      isAdmin: payload.is_admin,
      expiresAt: payload.expires_at,
    };
  },

  async elevateAdmin(password: string): Promise<boolean> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { session } = requireDevMember();
      if (session.member.role !== 'admin') {
        throw new Error('Only Shahriar (Treasurer) can unlock Admin Dashboard.');
      }
      checkDevRateLimit('admin_login', 5);
      const existingHash = localStorage.getItem(DEV_ADMIN_HASH_KEY);
      const inputHash = await sha256Hex(password);
      if (!existingHash) {
        if (password.trim().length < 4) {
          throw new Error('Set an admin password with at least 4 characters.');
        }
        // First-time setup in local dev mode (never hardcoded!)
        localStorage.setItem(DEV_ADMIN_HASH_KEY, inputHash);
      } else if (existingHash !== inputHash) {
        throw new Error('Incorrect admin password.');
      }
      clearDevRateLimit('admin_login');
      session.isAdmin = true;
      localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(session));
      return true;
    }

    const { error } = await sb.rpc('elevate_admin_session', { p_password: password });
    if (error) throw new Error(error.message);
    return true;
  },

  async logout(): Promise<void> {
    const sb = getSupabaseClient();
    activeSupabaseMemberId = null;
    if (!sb) {
      localStorage.removeItem(DEV_SESSION_KEY);
      return;
    }
    try {
      await sb.rpc('logout_tour_session');
    } finally {
      setStoredSessionToken(null);
    }
  },

  async fetchFullState(): Promise<FullTourState> {
    const sb = getSupabaseClient();
    if (!sb) {
      const state = loadDevDb();
      saveOfflineSnapshot({
        settings: state.settings,
        members: state.members,
        itinerary: state.itinerary,
        checklist: state.checklist,
        progress: state.progress,
        cachedAt: new Date().toISOString(),
      });
      return state;
    }

    const [
      settingsRes,
      membersRes,
      contribRes,
      expRes,
      allocRes,
      itemsRes,
      editHistRes,
      itinRes,
      chkRes,
      pollsRes,
      optsRes,
      votesRes,
      notesRes,
      photosRes,
      progRes,
      badgesRes,
      funRes,
      logRes,
    ] = await Promise.all([
      sb.from('tour_settings').select('*').eq('id', 1).single(),
      sb.from('members').select('*').order('sort_order'),
      sb.from('contributions').select('*').order('contributed_at', { ascending: false }),
      sb.from('expenses').select('*').order('expense_at', { ascending: false }),
      sb.from('expense_allocations').select('*'),
      sb.from('expense_items').select('*'),
      sb.from('expense_edit_history').select('*').order('created_at', { ascending: false }),
      sb.from('itinerary_items').select('*').order('sort_order'),
      sb.from('checklist_items').select('*').order('created_at'),
      sb.from('polls').select('*').order('created_at', { ascending: false }),
      sb.from('poll_options').select('*').order('sort_order'),
      sb.from('votes').select('*'),
      sb.from('shared_notes').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      sb.from('photos').select('*').order('created_at', { ascending: false }),
      sb.from('tour_progress').select('*').eq('id', 1).single(),
      sb.from('badges').select('*').order('awarded_at', { ascending: false }),
      sb.from('fun_events').select('*').order('created_at', { ascending: false }),
      sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(120),
    ]);

    if (membersRes.error) throw new Error(membersRes.error.message);

    const allocs = (allocRes.data || []) as ExpenseAllocation[];
    const items = (itemsRes.data || []) as ExpenseItem[];
    const edits = editHistRes.data || [];

    const expenses: Expense[] = (expRes.data || []).map((e) => ({
      ...(e as Expense),
      total_amount: Number(e.total_amount),
      allocations: allocs
        .filter((a) => a.expense_id === e.id)
        .map((a) => ({ ...a, allocated_amount: Number(a.allocated_amount) })),
      items: items
        .filter((i) => i.expense_id === e.id)
        .map((i) => ({ ...i, unit_price: Number(i.unit_price), line_total: Number(i.line_total) })),
      edit_history: edits.filter((h) => h.expense_id === e.id),
    }));

    const options = optsRes.data || [];
    const votes = votesRes.data || [];
    const polls: Poll[] = (pollsRes.data || []).map((p) => ({
      ...(p as Poll),
      options: options.filter((o) => o.poll_id === p.id),
      votes: votes.filter((v) => v.poll_id === p.id),
    }));

    const rawSettings = (settingsRes.data as TourSettings) || DEFAULT_TOUR_SETTINGS;
    let exploreFallback = rawSettings.explore_destinations;
    if (!exploreFallback) {
      try {
        const localExplore = localStorage.getItem('ek_diner_tour_explore_destinations_v1');
        if (localExplore) exploreFallback = JSON.parse(localExplore);
      } catch {
        // ignore
      }
    }

    const state: FullTourState = {
      settings: {
        ...rawSettings,
        explore_destinations:
          exploreFallback && exploreFallback.length === 4
            ? exploreFallback
            : DEFAULT_EXPLORE_DESTINATIONS,
      },
      members: (membersRes.data as Member[]) || [],
      contributions: ((contribRes.data || []) as Contribution[]).map((c) => ({
        ...c,
        amount: Number(c.amount),
      })),
      expenses,
      itinerary: ((itinRes.data || []) as ItineraryItem[]).map((i) => ({
        ...i,
        estimated_cost: Number(i.estimated_cost),
      })),
      checklist: (chkRes.data || []) as ChecklistItem[],
      polls,
      notes: (notesRes.data || []) as SharedNote[],
      photos: (photosRes.data || []) as TourPhoto[],
      progress: (progRes.data as TourProgress) || DEFAULT_TOUR_PROGRESS,
      badges: (badgesRes.data || []) as Badge[],
      funEvents: (funRes.data || []) as FunEvent[],
      activityLog: (logRes.data || []) as ActivityLogEntry[],
    };

    saveOfflineSnapshot({
      settings: state.settings,
      members: state.members,
      itinerary: state.itinerary,
      checklist: state.checklist,
      progress: state.progress,
      cachedAt: new Date().toISOString(),
    });

    return state;
  },

  // --------------------------------------------------------------------------
  // Financial Operations (Admin Only + Online Required)
  // --------------------------------------------------------------------------
  async recordContribution(input: {
    member_id: string;
    amount: number;
    payment_method: 'Cash' | 'Adjustment';
    notes: string;
    reference_code?: string;
    contributed_at?: string;
    is_correction?: boolean;
    corrects_id?: string | null;
  }): Promise<void> {
    assertOnlineForFinance();
    if (!input.amount || Number(input.amount) === 0) {
      throw new Error('Contribution amount cannot be zero.');
    }

    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevAdmin();
      const member = state.members.find((m) => m.id === input.member_id);
      if (!member) throw new Error('Member not found.');
      const newContrib: Contribution = {
        id: crypto.randomUUID(),
        member_id: input.member_id,
        amount: roundMoney(input.amount),
        payment_method: input.payment_method,
        contributed_at: input.contributed_at || new Date().toISOString(),
        notes: input.notes || '',
        reference_code: input.reference_code || '',
        is_correction: Boolean(input.is_correction),
        corrects_id: input.corrects_id || null,
        created_by: session.member.id,
        created_at: new Date().toISOString(),
      };
      state.contributions.unshift(newContrib);
      state.activityLog.unshift({
        id: crypto.randomUUID(),
        actor_member_id: session.member.id,
        action_type: input.is_correction ? 'contribution_correction' : 'contribution_recorded',
        entity_type: 'contribution',
        entity_id: newContrib.id,
        summary_bn: `${member.name_bn}-এর ৳${newContrib.amount} জমা রেকর্ড করা হয়েছে`,
        summary_en: `Recorded ৳${newContrib.amount} contribution for ${member.name_en}`,
        metadata: { amount: newContrib.amount, member_id: member.id },
        created_at: new Date().toISOString(),
      });
      saveDevDb(state);
      return;
    }

    const { error } = await sb.rpc('record_contribution', {
      p_member_id: input.member_id,
      p_amount: roundMoney(input.amount),
      p_payment_method: input.payment_method,
      p_notes: input.notes,
      p_reference_code: input.reference_code || '',
      p_contributed_at: input.contributed_at || new Date().toISOString(),
      p_is_correction: Boolean(input.is_correction),
      p_corrects_id: input.corrects_id || null,
    });
    if (error) throw new Error(error.message);
  },

  async createExpense(input: {
    title: string;
    category: ExpenseCategory;
    total_amount: number;
    funding_source: FundingSource;
    allocation_mode: AllocationMode;
    allocations: ExpenseAllocation[];
    items?: ExpenseItem[];
    payer_member_id?: string | null;
    description?: string;
    receipt_url?: string | null;
    expense_at?: string;
  }): Promise<void> {
    assertOnlineForFinance();
    const check = validateAllocationsMatchTotal(input.total_amount, input.allocations);
    if (!check.valid) {
      throw new Error(
        `Allocations sum (৳${check.allocationSum}) must match total (৳${roundMoney(input.total_amount)}).`,
      );
    }

    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevAdmin();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const newExpense: Expense = {
        id,
        title: input.title,
        category: input.category,
        expense_at: input.expense_at || now,
        total_amount: roundMoney(input.total_amount),
        description: input.description || '',
        payer_member_id: input.payer_member_id || null,
        funding_source: input.funding_source,
        allocation_mode: input.allocation_mode,
        receipt_url: input.receipt_url || null,
        is_reimbursed: false,
        is_correction: false,
        voided_by_correction: false,
        created_by: session.member.id,
        created_at: now,
        updated_at: now,
        allocations: input.allocations.map((a) => ({
          ...a,
          id: crypto.randomUUID(),
          expense_id: id,
          allocated_amount: roundMoney(a.allocated_amount),
        })),
        items: (input.items || []).map((i) => ({
          ...i,
          id: crypto.randomUUID(),
          expense_id: id,
        })),
        edit_history: [],
      };
      state.expenses.unshift(newExpense);
      state.activityLog.unshift({
        id: crypto.randomUUID(),
        actor_member_id: session.member.id,
        action_type: 'expense_created',
        entity_type: 'expense',
        entity_id: id,
        summary_bn: `নতুন খরচ যোগ হয়েছে: ${input.title} (৳${newExpense.total_amount})`,
        summary_en: `Added expense: ${input.title} (৳${newExpense.total_amount})`,
        metadata: { category: input.category, total_amount: newExpense.total_amount },
        created_at: now,
      });
      saveDevDb(state);
      return;
    }

    const { error } = await sb.rpc('create_expense_with_allocations', {
      p_title: input.title,
      p_category: input.category,
      p_total_amount: roundMoney(input.total_amount),
      p_funding_source: input.funding_source,
      p_allocation_mode: input.allocation_mode,
      p_allocations: input.allocations,
      p_items: input.items || [],
      p_payer_member_id: input.payer_member_id || null,
      p_description: input.description || '',
      p_receipt_url: input.receipt_url || null,
      p_expense_at: input.expense_at || new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  },

  async updateExpenseWithAudit(input: {
    expense_id: string;
    reason: string;
    title: string;
    category: ExpenseCategory;
    total_amount: number;
    funding_source: FundingSource;
    allocation_mode: AllocationMode;
    allocations: ExpenseAllocation[];
    items?: ExpenseItem[];
    payer_member_id?: string | null;
    description?: string;
    receipt_url?: string | null;
    is_reimbursed?: boolean;
  }): Promise<void> {
    assertOnlineForFinance();
    if (!input.reason.trim()) {
      throw new Error('An edit reason is required for the audit log.');
    }
    const check = validateAllocationsMatchTotal(input.total_amount, input.allocations);
    if (!check.valid) {
      throw new Error(
        `Allocations sum (৳${check.allocationSum}) must match total (৳${roundMoney(input.total_amount)}).`,
      );
    }

    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevAdmin();
      const idx = state.expenses.findIndex((e) => e.id === input.expense_id);
      if (idx === -1) throw new Error('Expense not found.');
      const prev = state.expenses[idx];
      const now = new Date().toISOString();
      const editEntry = {
        id: crypto.randomUUID(),
        expense_id: prev.id,
        edited_by: session.member.id,
        reason: input.reason,
        previous_snapshot: {
          title: prev.title,
          total_amount: prev.total_amount,
          allocations: prev.allocations,
        },
        new_snapshot: {
          title: input.title,
          total_amount: roundMoney(input.total_amount),
          allocations: input.allocations,
        },
        created_at: now,
      };
      state.expenses[idx] = {
        ...prev,
        title: input.title,
        category: input.category,
        total_amount: roundMoney(input.total_amount),
        funding_source: input.funding_source,
        allocation_mode: input.allocation_mode,
        payer_member_id: input.payer_member_id ?? prev.payer_member_id,
        description: input.description ?? prev.description,
        receipt_url: input.receipt_url !== undefined ? input.receipt_url : prev.receipt_url,
        is_reimbursed: input.is_reimbursed ?? prev.is_reimbursed,
        updated_at: now,
        allocations: input.allocations.map((a) => ({
          ...a,
          id: crypto.randomUUID(),
          expense_id: prev.id,
          allocated_amount: roundMoney(a.allocated_amount),
        })),
        items: input.items || prev.items,
        edit_history: [editEntry, ...(prev.edit_history || [])],
      };
      state.activityLog.unshift({
        id: crypto.randomUUID(),
        actor_member_id: session.member.id,
        action_type: 'expense_edited',
        entity_type: 'expense',
        entity_id: prev.id,
        summary_bn: `খরচ সংশোধন: ${input.title} (${input.reason})`,
        summary_en: `Edited expense ${input.title}: ${input.reason}`,
        metadata: { reason: input.reason },
        created_at: now,
      });
      saveDevDb(state);
      return;
    }

    const { error } = await sb.rpc('update_expense_with_audit', {
      p_expense_id: input.expense_id,
      p_reason: input.reason,
      p_title: input.title,
      p_category: input.category,
      p_total_amount: roundMoney(input.total_amount),
      p_funding_source: input.funding_source,
      p_allocation_mode: input.allocation_mode,
      p_allocations: input.allocations,
      p_items: input.items || [],
      p_payer_member_id: input.payer_member_id || null,
      p_description: input.description || '',
      p_is_reimbursed: Boolean(input.is_reimbursed),
    });
    if (error) throw new Error(error.message);
  },

  async voidExpenseWithAudit(expenseId: string, reason: string): Promise<void> {
    assertOnlineForFinance();
    if (!reason.trim()) {
      throw new Error('A reason is required to void/reverse an expense.');
    }
    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevAdmin();
      const idx = state.expenses.findIndex((e) => e.id === expenseId);
      if (idx === -1) throw new Error('Expense not found.');
      const prev = state.expenses[idx];
      if (prev.voided_by_correction) throw new Error('Expense is already voided.');
      const now = new Date().toISOString();
      const editEntry = {
        id: crypto.randomUUID(),
        expense_id: prev.id,
        edited_by: session.member.id,
        reason: `VOIDED: ${reason.trim()}`,
        previous_snapshot: { title: prev.title, total_amount: prev.total_amount },
        new_snapshot: { voided_by_correction: true, reason: reason.trim() },
        created_at: now,
      };
      state.expenses[idx] = {
        ...prev,
        voided_by_correction: true,
        updated_at: now,
        edit_history: [editEntry, ...(prev.edit_history || [])],
      };
      state.activityLog.unshift({
        id: crypto.randomUUID(),
        actor_member_id: session.member.id,
        action_type: 'expense_voided',
        entity_type: 'expense',
        entity_id: prev.id,
        summary_bn: `খরচ বাতিল/সংশোধন: ${prev.title} (${reason.trim()})`,
        summary_en: `Voided expense ${prev.title}: ${reason.trim()}`,
        metadata: { reason: reason.trim(), amount: prev.total_amount },
        created_at: now,
      });
      saveDevDb(state);
      return;
    }

    const { error } = await sb.rpc('void_expense_with_audit', {
      p_expense_id: expenseId,
      p_reason: reason.trim(),
    });
    if (error) throw new Error(error.message);
  },

  async uploadReceipt(file: File): Promise<string> {
    assertOnlineForFinance();
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      throw new Error('Only JPG, PNG, or WebP receipt images are allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Receipt image must be 5 MB or less.');
    }
    const sb = getSupabaseClient();
    if (!sb) {
      requireDevAdmin();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read receipt image'));
        reader.readAsDataURL(file);
      });
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage.from('tour-receipts').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { data } = sb.storage.from('tour-receipts').getPublicUrl(path);
    return data.publicUrl;
  },

  // --------------------------------------------------------------------------
  // Members, Tour Settings, Itinerary, Progress
  // --------------------------------------------------------------------------
  async updateMember(memberId: string, patch: Partial<Member>): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevMember();
      if (!session.isAdmin && session.member.id !== memberId) {
        throw new Error('You can only edit your own profile.');
      }
      state.members = state.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m));
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('members').update(patch).eq('id', memberId);
    if (error) throw new Error(error.message);
  },

  async updateTourSettings(patch: Partial<TourSettings>): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevAdmin();
      state.settings = { ...state.settings, ...patch, updated_at: new Date().toISOString() };
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('tour_settings').update(patch).eq('id', 1);
    if (error) {
      // Graceful fallback if 004_explore_destinations.sql migration has not been run on remote DB yet
      if (patch.explore_destinations && error.message.includes('explore_destinations')) {
        localStorage.setItem(
          'ek_diner_tour_explore_destinations_v1',
          JSON.stringify(patch.explore_destinations),
        );
        return;
      }
      throw new Error(error.message);
    }
    if (patch.explore_destinations) {
      localStorage.setItem(
        'ek_diner_tour_explore_destinations_v1',
        JSON.stringify(patch.explore_destinations),
      );
    }
  },

  async updateGroupPasscode(requirePasscode: boolean, newPasscode?: string): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevAdmin();
      state.settings.require_group_passcode = requirePasscode;
      if (requirePasscode && newPasscode) {
        localStorage.setItem(DEV_PASSCODE_HASH_KEY, await sha256Hex(newPasscode));
      } else if (!requirePasscode) {
        localStorage.removeItem(DEV_PASSCODE_HASH_KEY);
      }
      saveDevDb(state);
      return;
    }
    const { error } = await sb.rpc('update_group_passcode', {
      p_require: requirePasscode,
      p_new_passcode: newPasscode || null,
    });
    if (error) throw new Error(error.message);
  },

  async upsertItineraryItem(item: Partial<ItineraryItem> & { id?: string }): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevAdmin();
      if (item.id && state.itinerary.some((i) => i.id === item.id)) {
        state.itinerary = state.itinerary.map((i) => (i.id === item.id ? { ...i, ...item } : i));
      } else {
        state.itinerary.push({
          ...(item as ItineraryItem),
          id: crypto.randomUUID(),
          sort_order: item.sort_order ?? state.itinerary.length + 1,
        });
      }
      state.itinerary.sort((a, b) => a.sort_order - b.sort_order);
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('itinerary_items').upsert(item);
    if (error) throw new Error(error.message);
  },

  async deleteItineraryItem(id: string): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevAdmin();
      state.itinerary = state.itinerary.filter((i) => i.id !== id);
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('itinerary_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async updateTourProgress(patch: Partial<TourProgress>): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevAdmin();
      state.progress = {
        ...state.progress,
        ...patch,
        updated_by: session.member.id,
        updated_at: new Date().toISOString(),
      };
      state.activityLog.unshift({
        id: crypto.randomUUID(),
        actor_member_id: session.member.id,
        action_type: 'progress_updated',
        entity_type: 'tour_progress',
        summary_bn: `লাইভ আপডেট: ${state.progress.current_location_bn}`,
        summary_en: `Live status: ${state.progress.current_location_en}`,
        metadata: {},
        created_at: new Date().toISOString(),
      });
      saveDevDb(state);
      return;
    }
    const memberId = await resolveSupabaseMemberId();
    const { error } = await sb
      .from('tour_progress')
      .update({ ...patch, updated_by: memberId, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw new Error(error.message);
  },

  // --------------------------------------------------------------------------
  // Checklist, Polls, Notes, Photos, Fun Zone
  // --------------------------------------------------------------------------
  async addChecklistItem(item: Omit<ChecklistItem, 'id'>): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevMember();
      state.checklist.push({ ...item, id: crypto.randomUUID(), created_by: session.member.id });
      saveDevDb(state);
      return;
    }
    const memberId = await resolveSupabaseMemberId();
    const { error } = await sb.from('checklist_items').insert({ ...item, created_by: memberId });
    if (error) throw new Error(error.message);
  },

  async toggleChecklistItem(id: string, completed: boolean): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevMember();
      state.checklist = state.checklist.map((c) =>
        c.id === id
          ? { ...c, is_completed: completed, completed_at: completed ? new Date().toISOString() : null }
          : c,
      );
      saveDevDb(state);
      return;
    }
    const { error } = await sb
      .from('checklist_items')
      .update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteChecklistItem(id: string): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevMember();
      state.checklist = state.checklist.filter((c) => c.id !== id);
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('checklist_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async createPoll(input: {
    question_bn: string;
    question_en: string;
    description_bn: string;
    description_en: string;
    deadline?: string | null;
    allow_multiple: boolean;
    options: { label_bn: string; label_en: string }[];
  }): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevMember();
      const pollId = crypto.randomUUID();
      state.polls.unshift({
        id: pollId,
        question_bn: input.question_bn,
        question_en: input.question_en,
        description_bn: input.description_bn,
        description_en: input.description_en,
        deadline: input.deadline || null,
        is_closed: false,
        allow_multiple: input.allow_multiple,
        created_by: session.member.id,
        created_at: new Date().toISOString(),
        options: input.options.map((o, idx) => ({
          id: crypto.randomUUID(),
          poll_id: pollId,
          label_bn: o.label_bn,
          label_en: o.label_en,
          sort_order: idx + 1,
        })),
        votes: [],
      });
      saveDevDb(state);
      return;
    }

    const memberId = await resolveSupabaseMemberId();
    const { data: poll, error } = await sb
      .from('polls')
      .insert({
        question_bn: input.question_bn,
        question_en: input.question_en,
        description_bn: input.description_bn,
        description_en: input.description_en,
        deadline: input.deadline || null,
        allow_multiple: input.allow_multiple,
        created_by: memberId,
      })
      .select()
      .single();
    if (error || !poll) throw new Error(error?.message || 'Failed to create poll');

    const { error: optErr } = await sb.from('poll_options').insert(
      input.options.map((o, idx) => ({
        poll_id: poll.id,
        label_bn: o.label_bn,
        label_en: o.label_en,
        sort_order: idx + 1,
      })),
    );
    if (optErr) throw new Error(optErr.message);
  },

  async castVote(pollId: string, optionId: string, memberId: string, allowMultiple: boolean): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevMember();
      const poll = state.polls.find((p) => p.id === pollId);
      if (!poll) throw new Error('Poll not found');
      if (poll.is_closed) throw new Error('Poll is closed');
      const already = poll.votes.some((v) => v.member_id === memberId && v.option_id === optionId);
      if (!allowMultiple) {
        poll.votes = poll.votes.filter((v) => v.member_id !== memberId);
      }
      if (already) {
        poll.votes = poll.votes.filter((v) => !(v.member_id === memberId && v.option_id === optionId));
      } else {
        poll.votes.push({
          id: crypto.randomUUID(),
          poll_id: pollId,
          option_id: optionId,
          member_id: memberId,
          created_at: new Date().toISOString(),
        });
      }
      saveDevDb(state);
      return;
    }

    const { data: existing } = await sb
      .from('votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('option_id', optionId)
      .eq('member_id', memberId)
      .maybeSingle();

    if (existing) {
      const { error } = await sb.from('votes').delete().eq('id', existing.id);
      if (error) throw new Error(error.message);
      return;
    }
    if (!allowMultiple) {
      await sb.from('votes').delete().eq('poll_id', pollId).eq('member_id', memberId);
    }
    const { error } = await sb.from('votes').insert({ poll_id: pollId, option_id: optionId, member_id: memberId });
    if (error) throw new Error(error.message);
  },

  async deletePoll(pollId: string): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevAdmin();
      state.polls = state.polls.filter((p) => p.id !== pollId);
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('polls').delete().eq('id', pollId);
    if (error) throw new Error(error.message);
  },

  async togglePollClosed(pollId: string, closed: boolean): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevAdmin();
      state.polls = state.polls.map((p) => (p.id === pollId ? { ...p, is_closed: closed } : p));
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('polls').update({ is_closed: closed }).eq('id', pollId);
    if (error) throw new Error(error.message);
  },

  async addNote(input: { title: string; content: string; is_pinned?: boolean }): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevMember();
      const now = new Date().toISOString();
      state.notes.unshift({
        id: crypto.randomUUID(),
        author_id: session.member.id,
        title: input.title,
        content: input.content,
        is_pinned: Boolean(input.is_pinned && session.isAdmin),
        created_at: now,
        updated_at: now,
      });
      saveDevDb(state);
      return;
    }
    const memberId = await resolveSupabaseMemberId();
    const { error } = await sb.from('shared_notes').insert({
      author_id: memberId,
      title: input.title,
      content: input.content,
      is_pinned: Boolean(input.is_pinned),
    });
    if (error) throw new Error(error.message);
  },

  async updateNote(id: string, patch: Partial<SharedNote>): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevMember();
      state.notes = state.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n,
      );
      saveDevDb(state);
      return;
    }
    const { error } = await sb
      .from('shared_notes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deleteNote(id: string): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevMember();
      state.notes = state.notes.filter((n) => n.id !== id);
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('shared_notes').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async uploadPhoto(file: File, caption: string, tags: string[]): Promise<void> {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      throw new Error('Only JPG, PNG, or WebP images are allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be 5 MB or less.');
    }

    const sb = getSupabaseClient();
    if (!sb) {
      const { state, session } = requireDevMember();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      state.photos.unshift({
        id: crypto.randomUUID(),
        uploaded_by: session.member.id,
        storage_path: `local/${file.name}`,
        public_url: dataUrl,
        caption,
        tags,
        taken_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      saveDevDb(state);
      return;
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage.from('tour-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);

    const memberId = await resolveSupabaseMemberId();
    const { data: urlData } = sb.storage.from('tour-photos').getPublicUrl(path);
    const { error: dbErr } = await sb.from('photos').insert({
      uploaded_by: memberId,
      storage_path: path,
      public_url: urlData.publicUrl,
      caption,
      tags,
    });
    if (dbErr) throw new Error(dbErr.message);
  },

  async deletePhoto(photo: TourPhoto): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevMember();
      state.photos = state.photos.filter((p) => p.id !== photo.id);
      saveDevDb(state);
      return;
    }
    if (photo.storage_path) {
      await sb.storage.from('tour-photos').remove([photo.storage_path]);
    }
    const { error } = await sb.from('photos').delete().eq('id', photo.id);
    if (error) throw new Error(error.message);
  },

  async recordFunEvent(input: Omit<FunEvent, 'id' | 'created_at'>): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevMember();
      state.funEvents.unshift({
        ...input,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      });
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('fun_events').insert(input);
    if (error) throw new Error(error.message);
  },

  async completeFunEvent(id: string): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevMember();
      state.funEvents = state.funEvents.map((e) => (e.id === id ? { ...e, completed: true } : e));
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('fun_events').update({ completed: true }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async awardBadge(badge: Omit<Badge, 'id' | 'awarded_at'>): Promise<void> {
    const sb = getSupabaseClient();
    if (!sb) {
      const { state } = requireDevAdmin();
      state.badges.unshift({
        ...badge,
        id: crypto.randomUUID(),
        awarded_at: new Date().toISOString(),
      });
      saveDevDb(state);
      return;
    }
    const { error } = await sb.from('badges').upsert(badge, { onConflict: 'member_id,code' });
    if (error) throw new Error(error.message);
  },

  subscribeToRealtime(onChange: () => void): () => void {
    const sb = getSupabaseClient();
    if (!sb) return () => {};
    const channel = sb
      .channel('tour-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tour_progress' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_notes' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, onChange)
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  },
};
