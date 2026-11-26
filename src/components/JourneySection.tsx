import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bus,
  Clock,
  Edit3,
  MapPin,
  Plus,
  Radio,
  Trash2,
  X,
} from 'lucide-react';
import { useTour } from '../context/TourContext';
import { formatBDT, formatDateTime } from '../lib/i18n';
import { tourApi } from '../lib/tourApi';
import type { ItineraryItem, SegmentType } from '../types/tour';
import { RouteMap } from './RouteMap';

export const JourneySection: React.FC = () => {
  const { lang, state, session, refreshState, showToast } = useTour();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<ItineraryItem> | null>(null);
  const [progressEditing, setProgressEditing] = useState(false);

  if (!state) return null;
  const isAdmin = Boolean(session?.isAdmin);
  const items = state.itinerary;
  const totalEstCost = items.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);

  const [progForm, setProgForm] = useState(state.progress);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await tourApi.upsertItineraryItem(editingItem);
    await refreshState();
    setEditingItem(null);
    showToast(lang === 'bn' ? 'ভ্রমণসূচি আপডেট হয়েছে' : 'Itinerary saved');
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const a = items[index];
    const b = items[targetIdx];
    await tourApi.upsertItineraryItem({ id: a.id, sort_order: b.sort_order });
    await tourApi.upsertItineraryItem({ id: b.id, sort_order: a.sort_order });
    await refreshState();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(lang === 'bn' ? 'এই ধাপটি মুছে ফেলবেন?' : 'Delete this itinerary stop?')) return;
    await tourApi.deleteItineraryItem(id);
    await refreshState();
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    await tourApi.updateTourProgress(progForm);
    await refreshState();
    setProgressEditing(false);
    showToast(lang === 'bn' ? 'লাইভ ট্যুর স্ট্যাটাস আপডেট হয়েছে' : 'Live tour status updated');
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
            {lang === 'bn' ? 'ভ্রমণপথ ও সময়সূচি' : 'OUR JOURNEY & ROUTE'}
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-[#14452F] dark:text-[#FAF7F0] mt-1">
            {lang === 'bn'
              ? 'সাভার → সোনারগাঁও → পুরান ঢাকা'
              : 'Savar → Sonargaon → Puran Dhaka'}
          </h2>
          <p className="text-sm text-[#4A5850] dark:text-[#B9C4BC] mt-1">
            {lang === 'bn'
              ? `মোট ${items.length}টি ধাপ • আনুমানিক জনপ্রতি খরচ: ${formatBDT(totalEstCost, lang)}`
              : `${items.length} segments • Est. per-person cost: ${formatBDT(totalEstCost, lang)}`}
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() =>
              setEditingItem({
                sort_order: items.length + 1,
                time_label: '09:00 AM',
                duration_label: '45m',
                title_bn: '',
                title_en: '',
                location_bn: '',
                location_en: '',
                activity_bn: '',
                activity_en: '',
                transport_bn: '',
                transport_en: '',
                estimated_cost: 0,
                notes_bn: '',
                notes_en: '',
                image_url: '',
                lat: 23.6458,
                lng: 90.6012,
                segment_type: 'destination',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#14452F] text-white px-4 py-2.5 text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'নতুন ধাপ যোগ করুন' : 'Add Stop'}</span>
          </button>
        )}
      </div>

      {/* Live Tour Tracker */}
      <div className="rounded-3xl bg-[#14452F] text-[#FAF7F0] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              <Radio className="w-4 h-4 animate-pulse text-[#E9A690]" />
              <span>{lang === 'bn' ? 'লাইভ ট্যুর প্রগ্রেস ট্র্যাকার' : 'Live Tour Progress'}</span>
            </div>
            <h3 className="font-editorial text-2xl font-bold mt-1">
              {lang === 'bn' ? state.progress.current_stage_bn : state.progress.current_stage_en}
            </h3>
            <p className="text-sm text-white/85 mt-1">
              <strong>{lang === 'bn' ? 'বর্তমান অবস্থান:' : 'Location:'}</strong>{' '}
              {lang === 'bn' ? state.progress.current_location_bn : state.progress.current_location_en}{' '}
              • <strong>{lang === 'bn' ? 'কার্যক্রম:' : 'Activity:'}</strong>{' '}
              {lang === 'bn' ? state.progress.current_activity_bn : state.progress.current_activity_en}
            </p>
            <p className="text-xs text-[#D4AF37] mt-1">
              {lang === 'bn' ? 'পরবর্তী গন্তব্য:' : 'Next stop:'}{' '}
              {lang === 'bn' ? state.progress.next_destination_bn : state.progress.next_destination_en} (
              {formatDateTime(state.progress.updated_at, lang)})
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setProgForm(state.progress);
                setProgressEditing((v) => !v);
              }}
              className="rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2 text-xs font-semibold shrink-0 cursor-pointer"
            >
              {lang === 'bn' ? 'স্ট্যাটাস আপডেট' : 'Update Live Stage'}
            </button>
          )}
        </div>

        {progressEditing && isAdmin && (
          <form onSubmit={handleSaveProgress} className="mt-4 pt-4 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <input
              value={progForm.current_stage_bn}
              onChange={(e) => setProgForm({ ...progForm, current_stage_bn: e.target.value })}
              placeholder="Stage (BN)"
              className="rounded-xl bg-black/25 border border-white/20 px-3 py-2"
            />
            <input
              value={progForm.current_stage_en}
              onChange={(e) => setProgForm({ ...progForm, current_stage_en: e.target.value })}
              placeholder="Stage (EN)"
              className="rounded-xl bg-black/25 border border-white/20 px-3 py-2"
            />
            <input
              value={progForm.current_location_bn}
              onChange={(e) => setProgForm({ ...progForm, current_location_bn: e.target.value })}
              placeholder="Location (BN)"
              className="rounded-xl bg-black/25 border border-white/20 px-3 py-2"
            />
            <input
              value={progForm.current_location_en}
              onChange={(e) => setProgForm({ ...progForm, current_location_en: e.target.value })}
              placeholder="Location (EN)"
              className="rounded-xl bg-black/25 border border-white/20 px-3 py-2"
            />
            <input
              value={progForm.current_activity_bn}
              onChange={(e) => setProgForm({ ...progForm, current_activity_bn: e.target.value })}
              placeholder="Activity (BN)"
              className="rounded-xl bg-black/25 border border-white/20 px-3 py-2"
            />
            <input
              value={progForm.current_activity_en}
              onChange={(e) => setProgForm({ ...progForm, current_activity_en: e.target.value })}
              placeholder="Activity (EN)"
              className="rounded-xl bg-black/25 border border-white/20 px-3 py-2"
            />
            <input
              value={progForm.next_destination_bn}
              onChange={(e) => setProgForm({ ...progForm, next_destination_bn: e.target.value })}
              placeholder="Next Destination (BN)"
              className="rounded-xl bg-black/25 border border-white/20 px-3 py-2"
            />
            <input
              value={progForm.next_destination_en}
              onChange={(e) => setProgForm({ ...progForm, next_destination_en: e.target.value })}
              placeholder="Next Destination (EN)"
              className="rounded-xl bg-black/25 border border-white/20 px-3 py-2"
            />
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setProgressEditing(false)} className="px-3 py-1.5">
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button type="submit" className="rounded-xl bg-[#D4AF37] text-[#0E1612] font-bold px-4 py-1.5 cursor-pointer">
                {lang === 'bn' ? 'সেভ করুন' : 'Save Update'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Interactive OpenStreetMap */}
      <RouteMap items={items} lang={lang} focusedId={focusedId} />

      {/* Timeline */}
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[#14452F] text-[#FAF7F0] flex items-center justify-center font-bold text-sm shrink-0">
                {idx + 1}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#C45C3E]">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {item.time_label}
                  </span>
                  {item.duration_label && <span>({item.duration_label})</span>}
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-[#14452F] dark:text-[#A9E0BE]">
                    <Bus className="w-3.5 h-3.5" /> {lang === 'bn' ? item.transport_bn : item.transport_en}
                  </span>
                </div>
                <h3 className="font-editorial text-lg font-bold mt-1">
                  {lang === 'bn' ? item.title_bn : item.title_en}
                </h3>
                <p className="text-sm text-[#3E4C44] dark:text-[#C5D1C9] mt-1">
                  {lang === 'bn' ? item.activity_bn : item.activity_en}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#5C6A62] dark:text-[#9AA89F]">
                  <button
                    type="button"
                    onClick={() => setFocusedId(item.id)}
                    className="inline-flex items-center gap-1 font-semibold text-[#14452F] dark:text-[#D4AF37] hover:underline cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? item.location_bn : item.location_en}</span>
                  </button>
                  <span>•</span>
                  <span>
                    {lang === 'bn' ? 'আনুমানিক খরচ:' : 'Est. cost:'} {formatBDT(item.estimated_cost, lang)}
                  </span>
                </div>
                {(item.notes_bn || item.notes_en) && (
                  <p className="mt-1.5 text-xs italic text-[#6D7B72]">
                    {lang === 'bn' ? item.notes_bn : item.notes_en}
                  </p>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-1.5 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => void handleMove(idx, -1)}
                  className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 cursor-pointer"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleMove(idx, 1)}
                  className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 cursor-pointer"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(item)}
                  className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item.id)}
                  className="p-2 rounded-xl border border-[#C45C3E]/30 text-[#C45C3E] hover:bg-[#C45C3E]/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Itinerary Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveItem}
            className="w-full max-w-xl rounded-3xl bg-[#FAF7F0] dark:bg-[#131F19] p-6 space-y-3 shadow-2xl"
          >
            <div className="flex justify-between items-center">
              <h4 className="font-editorial text-lg font-bold">
                {editingItem.id
                  ? lang === 'bn'
                    ? 'ভ্রমণ ধাপ সম্পাদনা'
                    : 'Edit Itinerary Stop'
                  : lang === 'bn'
                    ? 'নতুন ভ্রমণ ধাপ'
                    : 'Add Itinerary Stop'}
              </h4>
              <button type="button" onClick={() => setEditingItem(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                required
                value={editingItem.time_label || ''}
                onChange={(e) => setEditingItem({ ...editingItem, time_label: e.target.value })}
                placeholder="Time (e.g. 10:00 AM)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <input
                value={editingItem.duration_label || ''}
                onChange={(e) => setEditingItem({ ...editingItem, duration_label: e.target.value })}
                placeholder="Duration (e.g. 1h 30m)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <input
                required
                value={editingItem.title_bn || ''}
                onChange={(e) => setEditingItem({ ...editingItem, title_bn: e.target.value })}
                placeholder="Title (Bangla)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <input
                required
                value={editingItem.title_en || ''}
                onChange={(e) => setEditingItem({ ...editingItem, title_en: e.target.value })}
                placeholder="Title (English)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <input
                required
                value={editingItem.location_bn || ''}
                onChange={(e) => setEditingItem({ ...editingItem, location_bn: e.target.value })}
                placeholder="Location (Bangla)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <input
                required
                value={editingItem.location_en || ''}
                onChange={(e) => setEditingItem({ ...editingItem, location_en: e.target.value })}
                placeholder="Location (English)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <input
                value={editingItem.transport_bn || ''}
                onChange={(e) => setEditingItem({ ...editingItem, transport_bn: e.target.value })}
                placeholder="Transport (Bangla)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <input
                value={editingItem.transport_en || ''}
                onChange={(e) => setEditingItem({ ...editingItem, transport_en: e.target.value })}
                placeholder="Transport (English)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <input
                type="number"
                value={editingItem.estimated_cost ?? 0}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, estimated_cost: Number(e.target.value) || 0 })
                }
                placeholder="Estimated cost (BDT)"
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              />
              <select
                value={editingItem.segment_type || 'destination'}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, segment_type: e.target.value as SegmentType })
                }
                className="rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2"
              >
                <option value="departure">Departure</option>
                <option value="transit">Transit</option>
                <option value="destination">Destination</option>
                <option value="food">Food Stop</option>
                <option value="return">Return</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={editingItem.activity_bn || ''}
              onChange={(e) => setEditingItem({ ...editingItem, activity_bn: e.target.value })}
              placeholder="Activity description (Bangla)"
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-xs"
            />
            <textarea
              rows={2}
              value={editingItem.activity_en || ''}
              onChange={(e) => setEditingItem({ ...editingItem, activity_en: e.target.value })}
              placeholder="Activity description (English)"
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#0D1511] px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 text-xs">
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#14452F] text-white px-5 py-2 text-xs font-bold cursor-pointer"
              >
                {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Stop'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
