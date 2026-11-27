import React from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Send,
  Share,
  Smartphone,
} from 'lucide-react';
import { useTour } from '../context/TourContext';
import { toBanglaDigits } from '../lib/i18n';

interface Props {
  compact?: boolean;
}

export const PushSettingsCard: React.FC<Props> = ({ compact = false }) => {
  const {
    lang,
    pushDiagnostics,
    pushDeviceSubscribed,
    pushStatus,
    pushBusy,
    pushError,
    enablePushNotifications,
    disablePushNotifications,
    setAllMemberPushEnabled,
    sendTestPush,
    refreshPushState,
  } = useTour();

  const num = (val: number) => (lang === 'bn' ? toBanglaDigits(val) : String(val));
  const { support, permission, deviceLabel } = pushDiagnostics;

  const isActive =
    support === 'supported' &&
    permission === 'granted' &&
    pushDeviceSubscribed &&
    pushStatus.push_enabled;

  const isPausedGlobally =
    support === 'supported' &&
    permission === 'granted' &&
    pushDeviceSubscribed &&
    !pushStatus.push_enabled;

  return (
    <div
      className={`rounded-2xl border transition ${
        isActive
          ? 'border-[#14452F]/25 dark:border-[#A9E0BE]/25 bg-[#14452F]/[0.04] dark:bg-[#1E5C40]/15'
          : 'border-[#14452F]/12 dark:border-white/12 bg-white dark:bg-[#131F19]'
      } ${compact ? 'p-3' : 'p-4 sm:p-5 space-y-3'}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              isActive
                ? 'bg-[#14452F] text-[#FAF7F0] dark:bg-[#D4AF37] dark:text-[#0E1612]'
                : 'bg-[#14452F]/10 dark:bg-white/10 text-[#14452F] dark:text-[#D4AF37]'
            }`}
          >
            {isActive ? (
              <BellRing className="w-4 h-4" />
            ) : permission === 'denied' || support === 'unsupported' ? (
              <BellOff className="w-4 h-4 text-[#C45C3E]" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm text-[#1A241E] dark:text-[#F2EFE7]">
                {lang === 'bn' ? 'ব্যাকগ্রাউন্ড পুশ অ্যালার্ট' : 'Background Push Alerts'}
              </span>

              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#14452F]/12 dark:bg-[#1E5C40]/40 text-[#14452F] dark:text-[#A9E0BE] px-2 py-0.5 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{lang === 'bn' ? 'চালু' : 'Active'}</span>
                </span>
              )}

              {isPausedGlobally && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#C89F3C]/20 text-[#7A5B12] dark:text-[#F0D38C] px-2 py-0.5 text-[10px] font-bold">
                  <span>{lang === 'bn' ? 'পজ করা' : 'Paused'}</span>
                </span>
              )}

              {support === 'supported' && permission === 'denied' && (
                <span className="rounded-full bg-[#C45C3E]/12 text-[#C45C3E] px-2 py-0.5 text-[10px] font-bold">
                  {lang === 'bn' ? 'ব্লক করা' : 'Blocked'}
                </span>
              )}

              {support === 'ios_install_required' && (
                <span className="rounded-full bg-[#C89F3C]/20 text-[#7A5B12] dark:text-[#F0D38C] px-2 py-0.5 text-[10px] font-bold">
                  {lang === 'bn' ? 'ইনস্টল প্রয়োজন' : 'Home Screen Needed'}
                </span>
              )}
            </div>

            <p className="text-[11px] text-[#5C6A62] dark:text-[#9AA89F] mt-0.5 leading-snug">
              {support === 'ios_install_required'
                ? lang === 'bn'
                  ? 'iPhone/iPad-এ ব্যাকগ্রাউন্ড পুশ পেতে Safari → Share → "Add to Home Screen" করে অ্যাপ থেকে খুলুন।'
                  : 'On iOS, tap Safari Share → Add to Home Screen, then open the installed app to enable push.'
                : support === 'unsupported'
                  ? lang === 'bn'
                    ? 'এই ব্রাউজারে Web Push সমর্থিত নয়। তবে ওয়েবসাইট খোলা থাকলে লাইভ অ্যালার্ট পাবেন।'
                    : 'Web Push is not supported in this browser. Live in-app alerts still work while open.'
                  : support === 'insecure_context'
                    ? lang === 'bn'
                      ? 'ব্যাকগ্রাউন্ড পুশ চালু করতে HTTPS সংযোগ প্রয়োজন।'
                      : 'HTTPS connection is required for background Web Push.'
                    : support === 'not_configured'
                      ? lang === 'bn'
                        ? 'সার্ভার VAPID কী ও Supabase সেটআপ হলে এই ডিভাইসে ব্যাকগ্রাউন্ড পুশ চালু করা যাবে।'
                        : 'Configure Supabase + VITE_VAPID_PUBLIC_KEY to activate background push.'
                      : permission === 'denied'
                        ? lang === 'bn'
                          ? 'ব্রাউজারের সাইট সেটিংস থেকে Notifications Allow করে রিলোড করুন।'
                          : 'Allow Notifications in browser site settings, then tap refresh.'
                        : isActive
                          ? lang === 'bn'
                            ? `ব্রাউজার বন্ধ বা ফোন লক থাকলেও (${deviceLabel}) অ্যালার্ট পাবেন।`
                            : `Delivers locked-screen & closed-tab alerts on ${deviceLabel}.`
                          : lang === 'bn'
                            ? 'ব্রাউজার বন্ধ বা ফোন লক থাকলেও তাৎক্ষণিক খরচের নোটিফিকেশন পান।'
                            : 'Get instant alerts even when the browser is closed or phone is locked.'}
            </p>
          </div>
        </div>

        {/* Multi-device status pill */}
        {pushStatus.device_count > 0 && support === 'supported' && (
          <span className="inline-flex items-center gap-1 rounded-xl border border-[#14452F]/12 dark:border-white/12 px-2 py-1 text-[10px] font-semibold text-[#4A5850] dark:text-[#B9C4BC] shrink-0">
            <Smartphone className="w-3 h-3" />
            <span>
              {num(pushStatus.device_count)}{' '}
              {lang === 'bn' ? 'ডিভাইস' : pushStatus.device_count === 1 ? 'device' : 'devices'}
            </span>
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {support === 'ios_install_required' && (
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#C89F3C]/12 border border-[#C89F3C]/30 px-2.5 py-1.5 text-[11px] font-medium text-[#7A5B12] dark:text-[#F0D38C]">
            <Share className="w-3.5 h-3.5 shrink-0" />
            <span>
              {lang === 'bn' ? 'Share → Add to Home Screen ব্যবহার করুন' : 'Use Share → Add to Home Screen'}
            </span>
          </div>
        )}

        {support === 'supported' && permission === 'denied' && (
          <button
            type="button"
            disabled={pushBusy}
            onClick={() => void refreshPushState()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#C45C3E]/30 px-3 py-1.5 text-xs font-semibold text-[#C45C3E] hover:bg-[#C45C3E]/10 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'অনুমতি পুনরায় যাচাই' : 'Re-check Permission'}</span>
          </button>
        )}

        {support === 'supported' && permission !== 'denied' && !pushDeviceSubscribed && (
          <button
            type="button"
            disabled={pushBusy}
            onClick={() => void enablePushNotifications()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#14452F] hover:bg-[#1B5B3E] disabled:opacity-50 text-[#FAF7F0] dark:bg-[#D4AF37] dark:text-[#0E1612] px-3.5 py-2 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>
              {pushBusy
                ? lang === 'bn'
                  ? 'চালু হচ্ছে...'
                  : 'Enabling...'
                : lang === 'bn'
                  ? 'নোটিফিকেশন চালু করুন'
                  : 'Enable Notifications'}
            </span>
          </button>
        )}

        {support === 'supported' && pushDeviceSubscribed && (
          <>
            {!compact && (
              <button
                type="button"
                disabled={pushBusy || !pushStatus.push_enabled}
                onClick={() => void sendTestPush()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#14452F]/20 dark:border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-45 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'টেস্ট পুশ' : 'Send Test'}</span>
              </button>
            )}

            {pushStatus.device_count > 1 && (
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void setAllMemberPushEnabled(!pushStatus.push_enabled)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#14452F]/20 dark:border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
              >
                <span>
                  {pushStatus.push_enabled
                    ? lang === 'bn'
                      ? 'সব ডিভাইস পজ করুন'
                      : 'Pause All Devices'
                    : lang === 'bn'
                      ? 'সব ডিভাইস চালু করুন'
                      : 'Resume All Devices'}
                </span>
              </button>
            )}

            <button
              type="button"
              disabled={pushBusy}
              onClick={() => void disablePushNotifications()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C45C3E]/30 text-[#C45C3E] px-3 py-1.5 text-xs font-semibold hover:bg-[#C45C3E]/10 disabled:opacity-45 transition cursor-pointer"
            >
              <BellOff className="w-3.5 h-3.5" />
              <span>
                {pushBusy
                  ? '...'
                  : lang === 'bn'
                    ? 'নোটিফিকেশন বন্ধ করুন'
                    : 'Disable Notifications'}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Device list when expanded in Settings / More */}
      {!compact && pushStatus.devices.length > 0 && (
        <div className="pt-2.5 border-t border-black/5 dark:border-white/8 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#5C6A62] dark:text-[#9AA89F]">
            {lang === 'bn' ? 'সংযুক্ত ডিভাইসসমূহ' : 'Registered Devices'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pushStatus.devices.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/8 px-2 py-0.5 text-[11px] text-[#3F4D45] dark:text-[#C5D1C9]"
              >
                <Smartphone className="w-3 h-3 text-[#14452F] dark:text-[#D4AF37]" />
                <span>{d.device_label || 'Web Device'}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {pushError && (
        <p className="mt-2 text-[11px] font-medium text-[#C45C3E] dark:text-[#F49B82]">
          {pushError}
        </p>
      )}
    </div>
  );
};
