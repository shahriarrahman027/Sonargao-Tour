import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  buildPushNotificationForRecipient,
  type ContributionRow,
  type ExpenseRow,
  type MemberRow,
} from '../_shared/pushMessage.ts';
import { sendWebPushMessage, type StoredPushSubscription } from '../_shared/webpush.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tour-session, x-push-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const vapidPublicKey = (Deno.env.get('VAPID_PUBLIC_KEY') || '').trim();
  const vapidPrivateKey = (Deno.env.get('VAPID_PRIVATE_KEY') || '').trim();
  const vapidSubject = (Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@sostaytour.local').trim();
  const webhookSecret = (Deno.env.get('PUSH_WEBHOOK_SECRET') || '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Missing Supabase server credentials' });
  }
  if (!vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse(503, { error: 'VAPID keys not configured on Edge Function secrets' });
  }

  let body: {
    kind?: string;
    entityId?: string;
    eventKey?: string;
    excludeEndpoint?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON request body' });
  }

  const kind = (body.kind || '').trim();
  const entityId = (body.entityId || '').trim();
  const excludeEndpoint = (body.excludeEndpoint || '').trim();

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authorize caller strictly: either configured webhook secret OR valid active tour session
  const providedWebhook = (req.headers.get('x-push-webhook-secret') || '').trim();
  const rawToken = (req.headers.get('x-tour-session') || '').trim();

  let callerMemberId: string | null = null;
  let callerIsAdmin = false;

  if (webhookSecret && providedWebhook && providedWebhook === webhookSecret) {
    callerIsAdmin = true;
  } else {
    if (!rawToken) {
      return jsonResponse(401, { error: 'Unauthorized: Missing tour session token' });
    }
    const tokenHash = await sha256Hex(rawToken);
    const { data: sessionRow, error: sessErr } = await supabaseAdmin
      .from('auth_sessions')
      .select('member_id, is_admin, expires_at, revoked_at, members!inner(is_active)')
      .eq('session_token_hash', tokenHash)
      .eq('members.is_active', true)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (sessErr || !sessionRow) {
      return jsonResponse(401, { error: 'Unauthorized: Invalid or expired session' });
    }
    callerMemberId = sessionRow.member_id as string;
    callerIsAdmin = Boolean(sessionRow.is_admin);
  }

  // Only test notifications to caller's own devices are permitted for non-admin members;
  // all financial broadcast triggers require verified Treasurer/Admin privilege.
  if (kind !== 'test' && !callerIsAdmin) {
    return jsonResponse(403, { error: 'Forbidden: Treasurer/Admin session required to push ledger updates' });
  }

  // Fetch authoritative tour data directly from PostgreSQL
  const [membersRes, contribRes, expRes, allocRes, editRes] = await Promise.all([
    supabaseAdmin.from('members').select('id, slug, name_en, name_bn, role, is_active, push_enabled').eq('is_active', true),
    supabaseAdmin.from('contributions').select('id, member_id, amount, payment_method, is_correction, created_by, created_at'),
    supabaseAdmin.from('expenses').select('id, title, category, total_amount, payer_member_id, funding_source, is_reimbursed, voided_by_correction, created_by, created_at, updated_at'),
    supabaseAdmin.from('expense_allocations').select('expense_id, member_id, allocated_amount'),
    supabaseAdmin.from('expense_edit_history').select('id, expense_id, edited_by, reason, previous_snapshot, created_at').order('created_at', { ascending: false }),
  ]);

  if (membersRes.error) {
    return jsonResponse(500, { error: membersRes.error.message });
  }

  const members = (membersRes.data || []) as Array<MemberRow & { push_enabled?: boolean }>;
  const contributions = ((contribRes.data || []) as ContributionRow[]).map((c) => ({
    ...c,
    amount: Number(c.amount),
  }));
  const allocs = (allocRes.data || []) as Array<{ expense_id: string; member_id: string; allocated_amount: number }>;
  const edits = (editRes.data || []) as Array<{ id: string; expense_id: string; edited_by: string; reason: string; previous_snapshot?: Record<string, unknown>; created_at: string }>;

  const expenses: ExpenseRow[] = ((expRes.data || []) as ExpenseRow[]).map((e) => ({
    ...e,
    total_amount: Number(e.total_amount),
    allocations: allocs
      .filter((a) => a.expense_id === e.id)
      .map((a) => ({ member_id: a.member_id, allocated_amount: Number(a.allocated_amount) })),
    edit_history: edits.filter((h) => h.expense_id === e.id),
  }));

  let canonicalEventKey = body.eventKey?.trim() || `push:${kind}:${Date.now()}`;
  let targetContribution: ContributionRow | null = null;
  let targetExpense: ExpenseRow | null = null;
  let resolvedKind = kind;

  if (kind === 'contribution_added' || kind === 'contribution_refund') {
    targetContribution = contributions.find((c) => c.id === entityId) || null;
    if (!targetContribution) {
      return jsonResponse(404, { error: 'Referenced contribution not found in database' });
    }
    canonicalEventKey = `contrib:${targetContribution.id}`;
  } else if (kind !== 'test') {
    targetExpense = expenses.find((e) => e.id === entityId) || null;
    if (!targetExpense) {
      return jsonResponse(404, { error: 'Referenced expense not found in database' });
    }
    if (targetExpense.voided_by_correction || kind === 'expense_voided') {
      canonicalEventKey = `expense_void:${targetExpense.id}`;
      resolvedKind = 'expense_voided';
    } else if (kind === 'expense_updated' || kind === 'expense_reimbursed') {
      const latestEdit = targetExpense.edit_history?.[0];
      canonicalEventKey = latestEdit ? `expense_edit:${latestEdit.id}` : `expense_edit:${targetExpense.id}:${targetExpense.updated_at}`;
    } else {
      canonicalEventKey = `expense:${targetExpense.id}`;
      resolvedKind = 'expense_created';
    }
  }

  // Deduplicate financial push deliveries at DB level (skip dedupe check for explicit test pushes)
  if (resolvedKind !== 'test') {
    const { error: dedupeErr } = await supabaseAdmin
      .from('push_delivery_log')
      .insert({
        event_key: canonicalEventKey,
        triggered_by: callerMemberId,
        event_kind: resolvedKind,
      });

    if (dedupeErr) {
      if (dedupeErr.code === '23505') {
        return jsonResponse(200, { ok: true, skipped: 'duplicate', eventKey: canonicalEventKey });
      }
      return jsonResponse(500, { error: dedupeErr.message });
    }
  }

  // Load active push subscriptions respecting member and device notification opt-ins
  let subQuery = supabaseAdmin
    .from('push_subscriptions')
    .select('id, member_id, endpoint, p256dh, auth')
    .eq('notifications_enabled', true);

  if (resolvedKind === 'test' && callerMemberId) {
    subQuery = subQuery.eq('member_id', callerMemberId);
  }

  const { data: rawSubs, error: subErr } = await subQuery;
  if (subErr) {
    return jsonResponse(500, { error: subErr.message });
  }

  const enabledMemberIds = new Set(
    members.filter((m) => m.push_enabled !== false).map((m) => m.id),
  );

  const subscriptions = ((rawSubs || []) as StoredPushSubscription[]).filter(
    (s) =>
      enabledMemberIds.has(s.member_id) &&
      (resolvedKind === 'test' || !excludeEndpoint || s.endpoint !== excludeEndpoint),
  );

  const vapid = {
    subject: vapidSubject,
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
  };

  const results = await Promise.allSettled(
    subscriptions.map((sub) => {
      const recipientMember = members.find((m) => m.id === sub.member_id)!;
      const pushPayload = buildPushNotificationForRecipient({
        kind: resolvedKind,
        eventKey: canonicalEventKey,
        recipientMember,
        members,
        contributions,
        expenses,
        targetContribution,
        targetExpense,
      });
      return sendWebPushMessage({
        subscription: sub,
        payload: pushPayload as unknown as Record<string, unknown>,
        vapid,
      });
    }),
  );

  const expiredIds: string[] = [];
  const succeededIds: string[] = [];
  const transientFailedIds: string[] = [];

  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    const item = res.value;
    if (item.ok) {
      succeededIds.push(item.subscriptionId);
    } else if (item.expired) {
      expiredIds.push(item.subscriptionId);
    } else {
      transientFailedIds.push(item.subscriptionId);
    }
  }

  // Automatically remove expired/unregistered subscriptions (404 / 410 / malformed)
  if (expiredIds.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('id', expiredIds);
  }

  if (succeededIds.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({ failure_count: 0, last_success_at: new Date().toISOString() })
      .in('id', succeededIds);
  }

  if (transientFailedIds.length > 0) {
    const { data: failedRows } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, failure_count')
      .in('id', transientFailedIds);
    for (const row of failedRows || []) {
      const nextCount = Number(row.failure_count || 0) + 1;
      if (nextCount >= 5) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', row.id);
      } else {
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ failure_count: nextCount })
          .eq('id', row.id);
      }
    }
  }

  if (resolvedKind !== 'test') {
    await supabaseAdmin
      .from('push_delivery_log')
      .update({
        sent_count: succeededIds.length,
        pruned_count: expiredIds.length,
      })
      .eq('event_key', canonicalEventKey);
  }

  return jsonResponse(200, {
    ok: true,
    eventKey: canonicalEventKey,
    targeted: subscriptions.length,
    sent: succeededIds.length,
    pruned: expiredIds.length,
    failed: transientFailedIds.length,
  });
});
