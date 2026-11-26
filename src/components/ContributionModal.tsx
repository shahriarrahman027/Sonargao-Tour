import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Wallet, X } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { soundEngine } from '../lib/sound';
import { tourApi } from '../lib/tourApi';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ContributionModal: React.FC<Props> = ({ open, onClose }) => {
  const { lang, state, refreshState, showToast } = useTour();
  const members = state?.members || [];
  const defaultTarget = state?.settings.target_contribution_per_person ?? 1000;

  const [memberId, setMemberId] = useState(members[0]?.id || '');
  const [amount, setAmount] = useState(String(defaultTarget));
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Adjustment'>('Cash');
  const [notes, setNotes] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [isCorrection, setIsCorrection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await tourApi.recordContribution({
        member_id: memberId || members[0]?.id,
        amount: Number(amount),
        payment_method: paymentMethod,
        notes,
        reference_code: referenceCode,
        is_correction: isCorrection,
      });
      soundEngine.playCoinChime();
      void confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });
      await refreshState();
      showToast(lang === 'bn' ? 'জমা সফলভাবে রেকর্ড হয়েছে!' : 'Cash contribution recorded!');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record contribution');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#FAF7F0] dark:bg-[#131F19] border border-[#14452F]/15 dark:border-white/15 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[#14452F] dark:text-[#D4AF37]">
            <Wallet className="w-5 h-5" />
            <h3 className="font-editorial text-lg font-bold">
              {lang === 'bn' ? 'সদস্যের টাকা জমা নিন' : 'Record Member Contribution'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">
              {lang === 'bn' ? 'সদস্য নির্বাচন' : 'Member'}
            </label>
            <select
              value={memberId || members[0]?.id || ''}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3.5 py-2.5 text-sm"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {lang === 'bn' ? m.name_bn : m.name_en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold">
                {lang === 'bn' ? 'জমার পরিমাণ (৳)' : 'Amount (৳)'}
              </label>
              <div className="flex gap-1.5">
                {[500, defaultTarget, 1500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className="rounded-md bg-[#14452F]/10 dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold cursor-pointer"
                  >
                    ৳{preset}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3.5 py-2.5 text-sm font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">
                {lang === 'bn' ? 'মাধ্যম' : 'Method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Adjustment')}
                className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-sm"
              >
                <option value="Cash">{lang === 'bn' ? 'নগদ (Cash)' : 'Cash'}</option>
                <option value="Adjustment">{lang === 'bn' ? 'সমন্বয়' : 'Adjustment'}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                {lang === 'bn' ? 'রেফারেন্স (ঐচ্ছিক)' : 'Reference (Optional)'}
              </label>
              <input
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="RCPT-01"
                className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              {lang === 'bn' ? 'নোট' : 'Notes'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'bn' ? 'যেমন: সাভারে হাতে নগদ জমা' : 'e.g. Handed cash at Savar'}
              className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3.5 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isCorrection}
              onChange={(e) => setIsCorrection(e.target.checked)}
            />
            <span>{lang === 'bn' ? 'এটি একটি সংশোধন এন্ট্রি' : 'Mark as a correction entry'}</span>
          </label>

          {error && <p className="text-xs font-medium text-[#C45C3E]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl">
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#14452F] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#1B5B3E] cursor-pointer"
            >
              {saving ? '...' : lang === 'bn' ? 'জমা সংরক্ষণ করুন' : 'Save Contribution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
