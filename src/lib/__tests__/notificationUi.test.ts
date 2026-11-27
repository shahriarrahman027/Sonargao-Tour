import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MoneyNotificationToast } from '../../components/MoneyNotificationToast';
import { NotificationCenter } from '../../components/NotificationCenter';
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
  }),
}));

describe('Real-Time Notification UI Components', () => {
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
});
