import React, { useState } from 'react';
import { Lock, Pin, Plus, StickyNote, Trash2, Unlock, Vote as VoteIcon } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { formatDateTime } from '../lib/i18n';
import { soundEngine } from '../lib/sound';
import { tourApi } from '../lib/tourApi';

export const SocialSection: React.FC = () => {
  const { lang, state, session, refreshState, showToast } = useTour();

  // Poll form
  const [showPollForm, setShowPollForm] = useState(false);
  const [qBn, setQBn] = useState('');
  const [qEn, setQEn] = useState('');
  const [optsText, setOptsText] = useState('');
  const [allowMulti, setAllowMulti] = useState(false);

  // Note form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePinned, setNotePinned] = useState(false);

  if (!state || !session) return null;

  const memberName = (id: string) => {
    const m = state.members.find((x) => x.id === id);
    return m ? (lang === 'bn' ? m.name_bn : m.name_en) : '';
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = optsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    await tourApi.createPoll({
      question_bn: qBn || qEn,
      question_en: qEn || qBn,
      description_bn: '',
      description_en: '',
      allow_multiple: allowMulti,
      options: lines.map((l) => ({ label_bn: l, label_en: l })),
    });
    setQBn('');
    setQEn('');
    setOptsText('');
    setShowPollForm(false);
    await refreshState();
    showToast(lang === 'bn' ? 'নতুন পোল তৈরি হয়েছে' : 'Poll created');
  };

  const handleVote = async (pollId: string, optionId: string, allowMultiple: boolean) => {
    await tourApi.castVote(pollId, optionId, session.member.id, allowMultiple);
    soundEngine.playTick();
    await refreshState();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    await tourApi.addNote({
      title: noteTitle.trim(),
      content: noteContent.trim(),
      is_pinned: session.isAdmin ? notePinned : false,
    });
    soundEngine.playTick();
    setNoteTitle('');
    setNoteContent('');
    setNotePinned(false);
    await refreshState();
    showToast(lang === 'bn' ? 'নোট যোগ করা হয়েছে' : 'Note posted');
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* LEFT: POLLS & VOTING */}
      <div className="lg:col-span-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
              {lang === 'bn' ? 'গ্রুপ ভোটিং' : 'POLLS & DECISIONS'}
            </span>
            <h2 className="font-editorial text-2xl sm:text-3xl font-bold mt-1 flex items-center gap-2">
              <VoteIcon className="w-6 h-6 text-[#14452F] dark:text-[#D4AF37]" />
              <span>{lang === 'bn' ? 'সিদ্ধান্ত নিন ভোটে' : 'Crew Voting'}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPollForm((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl bg-[#14452F] text-white px-3.5 py-2 text-xs font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'নতুন পোল' : 'New Poll'}</span>
          </button>
        </div>

        {showPollForm && (
          <form
            onSubmit={handleCreatePoll}
            className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/15 dark:border-white/10 p-5 space-y-3"
          >
            <input
              required
              value={qBn}
              onChange={(e) => setQBn(e.target.value)}
              placeholder={lang === 'bn' ? 'প্রশ্ন (বাংলায়)' : 'Question (Bangla)'}
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
            />
            <input
              value={qEn}
              onChange={(e) => setQEn(e.target.value)}
              placeholder="Question (English, optional)"
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
            />
            <textarea
              required
              rows={3}
              value={optsText}
              onChange={(e) => setOptsText(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'প্রতি লাইনে একটি অপশন লিখুন (কমপক্ষে ২টি)'
                  : 'One option per line (at least 2 options)'
              }
              className="w-full rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={allowMulti}
                onChange={(e) => setAllowMulti(e.target.checked)}
              />
              <span>{lang === 'bn' ? 'একাধিক অপশনে ভোট দেওয়া যাবে' : 'Allow multiple choices'}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPollForm(false)} className="px-3 py-1.5 text-xs">
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#14452F] text-white px-4 py-1.5 text-xs font-bold cursor-pointer"
              >
                {lang === 'bn' ? 'তৈরি করুন' : 'Create Poll'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          {state.polls.map((poll) => {
            const totalVotes = poll.votes.length;
            return (
              <div
                key={poll.id}
                className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-editorial text-lg font-bold">
                      {lang === 'bn' ? poll.question_bn : poll.question_en}
                    </h3>
                    {(poll.description_bn || poll.description_en) && (
                      <p className="text-xs text-[#5C6A62] mt-0.5">
                        {lang === 'bn' ? poll.description_bn : poll.description_en}
                      </p>
                    )}
                  </div>
                  {session.isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void tourApi.togglePollClosed(poll.id, !poll.is_closed).then(refreshState)}
                        className="p-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs cursor-pointer"
                        title={poll.is_closed ? 'Reopen poll' : 'Close poll'}
                      >
                        {poll.is_closed ? <Lock className="w-3.5 h-3.5 text-[#C45C3E]" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(lang === 'bn' ? 'এই পোলটি মুছে ফেলবেন?' : 'Delete this poll?')) {
                            void tourApi.deletePoll(poll.id).then(refreshState);
                          }
                        }}
                        className="p-1.5 rounded-lg border border-[#C45C3E]/30 text-[#C45C3E] text-xs cursor-pointer"
                        title={lang === 'bn' ? 'পোল মুছুন' : 'Delete poll'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {poll.options.map((opt) => {
                    const optVotes = poll.votes.filter((v) => v.option_id === opt.id);
                    const pct = totalVotes > 0 ? Math.round((optVotes.length / totalVotes) * 100) : 0;
                    const myVote = optVotes.some((v) => v.member_id === session.member.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={poll.is_closed}
                        onClick={() => void handleVote(poll.id, opt.id, poll.allow_multiple)}
                        className={`w-full text-left rounded-2xl border p-3 relative overflow-hidden transition cursor-pointer ${
                          myVote
                            ? 'border-[#14452F] dark:border-[#D4AF37]'
                            : 'border-[#14452F]/12 dark:border-white/10'
                        }`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-[#14452F]/10 dark:bg-[#D4AF37]/15 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative flex items-center justify-between gap-2 text-sm">
                          <span className="font-semibold">
                            {lang === 'bn' ? opt.label_bn : opt.label_en}
                          </span>
                          <span className="text-xs font-bold shrink-0">
                            {optVotes.length} ({pct}%)
                          </span>
                        </div>
                        {optVotes.length > 0 && (
                          <div className="relative mt-1 text-[10px] text-[#5C6A62] dark:text-[#9AA89F]">
                            {optVotes.map((v) => memberName(v.member_id)).join(', ')}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: SHARED NOTES BOARD */}
      <div className="lg:col-span-6 space-y-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
            {lang === 'bn' ? 'শেয়ার্ড নোটবোর্ড' : 'SHARED NOTES'}
          </span>
          <h2 className="font-editorial text-2xl sm:text-3xl font-bold mt-1 flex items-center gap-2">
            <StickyNote className="w-6 h-6 text-[#C45C3E]" />
            <span>{lang === 'bn' ? 'সবার জরুরি নোট' : 'Group Notice & Notes'}</span>
          </h2>
        </div>

        <form
          onSubmit={handleAddNote}
          className="rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5 space-y-3"
        >
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder={lang === 'bn' ? 'শিরোনাম (ঐচ্ছিক)' : 'Note title (optional)'}
            className="w-full rounded-xl border border-black/12 dark:border-white/15 bg-transparent px-3.5 py-2 text-sm"
          />
          <textarea
            required
            rows={2}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder={lang === 'bn' ? 'বন্ধুদের জন্য কোনো নোট লিখুন...' : 'Write a note for the group...'}
            className="w-full rounded-xl border border-black/12 dark:border-white/15 bg-transparent px-3.5 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            {session.isAdmin ? (
              <label className="flex items-center gap-1.5 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={notePinned}
                  onChange={(e) => setNotePinned(e.target.checked)}
                />
                <span>{lang === 'bn' ? 'গুরুত্বপূর্ণ হিসেবে পিন করুন' : 'Pin as important'}</span>
              </label>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="rounded-xl bg-[#C45C3E] text-white px-4 py-2 text-xs font-bold cursor-pointer"
            >
              {lang === 'bn' ? 'নোট পোস্ট করুন' : 'Post Note'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {state.notes.map((note) => {
            const canDelete = session.isAdmin || note.author_id === session.member.id;
            return (
              <div
                key={note.id}
                className={`rounded-3xl border p-5 ${
                  note.is_pinned
                    ? 'border-[#C89F3C]/50 bg-[#C89F3C]/10'
                    : 'border-[#14452F]/10 dark:border-white/10 bg-white dark:bg-[#131F19]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {note.is_pinned && <Pin className="w-3.5 h-3.5 text-[#C45C3E]" />}
                      <h4 className="font-bold text-sm">
                        {note.title || (lang === 'bn' ? 'গ্রুপ নোট' : 'Group Note')}
                      </h4>
                    </div>
                    <p className="text-sm mt-1.5 whitespace-pre-line">{note.content}</p>
                    <div className="mt-2 text-[11px] text-[#5C6A62]">
                      {memberName(note.author_id)} • {formatDateTime(note.created_at, lang)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {session.isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          void tourApi.updateNote(note.id, { is_pinned: !note.is_pinned }).then(refreshState)
                        }
                        className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                      >
                        <Pin className={`w-3.5 h-3.5 ${note.is_pinned ? 'text-[#C45C3E]' : 'opacity-50'}`} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void tourApi.deleteNote(note.id).then(refreshState)}
                        className="p-1.5 rounded-lg text-[#C45C3E] hover:bg-[#C45C3E]/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
