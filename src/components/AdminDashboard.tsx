import React, { useEffect, useState } from 'react';
import { Award, KeyRound, Save, Settings, ShieldCheck, Users } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { tourApi } from '../lib/tourApi';

export const AdminDashboard: React.FC = () => {
  const { lang, state, session, refreshState, showToast } = useTour();

  const [form, setForm] = useState(() => state?.settings);
  const [requirePasscode, setRequirePasscode] = useState(
    Boolean(state?.settings.require_group_passcode),
  );
  const [newPasscode, setNewPasscode] = useState('');
  const [badgeMemberId, setBadgeMemberId] = useState(state?.members[0]?.id || '');
  const [badgeTitleBn, setBadgeTitleBn] = useState('');
  const [badgeTitleEn, setBadgeTitleEn] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state?.settings) {
      setForm(state.settings);
      setRequirePasscode(Boolean(state.settings.require_group_passcode));
    }
  }, [state?.settings]);

  if (!state || !session?.isAdmin || !form) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto text-[#C45C3E]" />
        <h2 className="font-editorial text-2xl font-bold mt-3">
          {lang === 'bn' ? 'অ্যাডমিন অনুমোদন প্রয়োজন' : 'Admin Authorization Required'}
        </h2>
      </section>
    );
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await tourApi.updateTourSettings({
        website_name_bn: form.website_name_bn,
        website_name_en: form.website_name_en,
        tagline_bn: form.tagline_bn,
        tagline_en: form.tagline_en,
        tour_date: form.tour_date,
        start_location_bn: form.start_location_bn,
        start_location_en: form.start_location_en,
        destinations_bn: form.destinations_bn,
        destinations_en: form.destinations_en,
        estimated_budget_per_person: Number(form.estimated_budget_per_person),
        target_contribution_per_person: Number(form.target_contribution_per_person),
        budget_warning_threshold_pct: Number(form.budget_warning_threshold_pct),
        announcement_bn: form.announcement_bn,
        announcement_en: form.announcement_en,
        hero_video_url: form.hero_video_url,
      });
      await refreshState();
      showToast(lang === 'bn' ? 'ট্যুর সেটিংস সংরক্ষিত হয়েছে' : 'Tour settings updated');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    await tourApi.updateGroupPasscode(requirePasscode, newPasscode || undefined);
    setNewPasscode('');
    await refreshState();
    showToast(lang === 'bn' ? 'অ্যাক্সেস নিরাপত্তা আপডেট হয়েছে' : 'Access settings updated');
  };

  const handleAwardBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeTitleEn.trim() && !badgeTitleBn.trim()) return;
    const titleEn = badgeTitleEn.trim() || badgeTitleBn.trim();
    const titleBn = badgeTitleBn.trim() || badgeTitleEn.trim();
    await tourApi.awardBadge({
      member_id: badgeMemberId,
      code: titleEn.toUpperCase().replace(/\s+/g, '_').slice(0, 32),
      title_bn: titleBn,
      title_en: titleEn,
      description_bn: 'অ্যাডমিন প্রদত্ত বিশেষ ব্যাজ',
      description_en: 'Special badge awarded by Treasurer',
      icon: 'award',
    });
    setBadgeTitleBn('');
    setBadgeTitleEn('');
    await refreshState();
    showToast(lang === 'bn' ? 'ব্যাজ প্রদান করা হয়েছে!' : 'Badge awarded!');
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
          {lang === 'bn' ? 'শাহরিয়ার কন্ট্রোল সেন্টার' : 'SHAHRIAR CONTROL CENTER'}
        </span>
        <h2 className="font-editorial text-3xl font-bold mt-1">
          {lang === 'bn' ? 'অ্যাডমিন ড্যাশবোর্ড ও সেটিংস' : 'Admin Dashboard & Settings'}
        </h2>
      </div>

      {/* Tour Settings Form */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-6 space-y-4"
      >
        <div className="flex items-center gap-2 font-editorial text-xl font-bold">
          <Settings className="w-5 h-5 text-[#14452F] dark:text-[#D4AF37]" />
          <span>{lang === 'bn' ? 'সাধারণ ট্যুর ও বাজেট সেটিংস' : 'Tour, Dates & Budget Settings'}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Website Name (BN)</label>
            <input
              value={form.website_name_bn}
              onChange={(e) => setForm({ ...form, website_name_bn: e.target.value })}
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Website Name (EN)</label>
            <input
              value={form.website_name_en}
              onChange={(e) => setForm({ ...form, website_name_en: e.target.value })}
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Tagline (BN)</label>
            <input
              value={form.tagline_bn}
              onChange={(e) => setForm({ ...form, tagline_bn: e.target.value })}
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Tour Date &amp; Time (ISO)</label>
            <input
              value={form.tour_date}
              onChange={(e) => setForm({ ...form, tour_date: e.target.value })}
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Estimated Budget / Person (৳)</label>
            <input
              type="number"
              value={form.estimated_budget_per_person}
              onChange={(e) =>
                setForm({ ...form, estimated_budget_per_person: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Target Contribution / Person (৳)</label>
            <input
              type="number"
              value={form.target_contribution_per_person}
              onChange={(e) =>
                setForm({ ...form, target_contribution_per_person: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Announcement (BN)</label>
            <textarea
              rows={2}
              value={form.announcement_bn}
              onChange={(e) => setForm({ ...form, announcement_bn: e.target.value })}
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Announcement (EN)</label>
            <textarea
              rows={2}
              value={form.announcement_en}
              onChange={(e) => setForm({ ...form, announcement_en: e.target.value })}
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="font-semibold block mb-1">
              {lang === 'bn' ? 'হিরো ব্যাকগ্রাউন্ড ভিডিও URL (ঐচ্ছিক MP4/WebM)' : 'Hero Background Video URL (optional MP4/WebM)'}
            </label>
            <input
              value={form.hero_video_url}
              onChange={(e) => setForm({ ...form, hero_video_url: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#14452F] text-white px-5 py-2.5 text-xs font-bold cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{lang === 'bn' ? 'সেটিংস সেভ করুন' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Access & Group Passcode + Award Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveSecurity}
          className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-6 space-y-4"
        >
          <div className="flex items-center gap-2 font-editorial text-lg font-bold">
            <KeyRound className="w-5 h-5 text-[#C45C3E]" />
            <span>{lang === 'bn' ? 'অতিরিক্ত গ্রুপ পাসকোড নিরাপত্তা' : 'Shared Group Passcode'}</span>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={requirePasscode}
              onChange={(e) => setRequirePasscode(e.target.checked)}
            />
            <span>
              {lang === 'bn'
                ? 'DIU আইডির পাশাপাশি শেয়ার্ড গ্রুপ পাসকোড চালু করুন'
                : 'Require shared group passcode in addition to DIU ID'}
            </span>
          </label>
          {requirePasscode && (
            <input
              type="password"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              placeholder={lang === 'bn' ? 'নতুন গ্রুপ পাসকোড লিখুন' : 'Set new shared passcode'}
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
            />
          )}
          <button
            type="submit"
            className="rounded-xl bg-[#C45C3E] text-white px-4 py-2 text-xs font-bold cursor-pointer"
          >
            {lang === 'bn' ? 'নিরাপত্তা আপডেট করুন' : 'Update Security'}
          </button>
        </form>

        <form
          onSubmit={handleAwardBadge}
          className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-6 space-y-3"
        >
          <div className="flex items-center gap-2 font-editorial text-lg font-bold">
            <Award className="w-5 h-5 text-[#C89F3C]" />
            <span>{lang === 'bn' ? 'সদস্যকে ব্যাজ দিন' : 'Award Member Badge'}</span>
          </div>
          <select
            value={badgeMemberId}
            onChange={(e) => setBadgeMemberId(e.target.value)}
            className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
          >
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {lang === 'bn' ? m.name_bn : m.name_en}
              </option>
            ))}
          </select>
          <input
            value={badgeTitleBn}
            onChange={(e) => setBadgeTitleBn(e.target.value)}
            placeholder="Badge Title (Bangla)"
            className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
          />
          <input
            value={badgeTitleEn}
            onChange={(e) => setBadgeTitleEn(e.target.value)}
            placeholder="Badge Title (English)"
            className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-xs"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#14452F] text-white px-4 py-2 text-xs font-bold cursor-pointer"
          >
            {lang === 'bn' ? 'ব্যাজ প্রদান করুন' : 'Award Badge'}
          </button>
        </form>
      </div>

      {/* Quick Member Roster & Active Status */}
      <div className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-2 font-editorial text-lg font-bold">
          <Users className="w-5 h-5 text-[#14452F] dark:text-[#D4AF37]" />
          <span>{lang === 'bn' ? 'সদস্য ব্যবস্থাপনা' : 'Member Roster & Status'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {state.members.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-black/10 dark:border-white/10 p-3.5 flex items-center justify-between gap-2"
            >
              <div>
                <div className="font-bold">{lang === 'bn' ? m.name_bn : m.name_en}</div>
                <div className="text-[11px] text-[#5C6A62]">
                  {lang === 'bn' ? m.nickname_bn : m.nickname_en} • {m.role}
                </div>
              </div>
              {m.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() =>
                    void tourApi
                      .updateMember(m.id, { is_active: !m.is_active })
                      .then(refreshState)
                      .then(() =>
                        showToast(
                          lang === 'bn' ? 'সদস্য স্ট্যাটাস আপডেট হয়েছে' : 'Member status updated',
                        ),
                      )
                  }
                  className={`rounded-lg px-2.5 py-1 font-semibold cursor-pointer ${
                    m.is_active
                      ? 'bg-[#14452F]/12 text-[#14452F] dark:text-[#A9E0BE]'
                      : 'bg-[#C45C3E]/15 text-[#C45C3E]'
                  }`}
                >
                  {m.is_active
                    ? lang === 'bn'
                      ? 'সক্রিয়'
                      : 'Active'
                    : lang === 'bn'
                      ? 'নিষ্ক্রিয়'
                      : 'Disabled'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
