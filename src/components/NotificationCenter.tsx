import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useTour } from '../context/TourContext';
import { formatBDT, formatDateTime, toBanglaDigits } from '../lib/i18n';

interface Props {
  onOpenMoney: () => void;
}

export const NotificationCenter: React.FC<Props> = ({ onOpenMoney }) => {
  const {
    lang,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
    clearAllNotifications,
    soundMuted,
    notifSoundEnabled,
    toggleNotifSound,
    realtimeStatus,
    isOnline,
  } = useTour();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const badgeCountText =
    unreadNotificationCount > 9
      ? `${lang === 'bn' ? toBanglaDigits(9) : '9'}+`
      : lang === 'bn'
        ? toBanglaDigits(unreadNotificationCount)
        : String(unreadNotificationCount);

  const effectiveSoundOn = !soundMuted && notifSoundEnabled;

  const statusBadge = !isOnline || realtimeStatus === 'offline'
    ? {
        label: lang === 'bn' ? 'অফলাইন' : 'Offline',
        cls: 'bg-[#C45C3E]/12 text-[#C45C3E]',
        icon: <WifiOff className="w-3 h-3" />,
      }
    : realtimeStatus === 'connected'
      ? {
          label: lang === 'bn' ? 'লাইভ' : 'Live',
          cls: 'bg-[#14452F]/12 text-[#14452F] dark:bg-[#1E5C40]/40 dark:text-[#A9E0BE]',
          icon: <Wifi className="w-3 h-3" />,
        }
      : {
          label: lang === 'bn' ? 'সিঙ্ক হচ্ছে' : 'Syncing',
          cls: 'bg-[#C89F3C]/20 text-[#7A5B12] dark:text-[#F0D38C]',
          icon: <Wifi className="w-3 h-3 animate-pulse" />,
        };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={lang === 'bn' ? 'হিসাব নোটিফিকেশন' : 'Expense notifications'}
        aria-expanded={open}
        title={lang === 'bn' ? 'লাইভ হিসাব নোটিফিকেশন' : 'Live Money Notifications'}
        className={`relative p-2 rounded-xl border transition cursor-pointer ${
          open
            ? 'border-[#14452F] bg-[#14452F] text-[#FAF7F0] dark:border-[#D4AF37] dark:bg-[#D4AF37] dark:text-[#0E1612]'
            : 'border-[#14452F]/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 text-[#14452F] dark:text-[#FAF7F0]'
        }`}
      >
        {unreadNotificationCount > 0 ? (
          <BellRing className="w-4 h-4" />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {unreadNotificationCount > 0 && (
          <span
            aria-label={`${unreadNotificationCount} unread`}
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C45C3E] text-white text-[10px] font-extrabold leading-none flex items-center justify-center shadow-sm ring-2 ring-[#FAF7F0] dark:ring-[#0E1612]"
          >
            {badgeCountText}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={lang === 'bn' ? 'নোটিফিকেশন তালিকা' : 'Notification history'}
          className="fixed inset-x-3 top-[4.5rem] sm:inset-x-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[25rem] max-h-[calc(100dvh-10rem)] sm:max-h-[75vh] flex flex-col rounded-3xl border border-[#14452F]/15 dark:border-white/15 bg-[#FAF7F0] dark:bg-[#131F19] text-[#1A241E] dark:text-[#F2EFE7] shadow-2xl overflow-hidden z-50"
        >
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-[#14452F]/10 dark:border-white/10 flex items-center justify-between gap-2 bg-[#14452F]/[0.03] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-editorial text-sm sm:text-base font-bold truncate">
                {lang === 'bn' ? 'ট্যুর মানি অ্যালার্ট' : 'Live Money Alerts'}
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${statusBadge.cls}`}
              >
                {statusBadge.icon}
                <span>{statusBadge.label}</span>
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleNotifSound}
                title={
                  soundMuted
                    ? lang === 'bn'
                      ? 'গ্লোবাল সাউন্ড মিউট করা আছে'
                      : 'Global SFX is muted'
                    : effectiveSoundOn
                      ? lang === 'bn'
                        ? 'নোটিফিকেশন সাউন্ড চালু'
                        : 'Alert sound on'
                      : lang === 'bn'
                        ? 'নোটিফিকেশন সাউন্ড বন্ধ'
                        : 'Alert sound muted'
                }
                aria-label={lang === 'bn' ? 'নোটিফিকেশন সাউন্ড টগল' : 'Toggle alert sound'}
                className={`p-1.5 rounded-xl border text-xs transition cursor-pointer ${
                  effectiveSoundOn
                    ? 'border-[#14452F]/15 dark:border-white/15 text-[#14452F] dark:text-[#D4AF37] hover:bg-black/5 dark:hover:bg-white/5'
                    : 'border-[#C45C3E]/30 text-[#C45C3E] bg-[#C45C3E]/10'
                }`}
              >
                {effectiveSoundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {unreadNotificationCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  title={lang === 'bn' ? 'সবগুলো পঠিত চিহ্ন দিন' : 'Mark all read'}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#14452F]/15 dark:border-white/15 px-2 py-1 text-[11px] font-semibold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{lang === 'bn' ? 'সব পঠিত' : 'Read all'}</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllNotifications}
                  title={lang === 'bn' ? 'সব মুছুন' : 'Clear all'}
                  aria-label={lang === 'bn' ? 'সব নোটিফিকেশন মুছুন' : 'Clear all notifications'}
                  className="p-1.5 rounded-xl border border-[#14452F]/15 dark:border-white/15 text-[#5C6A62] hover:text-[#C45C3E] hover:bg-[#C45C3E]/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <Bell className="w-7 h-7 mx-auto text-[#5C6A62]/60" />
                <p className="text-xs font-medium text-[#5C6A62] dark:text-[#9AA89F]">
                  {lang === 'bn'
                    ? 'এখনো নতুন কোনো হিসাব আপডেট নেই — খরচ বা জমা হলে সাথে সাথে মজার অ্যালার্ট পাবেন!'
                    : 'No money notifications yet — new expenses, deposits, or refunds appear here live!'}
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isCredit =
                  n.kind === 'contribution_added' ||
                  n.kind === 'expense_voided' ||
                  n.kind === 'expense_reimbursed' ||
                  n.amount < 0;

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      markNotificationRead(n.id);
                      setOpen(false);
                      onOpenMoney();
                    }}
                    className={`group rounded-2xl border p-3.5 transition cursor-pointer ${
                      !n.read
                        ? 'border-[#C45C3E]/35 bg-white dark:bg-[#192820] shadow-xs'
                        : 'border-[#14452F]/10 dark:border-white/10 bg-white/65 dark:bg-white/[0.03] opacity-90 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg leading-none shrink-0" aria-hidden="true">
                          {n.emoji}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#C45C3E] dark:text-[#F2D184] truncate">
                          {lang === 'bn' ? n.title_bn : n.title_en}
                        </span>
                        {!n.read && (
                          <span
                            className="h-2 w-2 rounded-full bg-[#C45C3E] shrink-0"
                            aria-label="Unread"
                          />
                        )}
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!n.read && (
                          <button
                            type="button"
                            onClick={() => markNotificationRead(n.id)}
                            title={lang === 'bn' ? 'পঠিত চিহ্ন দিন' : 'Mark as read'}
                            aria-label={lang === 'bn' ? 'পঠিত চিহ্ন দিন' : 'Mark as read'}
                            className="p-1 rounded-lg hover:bg-[#14452F]/10 dark:hover:bg-white/10 text-[#14452F] dark:text-[#A9E0BE] cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => dismissNotification(n.id)}
                          title={lang === 'bn' ? 'বাদ দিন' : 'Dismiss'}
                          aria-label={lang === 'bn' ? 'বাদ দিন' : 'Dismiss'}
                          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#5C6A62] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Playful Personalized Bangla Message */}
                    <p className="mt-1.5 text-xs sm:text-[13px] font-semibold leading-relaxed text-[#1A241E] dark:text-[#F2EFE7]">
                      {n.message_bn}
                    </p>

                    {/* Structured Actor / Target / Amount / Balance Strip */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-lg bg-[#14452F]/8 dark:bg-white/8 px-2 py-0.5 text-[#3F4D45] dark:text-[#C5D1C9]">
                        {lang === 'bn' ? 'এন্ট্রি:' : 'By:'}{' '}
                        <strong>{lang === 'bn' ? n.actorNameBn : n.actorNameEn}</strong>
                      </span>
                      <span className="rounded-lg bg-[#14452F]/8 dark:bg-white/8 px-2 py-0.5 text-[#3F4D45] dark:text-[#C5D1C9]">
                        {lang === 'bn' ? 'সংশ্লিষ্ট:' : 'Affects:'}{' '}
                        <strong>{lang === 'bn' ? n.affectedLabelBn : n.affectedLabelEn}</strong>
                      </span>
                      <span
                        className={`rounded-lg px-2 py-0.5 font-bold ${
                          isCredit
                            ? 'bg-[#14452F]/12 text-[#14452F] dark:bg-[#1E5C40]/35 dark:text-[#A9E0BE]'
                            : 'bg-[#C45C3E]/12 text-[#C45C3E] dark:text-[#F49B82]'
                        }`}
                      >
                        {formatBDT(Math.abs(n.amount), lang)}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/8 flex items-center justify-between gap-2 text-[10px] text-[#5C6A62] dark:text-[#9AA89F]">
                      <span className="font-medium truncate">
                        {lang === 'bn' ? n.relevantBalanceLabelBn : n.relevantBalanceLabelEn}
                      </span>
                      <span className="shrink-0">{formatDateTime(n.createdAt, lang)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Action */}
          <div className="px-4 py-2.5 border-t border-[#14452F]/10 dark:border-white/10 bg-[#14452F]/[0.03] dark:bg-white/[0.02] flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#5C6A62] dark:text-[#9AA89F] truncate">
              {soundMuted
                ? lang === 'bn'
                  ? 'নীরব মোড (SFX বন্ধ)'
                  : 'Muted via SFX toggle'
                : lang === 'bn'
                  ? 'প্রতিটি লেনদেন লাইভ সিঙ্ক হয়'
                  : 'All ledger updates sync live'}
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenMoney();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#14452F] dark:text-[#D4AF37] hover:underline shrink-0 cursor-pointer"
            >
              <span>{lang === 'bn' ? 'সব হিসাব' : 'Open Ledger'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
