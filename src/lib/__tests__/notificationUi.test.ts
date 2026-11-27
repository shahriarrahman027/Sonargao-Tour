import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MoneyNotificationToast } from '../../components/MoneyNotificationToast';
import { NotificationCenter } from '../../components/NotificationCenter';
import { PushSettingsCard } from '../../components/PushSettingsCard';
import type { MoneyNotification } from '../../types/tour';

const sampleNotification: MoneyNotification = {
  eventKey: 'expense:1',
  id: 'expense:1',
  kind: 'expense_created',
  emoji: '🎟️',
  title_bn: 'নতুন খরচ রেকর্ড',
  title_en: 'New Expense Recorded',
  message_bn: 'মাহাদির পকেট থেকে ২০ টাকা উধাও! টিকিট কাটতে গিয়ে এখনো ৯৮০ টাকা অবশিষ্ট।',
  actorMemberId: '11111111-1111-4111-8111-111111111102',
  actorNameBn: 'শাহরিয়ার',
  actorNameEn: 'Shahriar',
  affectedMemberIds: ['11111111-1111-4111-8111-111111111101'],
  affectedLabelBn: 'মাহাদি',
  affectedLabelEn: 'Mahadi',
  amount: 20,
  category: 'Tickets',
  fundingSource: 'group_cash',
  relevantBalanceLabelBn: 'মাহাদি: ৳৯৮০ • ফান্ড: ৳৯৮০',
  relevantBalanceLabelEn: 'Mahadi: ৳980 • Fund: ৳980',
  remainingGroupCash: 980,
  viewerBalance: 980,
  createdAt: '2026-11-27T10:00:00+06:00',
  read: false,
  dismissed: false,
};

let mockSupport: 'supported' | 'ios_install_required' | 'not_configured' = 'supported';
let mockSubscribed = false;

vi.mock('../../context/TourContext', () => ({
  useTour: () => ({
    lang: 'bn',
    notifications: [sampleNotification],
    unreadNotificationCount: 1,
    activeMoneyToast: sampleNotification,
    dismissMoneyToast: () => {},
    markNotificationRead: () => {},
    markAllNotificationsRead: () => {},
    dismissNotification: () => {},
    clearAllNotifications: () => {},
    soundMuted: false,
    notifSoundEnabled: true,
    toggleNotifSound: () => {},
    realtimeStatus: 'connected',
    isOnline: true,
    pushDiagnostics: {
      support: mockSupport,
      permission: mockSubscribed ? 'granted' : 'default',
      isStandalonePwa: mockSupport !== 'ios_install_required',
      deviceLabel: 'Android PWA',
    },
    pushDeviceSubscribed: mockSubscribed,
    pushStatus: {
      push_enabled: true,
      device_count: mockSubscribed ? 2 : 0,
      devices: mockSubscribed
        ? [
            {
              id: 'dev-1',
              device_label: 'Android PWA',
              enabled: true,
              endpoint_hint: '...abc123',
              updated_at: '2026-11-27T10:00:00Z',
            },
            {
              id: 'dev-2',
              device_label: 'Mac Browser',
              enabled: true,
              endpoint_hint: '...xyz789',
              updated_at: '2026-11-27T09:55:00Z',
            },
          ]
        : [],
    },
    pushBusy: false,
    pushError: null,
    enablePushNotifications: async () => true,
    disablePushNotifications: async () => {},
    setAllMemberPushEnabled: async () => {},
    sendTestPush: async () => {},
    refreshPushState: async () => {},
  }),
}));

describe('Real-Time Notification & Push UI Components', () => {
  it('renders notification bell with unread count badge', () => {
    const html = renderToStaticMarkup(
      React.createElement(NotificationCenter, { onOpenMoney: () => {} }),
    );
    expect(html).toContain('aria-label="হিসাব নোটিফিকেশন"');
    expect(html).toContain('1 unread');
    expect(html).toContain('১');
  });

  it('renders MoneyNotificationToast with emoji, actor, target, amount, and funny Bangla message', () => {
    const html = renderToStaticMarkup(
      React.createElement(MoneyNotificationToast, { onOpenMoney: () => {} }),
    );
    expect(html).toContain('🎟️');
    expect(html).toContain('মাহাদির পকেট থেকে ২০ টাকা উধাও');
    expect(html).toContain('শাহরিয়ার');
    expect(html).toContain('মাহাদি');
    expect(html).toContain('৳২০');
    expect(html).toContain('aria-live="polite"');
  });

  it('renders PushSettingsCard across unsubscribed, multi-device active, and iOS install states', () => {
    mockSupport = 'supported';
    mockSubscribed = false;
    const enableHtml = renderToStaticMarkup(React.createElement(PushSettingsCard));
    expect(enableHtml).toContain('নোটিফিকেশন চালু করুন');

    mockSubscribed = true;
    const activeHtml = renderToStaticMarkup(React.createElement(PushSettingsCard));
    expect(activeHtml).toContain('চালু');
    expect(activeHtml).toContain('২ ডিভাইস');
    expect(activeHtml).toContain('Android PWA');
    expect(activeHtml).toContain('Mac Browser');
    expect(activeHtml).toContain('নোটিফিকেশন বন্ধ করুন');

    mockSupport = 'ios_install_required';
    mockSubscribed = false;
    const iosHtml = renderToStaticMarkup(React.createElement(PushSettingsCard));
    expect(iosHtml).toContain('Add to Home Screen');
    expect(iosHtml).toContain('ইনস্টল প্রয়োজন');
  });
});
