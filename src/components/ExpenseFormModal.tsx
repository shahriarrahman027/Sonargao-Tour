import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Trash2, X } from 'lucide-react';
import { useTour } from '../context/TourContext';
import {
  computeEqualAllocations,
  EXPENSE_CATEGORIES,
  roundMoney,
  validateAllocationsMatchTotal,
} from '../lib/accounting';
import { CATEGORY_LABELS, formatBDT } from '../lib/i18n';
import { soundEngine } from '../lib/sound';
import { tourApi } from '../lib/tourApi';
import type {
  AllocationMode,
  Expense,
  ExpenseAllocation,
  ExpenseCategory,
  ExpenseItem,
  FundingSource,
} from '../types/tour';

interface Props {
  open: boolean;
  editingExpense?: Expense | null;
  onClose: () => void;
}

export const ExpenseFormModal: React.FC<Props> = ({ open, editingExpense, onClose }) => {
  const { lang, state, refreshState, showToast } = useTour();
  const members = state?.members || [];

  const [title, setTitle] = useState(editingExpense?.title || '');
  const [category, setCategory] = useState<ExpenseCategory>(editingExpense?.category || 'Food');
  const [fundingSource, setFundingSource] = useState<FundingSource>(
    editingExpense?.funding_source || 'group_cash',
  );
  const [payerMemberId, setPayerMemberId] = useState<string>(
    editingExpense?.payer_member_id || members[0]?.id || '',
  );
  const [allocationMode, setAllocationMode] = useState<AllocationMode>(
    editingExpense?.allocation_mode || 'equal',
  );
  const [description, setDescription] = useState(editingExpense?.description || '');
  const [receiptUrl, setReceiptUrl] = useState(editingExpense?.receipt_url || '');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [isReimbursed, setIsReimbursed] = useState(Boolean(editingExpense?.is_reimbursed));

  // Equal mode state
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    editingExpense
      ? editingExpense.allocations.map((a) => a.member_id)
      : members.map((m) => m.id),
  );
  const [equalInputMode, setEqualInputMode] = useState<'total' | 'per_person'>('total');
  const [equalTotal, setEqualTotal] = useState<string>(
    editingExpense ? String(editingExpense.total_amount) : '',
  );
  const [equalPerPerson, setEqualPerPerson] = useState<string>('');

  // Custom mode: individual direct amounts OR itemized bill lines
  const [customTab, setCustomTab] = useState<'direct' | 'items'>(
    editingExpense && editingExpense.items.length > 0 ? 'items' : 'direct',
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => {
      const found = editingExpense?.allocations.find((a) => a.member_id === m.id);
      map[m.id] = found ? String(found.allocated_amount) : '';
    });
    return map;
  });
  const [customNotes, setCustomNotes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => {
      const found = editingExpense?.allocations.find((a) => a.member_id === m.id);
      map[m.id] = found?.note || '';
    });
    return map;
  });
  const [items, setItems] = useState<ExpenseItem[]>(() =>
    editingExpense?.items.length
      ? editingExpense.items
      : [{ member_id: members[0]?.id || '', item_name: '', quantity: 1, unit_price: 0, line_total: 0 }],
  );
  const [manualTotalOverride, setManualTotalOverride] = useState<string>(
    editingExpense ? String(editingExpense.total_amount) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedEqualTotal = useMemo(() => {
    if (equalInputMode === 'per_person') {
      return roundMoney((Number(equalPerPerson) || 0) * selectedIds.length);
    }
    return roundMoney(Number(equalTotal) || 0);
  }, [equalInputMode, equalPerPerson, equalTotal, selectedIds.length]);

  const computedCustomAllocations: ExpenseAllocation[] = useMemo(() => {
    if (allocationMode === 'equal') {
      return computeEqualAllocations(computedEqualTotal, selectedIds);
    }

    if (customTab === 'items') {
      const perMember = new Map<string, { amount: number; notes: string[] }>();
      for (const item of items) {
        if (!item.member_id || Number(item.line_total) <= 0) continue;
        const curr = perMember.get(item.member_id) || { amount: 0, notes: [] };
        curr.amount = roundMoney(curr.amount + Number(item.line_total));
        if (item.item_name.trim()) {
          curr.notes.push(
            item.quantity > 1 ? `${item.item_name} ×${item.quantity}` : item.item_name,
          );
        }
        perMember.set(item.member_id, curr);
      }
      return Array.from(perMember.entries()).map(([member_id, val]) => ({
        member_id,
        allocated_amount: val.amount,
        note: val.notes.join(', '),
      }));
    }

    return members
      .filter((m) => Number(customAmounts[m.id] || 0) > 0)
      .map((m) => ({
        member_id: m.id,
        allocated_amount: roundMoney(Number(customAmounts[m.id]) || 0),
        note: customNotes[m.id] || '',
      }));
  }, [
    allocationMode,
    computedEqualTotal,
    selectedIds,
    customTab,
    items,
    members,
    customAmounts,
    customNotes,
  ]);

  const allocationsSum = roundMoney(
    computedCustomAllocations.reduce((s, a) => s + a.allocated_amount, 0),
  );

  const effectiveTotal =
    allocationMode === 'equal'
      ? computedEqualTotal
      : manualTotalOverride.trim() !== ''
        ? roundMoney(Number(manualTotalOverride) || 0)
        : allocationsSum;

  const validation = validateAllocationsMatchTotal(effectiveTotal, computedCustomAllocations);

  if (!open) return null;

  const toggleParticipant = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const updateItemRow = (index: number, patch: Partial<ExpenseItem>) => {
    setItems((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const next = { ...row, ...patch };
        next.line_total = roundMoney((Number(next.quantity) || 1) * (Number(next.unit_price) || 0));
        return next;
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(lang === 'bn' ? 'খরচের শিরোনাম লিখুন।' : 'Please enter an expense title.');
      return;
    }
    if (!validation.valid) {
      setError(
        lang === 'bn'
          ? `মোট খরচ (${formatBDT(effectiveTotal, lang)}) এবং সদস্যদের বণ্টনের যোগফল (${formatBDT(validation.allocationSum, lang)}) অবশ্যই সমান হতে হবে!`
          : `Allocation sum (${formatBDT(validation.allocationSum, lang)}) must match expense total (${formatBDT(effectiveTotal, lang)}).`,
      );
      return;
    }

    setSaving(true);
    try {
      const cleanItems =
        allocationMode === 'custom' && customTab === 'items'
          ? items.filter((i) => i.item_name.trim() && i.line_total > 0)
          : [];

      if (editingExpense) {
        await tourApi.updateExpenseWithAudit({
          expense_id: editingExpense.id,
          reason: editReason,
          title: title.trim(),
          category,
          total_amount: effectiveTotal,
          funding_source: fundingSource,
          allocation_mode: allocationMode,
          allocations: computedCustomAllocations,
          items: cleanItems,
          payer_member_id: fundingSource === 'personal_payer' ? payerMemberId : null,
          description: description.trim(),
          receipt_url: receiptUrl.trim() || null,
          is_reimbursed: isReimbursed,
        });
      } else {
        await tourApi.createExpense({
          title: title.trim(),
          category,
          total_amount: effectiveTotal,
          funding_source: fundingSource,
          allocation_mode: allocationMode,
          allocations: computedCustomAllocations,
          items: cleanItems,
          payer_member_id: fundingSource === 'personal_payer' ? payerMemberId : null,
          description: description.trim(),
          receipt_url: receiptUrl.trim() || null,
        });
      }

      soundEngine.playExpenseStamp();
      await refreshState();
      showToast(
        editingExpense
          ? lang === 'bn'
            ? 'খরচ অডিটসহ আপডেট হয়েছে'
            : 'Expense updated with audit record'
          : lang === 'bn'
            ? 'নতুন খরচ সফলভাবে রেকর্ড হয়েছে'
            : 'Expense recorded cleanly',
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#FAF7F0] dark:bg-[#131F19] border border-[#14452F]/15 dark:border-white/15 p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#14452F]/10 dark:border-white/10">
          <h3 className="font-editorial text-xl font-bold text-[#14452F] dark:text-[#FAF7F0]">
            {editingExpense
              ? lang === 'bn'
                ? 'খরচ সংশোধন (অডিট লগসহ)'
                : 'Edit Expense (Audited)'
              : lang === 'bn'
                ? 'নতুন খরচ যোগ করুন'
                : 'Record New Expense'}
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                {lang === 'bn' ? 'খরচের শিরোনাম' : 'Expense Title'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: নাজিরাবাজার বিরিয়ানি ডিনার' : 'e.g. Nazirabazar Biriyani Dinner'}
                className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                {lang === 'bn' ? 'খাত (Category)' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2.5 text-sm"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c][lang]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Funding Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">
                {lang === 'bn' ? 'টাকা পরিশোধের উৎস' : 'Funding Source'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFundingSource('group_cash')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                    fundingSource === 'group_cash'
                      ? 'bg-[#14452F] text-white border-[#14452F]'
                      : 'border-[#14452F]/20 dark:border-white/15'
                  }`}
                >
                  {lang === 'bn' ? 'গ্রুপ ক্যাশ' : 'Group Cash'}
                </button>
                <button
                  type="button"
                  onClick={() => setFundingSource('personal_payer')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                    fundingSource === 'personal_payer'
                      ? 'bg-[#C45C3E] text-white border-[#C45C3E]'
                      : 'border-[#14452F]/20 dark:border-white/15'
                  }`}
                >
                  {lang === 'bn' ? 'ব্যক্তিগত পরিশোধ' : 'Personal Payer'}
                </button>
              </div>
            </div>

            {fundingSource === 'personal_payer' && (
              <div>
                <label className="block text-xs font-semibold mb-1">
                  {lang === 'bn' ? 'কে টাকা দিয়েছেন?' : 'Who paid personally?'}
                </label>
                <select
                  value={payerMemberId}
                  onChange={(e) => setPayerMemberId(e.target.value)}
                  className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-sm"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {lang === 'bn' ? m.name_bn : m.name_en}
                    </option>
                  ))}
                </select>
                {editingExpense && (
                  <label className="mt-1.5 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={isReimbursed}
                      onChange={(e) => setIsReimbursed(e.target.checked)}
                    />
                    <span>
                      {lang === 'bn' ? 'গ্রুপ ক্যাশ থেকে ফেরত দেওয়া হয়েছে' : 'Marked reimbursed from Group Cash'}
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Allocation Mode Switch */}
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              {lang === 'bn' ? 'বণ্টন পদ্ধতি (Allocation Mode)' : 'Allocation Mode'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAllocationMode('equal')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                  allocationMode === 'equal'
                    ? 'bg-[#14452F] text-white border-[#14452F]'
                    : 'border-[#14452F]/20 dark:border-white/15'
                }`}
              >
                {lang === 'bn' ? 'সমান ভাগ (যেমন: টিকিট/বাস)' : 'Mode 1: Equal Split'}
              </button>
              <button
                type="button"
                onClick={() => setAllocationMode('custom')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                  allocationMode === 'custom'
                    ? 'bg-[#14452F] text-white border-[#14452F]'
                    : 'border-[#14452F]/20 dark:border-white/15'
                }`}
              >
                {lang === 'bn' ? 'কাস্টম / আলাদা অর্ডার (খাবার)' : 'Mode 2: Custom / Food Orders'}
              </button>
            </div>
          </div>

          {/* Mode 1: Equal Allocation */}
          {allocationMode === 'equal' ? (
            <div className="rounded-2xl bg-white dark:bg-[#0D1511] border border-[#14452F]/12 dark:border-white/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  {lang === 'bn' ? 'অংশগ্রহণকারী নির্বাচন করুন:' : 'Select Participants:'}
                </span>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedIds(members.map((m) => m.id))}
                    className="text-[#14452F] dark:text-[#D4AF37] font-semibold underline cursor-pointer"
                  >
                    {lang === 'bn' ? 'সবাই (৬ জন)' : 'All (6)'}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const selected = selectedIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleParticipant(m.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                        selected
                          ? 'bg-[#14452F] text-white border-[#14452F]'
                          : 'border-[#14452F]/20 dark:border-white/15 opacity-60'
                      }`}
                    >
                      {lang === 'bn' ? m.name_bn : m.name_en}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold mb-1">
                    <input
                      type="radio"
                      checked={equalInputMode === 'total'}
                      onChange={() => setEqualInputMode('total')}
                    />
                    {lang === 'bn' ? 'মোট বিল লিখুন (৳)' : 'Enter Total Bill (৳)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={equalInputMode !== 'total'}
                    value={equalTotal}
                    onChange={(e) => setEqualTotal(e.target.value)}
                    placeholder="120"
                    className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-transparent px-3 py-2 text-sm disabled:opacity-45"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold mb-1">
                    <input
                      type="radio"
                      checked={equalInputMode === 'per_person'}
                      onChange={() => setEqualInputMode('per_person')}
                    />
                    {lang === 'bn' ? 'অথবা প্রতিজন খরচ (৳)' : 'Or Per-Person Cost (৳)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={equalInputMode !== 'per_person'}
                    value={equalPerPerson}
                    onChange={(e) => setEqualPerPerson(e.target.value)}
                    placeholder="20"
                    className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-transparent px-3 py-2 text-sm disabled:opacity-45"
                  />
                </div>
              </div>
              {selectedIds.length > 0 && computedEqualTotal > 0 && (
                <div className="text-xs text-[#4A5850] dark:text-[#B9C4BC]">
                  {lang === 'bn'
                    ? `প্রতিজনের অংশ: ~${formatBDT(roundMoney(computedEqualTotal / selectedIds.length), lang)} × ${selectedIds.length} জন = ${formatBDT(computedEqualTotal, lang)}`
                    : `Per person: ~${formatBDT(roundMoney(computedEqualTotal / selectedIds.length), lang)} × ${selectedIds.length} = ${formatBDT(computedEqualTotal, lang)}`}
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Custom / Restaurant Itemized Orders */
            <div className="rounded-2xl bg-white dark:bg-[#0D1511] border border-[#14452F]/12 dark:border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomTab('direct')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      customTab === 'direct'
                        ? 'bg-[#14452F]/12 text-[#14452F] dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                        : 'opacity-70'
                    }`}
                  >
                    {lang === 'bn' ? 'জনপ্রতি সরাসরি টাকা' : 'Per-Member Amount'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTab('items')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      customTab === 'items'
                        ? 'bg-[#14452F]/12 text-[#14452F] dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                        : 'opacity-70'
                    }`}
                  >
                    {lang === 'bn' ? 'আইটেম ধরে রেস্টুরেন্ট বিল' : 'Itemized Restaurant Bill'}
                  </button>
                </div>
              </div>

              {customTab === 'direct' ? (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                      <span className="col-span-4 text-xs font-semibold truncate">
                        {lang === 'bn' ? m.name_bn : m.name_en}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={customAmounts[m.id] || ''}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder="৳ 0"
                        className="col-span-3 rounded-lg border border-[#14452F]/20 dark:border-white/15 bg-transparent px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={customNotes[m.id] || ''}
                        onChange={(e) =>
                          setCustomNotes((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder={lang === 'bn' ? 'যেমন: হাফ বিরিয়ানি' : 'e.g. Half biriyani'}
                        className="col-span-5 rounded-lg border border-[#14452F]/20 dark:border-white/15 bg-transparent px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {items.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                      <select
                        value={row.member_id || ''}
                        onChange={(e) => updateItemRow(idx, { member_id: e.target.value })}
                        className="col-span-3 rounded-lg border border-[#14452F]/20 dark:border-white/15 bg-transparent px-2 py-1.5 text-xs"
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {lang === 'bn' ? m.name_bn : m.name_en}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={row.item_name}
                        onChange={(e) => updateItemRow(idx, { item_name: e.target.value })}
                        placeholder={lang === 'bn' ? 'আইটেম (যেমন: ফুল বিরিয়ানি)' : 'Item (e.g. Full Biriyani)'}
                        className="col-span-4 rounded-lg border border-[#14452F]/20 dark:border-white/15 bg-transparent px-2 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => updateItemRow(idx, { quantity: Number(e.target.value) || 1 })}
                        className="col-span-2 rounded-lg border border-[#14452F]/20 dark:border-white/15 bg-transparent px-2 py-1.5 text-xs"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unit_price || ''}
                        onChange={(e) =>
                          updateItemRow(idx, { unit_price: Number(e.target.value) || 0 })
                        }
                        placeholder="৳"
                        className="col-span-2 rounded-lg border border-[#14452F]/20 dark:border-white/15 bg-transparent px-2 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 flex justify-center text-[#C45C3E] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) => [
                        ...prev,
                        {
                          member_id: members[0]?.id || '',
                          item_name: '',
                          quantity: 1,
                          unit_price: 0,
                          line_total: 0,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#14452F] dark:text-[#D4AF37] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'আরেকটি আইটেম যোগ করুন' : 'Add another order item'}
                  </button>
                </div>
              )}

              {/* Optional Total Check Override */}
              <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#4A5850] dark:text-[#B9C4BC]">
                  {lang === 'bn'
                    ? 'বিলের মোট (খালি রাখলে অটো যোগ হবে):'
                    : 'Receipt Total (auto-sums if blank):'}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualTotalOverride}
                  onChange={(e) => setManualTotalOverride(e.target.value)}
                  placeholder={String(allocationsSum || 0)}
                  className="w-32 rounded-lg border border-[#14452F]/20 dark:border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-right"
                />
              </div>
            </div>
          )}

          {/* Description, Receipt & Edit Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">
                {lang === 'bn' ? 'নোট / বিবরণ' : 'Notes / Description'}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={lang === 'bn' ? 'ঐচ্ছিক নোট...' : 'Optional notes...'}
                className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                {lang === 'bn' ? 'রসিদ / বিলের ছবি (ঐচ্ছিক)' : 'Receipt Image (Optional)'}
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingReceipt}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingReceipt(true);
                  setError(null);
                  try {
                    const url = await tourApi.uploadReceipt(file);
                    setReceiptUrl(url);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Receipt upload failed');
                  } finally {
                    setUploadingReceipt(false);
                  }
                }}
                className="w-full rounded-xl border border-dashed border-[#14452F]/25 dark:border-white/20 px-3 py-1.5 text-xs"
              />
              {receiptUrl && (
                <span className="text-[11px] text-[#14452F] dark:text-[#A9E0BE] font-semibold">
                  {lang === 'bn' ? '✓ রসিদ সংযুক্ত হয়েছে' : '✓ Receipt attached'}
                </span>
              )}
            </div>
          </div>

          {editingExpense && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-[#C45C3E]">
                {lang === 'bn' ? 'সংশোধনের কারণ (বাধ্যতামূলক)' : 'Reason for Edit (Required for Audit)'}
              </label>
              <input
                type="text"
                required
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: বিলের ভুল সংশোধন' : 'e.g. Fixed item price'}
                className="w-full rounded-xl border border-[#C45C3E]/40 bg-white dark:bg-[#0D1511] px-3.5 py-2 text-sm"
              />
            </div>
          )}

          {/* Live Validation Banner */}
          <div
            className={`rounded-xl px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 ${
              validation.valid
                ? 'bg-[#14452F]/10 text-[#14452F] dark:bg-[#1D5E41]/30 dark:text-[#A9E0BE]'
                : 'bg-[#C45C3E]/12 text-[#9D3B20] dark:text-[#F49B82]'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {validation.valid ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>
                {validation.valid
                  ? lang === 'bn'
                    ? 'বণ্টন ও মোট খরচ মিলেছে'
                    : 'Allocations match expense total'
                  : lang === 'bn'
                    ? 'বণ্টনের যোগফল মোট বিলের সাথে মেলেনি'
                    : 'Allocation sum must match total'}
              </span>
            </div>
            <span className="font-mono font-bold">
              {formatBDT(validation.allocationSum, lang)} / {formatBDT(effectiveTotal, lang)}
            </span>
          </div>

          {error && (
            <div className="rounded-xl bg-[#C45C3E]/15 px-3.5 py-2 text-xs font-medium text-[#9D3B20] dark:text-[#F49B82]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving || !validation.valid}
              className="rounded-xl bg-[#14452F] hover:bg-[#1B5B3E] disabled:opacity-50 text-white px-5 py-2.5 text-sm font-semibold cursor-pointer"
            >
              {saving
                ? lang === 'bn'
                  ? 'সংরক্ষণ হচ্ছে...'
                  : 'Saving...'
                : lang === 'bn'
                  ? 'খরচ সংরক্ষণ করুন'
                  : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
