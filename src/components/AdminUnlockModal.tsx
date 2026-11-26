import React, { useState } from 'react';
import { Lock, ShieldAlert, X } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { tourApi } from '../lib/tourApi';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const AdminUnlockModal: React.FC<Props> = ({ open, onClose }) => {
  const { lang, session, elevateAdmin, isSupabaseMode, showToast } = useTour();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !session) return null;

  const isFirstDevSetup = !isSupabaseMode && !tourApi.hasDevAdminConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await elevateAdmin(password);
      showToast(lang === 'bn' ? 'অ্যাডমিন ড্যাশবোর্ড আনলক হয়েছে' : 'Admin Dashboard unlocked');
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#FAF7F0] dark:bg-[#131F19] border border-[#14452F]/15 dark:border-white/15 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[#14452F] dark:text-[#D4AF37]">
            <Lock className="w-5 h-5" />
            <h3 className="font-editorial text-lg font-bold">
              {lang === 'bn' ? 'শাহরিয়ার — অ্যাডমিন যাচাইকরণ' : 'Shahriar — Admin Verification'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {session.member.role !== 'admin' ? (
          <div className="rounded-xl bg-[#C45C3E]/12 border border-[#C45C3E]/30 p-4 text-sm text-[#9D3B20] dark:text-[#F49B82] flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              {lang === 'bn'
                ? 'শুধুমাত্র ট্রেজারার ও অ্যাডমিন (শাহরিয়ার) অ্যাডমিন ড্যাশবোর্ড ব্যবহার করতে পারবেন।'
                : 'Only Treasurer/Admin (Shahriar) is authorized to unlock Admin Mode.'}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-[#4A5850] dark:text-[#B9C4BC]">
              {isFirstDevSetup
                ? lang === 'bn'
                  ? 'ডেভেলপমেন্ট মোডে প্রথমবার ব্যবহারের জন্য একটি অ্যাডমিন পাসওয়ার্ড সেট করুন (কমপক্ষে ৪ অক্ষর)।'
                  : 'First-time Local Dev setup: choose an Admin Password to protect financial writes (min 4 chars).'
                : lang === 'bn'
                  ? 'টাকা-পয়সা ও সেটিংস সম্পাদনা করতে আপনার অ্যাডমিন পাসওয়ার্ড দিন।'
                  : 'Enter your Admin Password to unlock financial and management controls.'}
            </p>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={lang === 'bn' ? 'অ্যাডমিন পাসওয়ার্ড' : 'Admin password'}
              className="w-full rounded-xl border border-[#14452F]/20 dark:border-white/15 bg-white dark:bg-[#0D1511] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#14452F]"
            />
            {error && (
              <p className="text-xs font-medium text-[#C45C3E] dark:text-[#F49B82]">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#14452F] text-[#FAF7F0] px-5 py-2.5 text-sm font-semibold hover:bg-[#1B5B3E] disabled:opacity-60 cursor-pointer"
              >
                {loading
                  ? lang === 'bn'
                    ? 'যাচাই হচ্ছে...'
                    : 'Verifying...'
                  : isFirstDevSetup
                    ? lang === 'bn'
                      ? 'সেট ও আনলক করুন'
                      : 'Set & Unlock'
                    : lang === 'bn'
                      ? 'আনলক করুন'
                      : 'Unlock'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
