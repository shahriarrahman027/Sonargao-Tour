import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { soundEngine } from '../lib/sound';
import { tourApi } from '../lib/tourApi';

export const ChecklistSection: React.FC = () => {
  const { lang, state, session, refreshState } = useTour();
  const [scope, setScope] = useState<'group' | 'personal'>('group');
  const [title, setTitle] = useState('');
  const [dueLabel, setDueLabel] = useState('');
  const [responsibleId, setResponsibleId] = useState('');

  if (!state || !session) return null;

  const items = state.checklist.filter((c) => {
    if (c.scope !== scope) return false;
    if (scope === 'personal' && c.owner_member_id && c.owner_member_id !== session.member.id) {
      return false;
    }
    return true;
  });

  const completed = items.filter((i) => i.is_completed).length;
  const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  const memberName = (id?: string | null) => {
    if (!id) return '';
    const m = state.members.find((x) => x.id === id);
    return m ? (lang === 'bn' ? m.name_bn : m.name_en) : '';
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await tourApi.addChecklistItem({
      scope,
      title_bn: title.trim(),
      title_en: title.trim(),
      responsible_member_id: scope === 'group' ? responsibleId || null : null,
      owner_member_id: scope === 'personal' ? session.member.id : null,
      is_completed: false,
      due_label: dueLabel.trim(),
    });
    setTitle('');
    setDueLabel('');
    soundEngine.playTick();
    await refreshState();
  };

  const handleToggle = async (id: string, nextVal: boolean) => {
    await tourApi.toggleChecklistItem(id, nextVal);
    if (nextVal) {
      soundEngine.playTick();
      if (completed + 1 === items.length && items.length > 0) {
        soundEngine.playCelebration();
        void confetti({ particleCount: 50, spread: 60 });
      }
    }
    await refreshState();
  };

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
          {lang === 'bn' ? 'প্রস্তুতি চেকলিস্ট' : 'TOUR CHECKLIST'}
        </span>
        <h2 className="font-editorial text-3xl font-bold mt-1">
          {lang === 'bn' ? 'যাত্রার আগের প্রস্তুতি (অফলাইনেও চলবে)' : 'Group & Personal Packing List'}
        </h2>
      </div>

      {/* Scope Toggle & Progress */}
      <div className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScope('group')}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                scope === 'group' ? 'bg-[#14452F] text-white' : 'bg-black/5 dark:bg-white/10'
              }`}
            >
              {lang === 'bn' ? 'গ্রুপ চেকলিস্ট' : 'Group Checklist'}
            </button>
            <button
              type="button"
              onClick={() => setScope('personal')}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                scope === 'personal' ? 'bg-[#14452F] text-white' : 'bg-black/5 dark:bg-white/10'
              }`}
            >
              {lang === 'bn' ? 'ব্যক্তিগত প্যাকিং' : 'My Packing List'}
            </button>
          </div>
          <span className="text-xs font-bold text-[#14452F] dark:text-[#A9E0BE]">
            {completed}/{items.length} ({pct}%)
          </span>
        </div>

        <div className="h-2.5 rounded-full bg-black/8 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[#14452F] dark:bg-[#D4AF37] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={lang === 'bn' ? 'নতুন আইটেম যোগ করুন...' : 'Add checklist item...'}
            className="sm:col-span-6 rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          {scope === 'group' && (
            <select
              value={responsibleId}
              onChange={(e) => setResponsibleId(e.target.value)}
              className="sm:col-span-3 rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-2.5 py-2 text-xs"
            >
              <option value="">{lang === 'bn' ? 'দায়িত্বপ্রাপ্ত (ঐচ্ছিক)' : 'Assignee (opt.)'}</option>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {lang === 'bn' ? m.name_bn : m.name_en}
                </option>
              ))}
            </select>
          )}
          <input
            value={dueLabel}
            onChange={(e) => setDueLabel(e.target.value)}
            placeholder={lang === 'bn' ? 'সময় (ঐচ্ছিক)' : 'Due'}
            className={`${scope === 'group' ? 'sm:col-span-2' : 'sm:col-span-4'} rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-xs`}
          />
          <button
            type="submit"
            className="sm:col-span-1 rounded-xl bg-[#14452F] text-white flex items-center justify-center py-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Items */}
      <div className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-4 flex items-center justify-between gap-3"
          >
            <button
              type="button"
              onClick={() => void handleToggle(item.id, !item.is_completed)}
              className="flex items-center gap-3 text-left flex-1 cursor-pointer"
            >
              {item.is_completed ? (
                <CheckCircle2 className="w-5 h-5 text-[#14452F] dark:text-[#A9E0BE] shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-[#5C6A62] shrink-0" />
              )}
              <div>
                <div className={`text-sm font-medium ${item.is_completed ? 'line-through opacity-55' : ''}`}>
                  {lang === 'bn' ? item.title_bn : item.title_en}
                </div>
                <div className="text-[11px] text-[#5C6A62] flex gap-2 mt-0.5">
                  {item.responsible_member_id && <span>{memberName(item.responsible_member_id)}</span>}
                  {item.due_label && <span>• {item.due_label}</span>}
                </div>
              </div>
            </button>

            {(session.isAdmin || item.owner_member_id === session.member.id) && (
              <button
                type="button"
                onClick={() => void tourApi.deleteChecklistItem(item.id).then(refreshState)}
                className="p-1.5 text-[#C45C3E] hover:bg-[#C45C3E]/10 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
