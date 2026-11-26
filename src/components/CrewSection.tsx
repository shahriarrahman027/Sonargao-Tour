import React, { useState } from 'react';
import { Award, Edit3, ShieldCheck, X } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { formatBDT } from '../lib/i18n';
import { tourApi } from '../lib/tourApi';
import type { Member } from '../types/tour';

export const CrewSection: React.FC = () => {
  const { lang, state, finance, session, refreshState, showToast } = useTour();
  const [editing, setEditing] = useState<Member | null>(null);

  if (!state || !finance) return null;

  const canEdit = (m: Member) => session?.isAdmin || session?.member.id === m.id;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await tourApi.updateMember(editing.id, {
      nickname_bn: editing.nickname_bn,
      nickname_en: editing.nickname_en,
      bio_bn: editing.bio_bn,
      bio_en: editing.bio_en,
      avatar_url: editing.avatar_url || '',
    });
    await refreshState();
    setEditing(null);
    showToast(lang === 'bn' ? 'প্রোফাইল আপডেট হয়েছে' : 'Profile updated');
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
          {lang === 'bn' ? 'ভ্রমণের সঙ্গী' : 'THE CREW'}
        </span>
        <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-[#14452F] dark:text-[#FAF7F0] mt-1">
          {lang === 'bn' ? 'আমাদের ৬ জনের দল' : 'Meet the Six Friends'}
        </h2>
        <p className="text-sm text-[#4A5850] dark:text-[#B9C4BC] mt-1">
          {lang === 'bn'
            ? 'গোপনীয়তার স্বার্থে স্টুডেন্ট আইডি কখনো প্রদর্শিত হয় না।'
            : 'For privacy, university student IDs are never displayed publicly.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {state.members.map((member) => {
          const fin = finance.memberSummaries.find((s) => s.member.id === member.id);
          const badges = state.badges.filter((b) => b.member_id === member.id);
          return (
            <div
              key={member.id}
              className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name_en}
                        className="w-14 h-14 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[#14452F] text-[#FAF7F0] flex items-center justify-center font-editorial text-2xl font-bold">
                        {member.name_en.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-editorial text-xl font-bold">
                          {lang === 'bn' ? member.name_bn : member.name_en}
                        </h3>
                        {member.role === 'admin' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#C89F3C]/20 text-[#7A5B12] dark:text-[#F0D38C] px-2 py-0.5 text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            {lang === 'bn' ? 'অ্যাডমিন' : 'Treasurer'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-[#C45C3E]">
                        {lang === 'bn' ? member.nickname_bn : member.nickname_en}
                      </div>
                    </div>
                  </div>

                  {canEdit(member) && (
                    <button
                      type="button"
                      onClick={() => setEditing(member)}
                      className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="mt-4 text-sm text-[#4A5850] dark:text-[#B9C4BC] leading-relaxed">
                  {lang === 'bn' ? member.bio_bn : member.bio_en}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#14452F]/10 dark:bg-[#D4AF37]/15 text-[#14452F] dark:text-[#D4AF37] px-2.5 py-1 text-[11px] font-semibold">
                    <Award className="w-3 h-3" />
                    {lang === 'bn' ? member.badge_title_bn : member.badge_title_en}
                  </span>
                  {badges.map((b) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1 rounded-full bg-[#C89F3C]/15 text-[#7A5B12] dark:text-[#F0D38C] px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {lang === 'bn' ? b.title_bn : b.title_en}
                    </span>
                  ))}
                </div>
              </div>

              {fin && (
                <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[#5C6A62]">{lang === 'bn' ? 'জমা' : 'Paid'}</div>
                    <div className="font-bold">{formatBDT(fin.totalContributed, lang)}</div>
                  </div>
                  <div>
                    <div className="text-[#5C6A62]">{lang === 'bn' ? 'খরচ' : 'Share'}</div>
                    <div className="font-bold">{formatBDT(fin.totalAllocated, lang)}</div>
                  </div>
                  <div>
                    <div className="text-[#5C6A62]">{lang === 'bn' ? 'ব্যালেন্স' : 'Net'}</div>
                    <div
                      className={`font-bold ${
                        fin.balance >= 0 ? 'text-[#14452F] dark:text-[#A9E0BE]' : 'text-[#C45C3E]'
                      }`}
                    >
                      {formatBDT(fin.balance, lang)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Profile Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md rounded-3xl bg-[#FAF7F0] dark:bg-[#131F19] p-6 space-y-3 shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <h4 className="font-editorial text-lg font-bold">
                {lang === 'bn' ? 'প্রোফাইল সম্পাদনা' : 'Edit Member Profile'}
              </h4>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              value={editing.nickname_bn}
              onChange={(e) => setEditing({ ...editing, nickname_bn: e.target.value })}
              placeholder="Nickname (Bangla)"
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-sm"
            />
            <input
              value={editing.nickname_en}
              onChange={(e) => setEditing({ ...editing, nickname_en: e.target.value })}
              placeholder="Nickname (English)"
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-sm"
            />
            <input
              value={editing.avatar_url || ''}
              onChange={(e) => setEditing({ ...editing, avatar_url: e.target.value })}
              placeholder="Avatar Image URL (optional)"
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={editing.bio_bn}
              onChange={(e) => setEditing({ ...editing, bio_bn: e.target.value })}
              placeholder="Bio (Bangla)"
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={editing.bio_en}
              onChange={(e) => setEditing({ ...editing, bio_en: e.target.value })}
              placeholder="Bio (English)"
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-xs">
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#14452F] text-white px-5 py-2 text-xs font-bold cursor-pointer"
              >
                {lang === 'bn' ? 'সেভ করুন' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
