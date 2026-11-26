import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Award, Check, Cookie, Dices, Sparkles, Trophy } from 'lucide-react';
import { useTour } from '../context/TourContext';
import { FUN_CHALLENGES, SNACK_PROMPTS } from '../data/defaultSeed';
import { formatDateTime } from '../lib/i18n';
import { soundEngine } from '../lib/sound';
import { tourApi } from '../lib/tourApi';

export const FunZoneSection: React.FC = () => {
  const { lang, state, session, refreshState } = useTour();
  const [spinning, setSpinning] = useState(false);

  if (!state || !session) return null;

  const members = state.members;
  const memberName = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? (lang === 'bn' ? m.name_bn : m.name_en) : '';
  };

  /**
   * Fair picker: chooses among the members with the fewest selections
   * of that event_type (and avoids the most recent pick).
   */
  const pickFairMember = (eventType: 'snack_picker' | 'challenge') => {
    const history = state.funEvents.filter((e) => e.event_type === eventType);
    const counts = new Map<string, number>();
    members.forEach((m) => counts.set(m.id, 0));
    history.forEach((e) => counts.set(e.selected_member_id, (counts.get(e.selected_member_id) || 0) + 1));

    const lastPicked = history[0]?.selected_member_id;
    let pool = members.filter((m) => m.id !== lastPicked);
    if (pool.length === 0) pool = members;

    const minCount = Math.min(...pool.map((m) => counts.get(m.id) || 0));
    const fairest = pool.filter((m) => (counts.get(m.id) || 0) === minCount);
    return fairest[Math.floor(Math.random() * fairest.length)];
  };

  const triggerPicker = async (eventType: 'snack_picker' | 'challenge') => {
    setSpinning(true);
    soundEngine.playTick();
    setTimeout(async () => {
      const chosen = pickFairMember(eventType);
      const list = eventType === 'snack_picker' ? SNACK_PROMPTS : FUN_CHALLENGES;
      const prompt = list[Math.floor(Math.random() * list.length)];
      await tourApi.recordFunEvent({
        event_type: eventType,
        selected_member_id: chosen.id,
        prompt_bn: prompt.bn,
        prompt_en: prompt.en,
        completed: false,
        created_by: session.member.id,
      });
      soundEngine.playCelebration();
      void confetti({ particleCount: 55, spread: 65 });
      await refreshState();
      setSpinning(false);
    }, 450);
  };

  // Leaderboard based on completed challenges + badges
  const leaderboard = members
    .map((m) => {
      const completedChallenges = state.funEvents.filter(
        (e) => e.selected_member_id === m.id && e.completed,
      ).length;
      const badgeCount = state.badges.filter((b) => b.member_id === m.id).length;
      return {
        member: m,
        score: completedChallenges * 10 + badgeCount * 5,
        completedChallenges,
        badgeCount,
      };
    })
    .sort((a, b) => b.score - a.score);

  const latestEvent = state.funEvents[0];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-[#C45C3E]">
          {lang === 'bn' ? 'আড্ডা ও মজার জোন' : 'FUN ZONE & CHALLENGES'}
        </span>
        <h2 className="font-editorial text-3xl sm:text-4xl font-bold mt-1">
          {lang === 'bn' ? 'ন্যায্য পিকার, চ্যালেঞ্জ ও ব্যাজ' : 'Fair Snack Picker, Challenges & Badges'}
        </h2>
      </div>

      {/* Interactive Generators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-[#14452F] text-[#FAF7F0] p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-bold uppercase tracking-wider">
            <Cookie className="w-4 h-4" />
            <span>{lang === 'bn' ? 'ফেয়ার স্ন্যাকস পিকার' : 'Fair Snack-Buying Picker'}</span>
          </div>
          <p className="text-sm text-white/80">
            {lang === 'bn'
              ? 'আগের বারের নাম বাদ দিয়ে এবং সবার সমান সুযোগ রেখে চা/ঝালমুড়ির দায়িত্ব ঠিক করুন!'
              : 'Fairly picks who handles the next tea or snack run without repeating the same friend twice in a row.'}
          </p>
          <button
            type="button"
            disabled={spinning}
            onClick={() => void triggerPicker('snack_picker')}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#D4AF37] text-[#0E1612] px-5 py-3 text-sm font-bold cursor-pointer hover:bg-[#E2BE48] transition"
          >
            <Dices className="w-4 h-4" />
            <span>{lang === 'bn' ? 'ভাগ্য ঘোরান!' : 'Spin Snack Picker'}</span>
          </button>
        </div>

        <div className="rounded-3xl bg-[#C45C3E] text-[#FAF7F0] p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#FFE5A3] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>{lang === 'bn' ? 'ট্যুর চ্যালেঞ্জ জেনারেটর' : 'Random Tour Challenge'}</span>
          </div>
          <p className="text-sm text-white/90">
            {lang === 'bn'
              ? 'পানাম নগর বা বাস যাত্রায় বন্ধুদের জন্য মজার চ্যালেঞ্জ তৈরি করুন এবং লিডারবোর্ডে পয়েন্ট জিতুন!'
              : 'Generate hilarious travel challenges on the bus or at Panam Nagar to earn points!'}
          </p>
          <button
            type="button"
            disabled={spinning}
            onClick={() => void triggerPicker('challenge')}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#FAF7F0] text-[#9D3B20] px-5 py-3 text-sm font-bold cursor-pointer hover:bg-white transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>{lang === 'bn' ? 'নতুন চ্যালেঞ্জ দিন' : 'Generate Challenge'}</span>
          </button>
        </div>
      </div>

      {/* Latest Spotlight */}
      {latestEvent && (
        <div className="rounded-3xl border-2 border-[#C89F3C]/50 bg-[#C89F3C]/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#8A6914] dark:text-[#F0D38C]">
              {latestEvent.event_type === 'snack_picker'
                ? lang === 'bn'
                  ? 'নির্বাচিত স্ন্যাকস ক্যাপ্টেন'
                  : 'Selected Snack Captain'
                : lang === 'bn'
                  ? 'সর্বশেষ চ্যালেঞ্জ'
                  : 'Latest Challenge'}
            </span>
            <h3 className="font-editorial text-2xl font-bold mt-1">
              {memberName(latestEvent.selected_member_id)}
            </h3>
            <p className="text-sm mt-1">
              {lang === 'bn' ? latestEvent.prompt_bn : latestEvent.prompt_en}
            </p>
          </div>
          {!latestEvent.completed && (
            <button
              type="button"
              onClick={() => void tourApi.completeFunEvent(latestEvent.id).then(refreshState)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#14452F] text-white px-4 py-2.5 text-xs font-bold shrink-0 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{lang === 'bn' ? 'সম্পন্ন হয়েছে' : 'Mark Completed'}</span>
            </button>
          )}
        </div>
      )}

      {/* Leaderboard & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5 space-y-3">
          <h3 className="font-editorial text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#C89F3C]" />
            <span>{lang === 'bn' ? 'ফান লিডারবোর্ড' : 'Fun Leaderboard'}</span>
          </h3>
          {leaderboard.map((row, i) => (
            <div
              key={row.member.id}
              className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5 last:border-0 text-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-xs w-5 text-[#C45C3E]">#{i + 1}</span>
                <span className="font-semibold">
                  {lang === 'bn' ? row.member.name_bn : row.member.name_en}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#5C6A62]">
                  {row.completedChallenges} {lang === 'bn' ? 'চ্যালেঞ্জ' : 'done'}
                </span>
                <span className="font-bold text-[#14452F] dark:text-[#D4AF37]">
                  {row.score} pts
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#131F19] border border-[#14452F]/10 dark:border-white/10 p-5 space-y-3">
          <h3 className="font-editorial text-xl font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-[#14452F] dark:text-[#D4AF37]" />
            <span>{lang === 'bn' ? 'ইভেন্ট ইতিহাস' : 'Recent Picks & Challenges'}</span>
          </h3>
          {state.funEvents.length === 0 ? (
            <p className="text-sm text-[#5C6A62]">
              {lang === 'bn' ? 'উপরের বাটনে ক্লিক করে শুরু করুন!' : 'Click a button above to roll!'}
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.funEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-black/5 dark:border-white/10 p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <strong>{memberName(ev.selected_member_id)}</strong> —{' '}
                    {lang === 'bn' ? ev.prompt_bn : ev.prompt_en}
                    <div className="text-[10px] text-[#5C6A62] mt-0.5">
                      {formatDateTime(ev.created_at, lang)}
                    </div>
                  </div>
                  {ev.completed && (
                    <span className="rounded-full bg-[#14452F]/12 text-[#14452F] dark:text-[#A9E0BE] px-2 py-0.5 font-semibold shrink-0">
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
