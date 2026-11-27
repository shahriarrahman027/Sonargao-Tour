import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { NavTab } from '../components/Navbar';
import { resolveTrackKeyForSection } from '../config/music';
import { computeFinancialSummary, type FinancialSummary } from '../lib/accounting';
import { musicManager, type MusicSnapshot } from '../lib/musicManager';
import {
  buildQuietSeedNotifications,
  createNotificationBaseline,
  extractNewMoneyNotifications,
  loadNotificationBaseline,
  loadNotifSoundEnabled,
  loadStoredNotifications,
  saveNotificationBaseline,
  saveNotifSoundEnabled,
  saveStoredNotifications,
  type NotificationBaseline,
} from '../lib/notifications';
import { loadOfflineSnapshot } from '../lib/offlineCache';
import {
  detectPushDiagnostics,
  getActivePushEndpoint,
  getActivePushSubscription,
  requestAndSubscribeDevicePush,
  serializePushSubscription,
  unsubscribeDeviceBrowserPush,
  type BrowserPushDiagnostics,
} from '../lib/pushClient';
import { soundEngine } from '../lib/sound';
import {
  applyThemeToDocument,
  getNextThemeMode,
  getStoredTheme,
  getSystemPrefersDark,
  resolveTheme,
  saveStoredTheme,
  subscribeToSystemTheme,
} from '../lib/theme';
import { tourApi, type FullTourState } from '../lib/tourApi';
import type {
  GateStatus,
  Language,
  MoneyNotification,
  PushStatusSummary,
  RealtimeConnectionStatus,
  ResolvedTheme,
  SessionInfo,
  ThemeMode,
} from '../types/tour';

interface TourContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  toggleLang: () => void;
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  soundMuted: boolean;
  toggleSoundMute: () => void;
  musicPlaying: boolean;
  musicState: MusicSnapshot;
  toggleMusic: () => void;
  syncMusicForRoute: (activeTab: NavTab) => void;
  isOnline: boolean;
  isSupabaseMode: boolean;
  gateStatus: GateStatus | null;
  session: SessionInfo | null;
  loading: boolean;
  state: FullTourState | null;
  finance: FinancialSummary | null;
  refreshState: () => Promise<void>;
  login: (studentId: string, groupPasscode?: string) => Promise<void>;
  elevateAdmin: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  toast: string | null;
  showToast: (msg: string) => void;
  notifications: MoneyNotification[];
  unreadNotificationCount: number;
  activeMoneyToast: MoneyNotification | null;
  dismissMoneyToast: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  notifSoundEnabled: boolean;
  toggleNotifSound: () => void;
  realtimeStatus: RealtimeConnectionStatus;
  pushDiagnostics: BrowserPushDiagnostics;
  pushDeviceSubscribed: boolean;
  pushStatus: PushStatusSummary;
  pushBusy: boolean;
  pushError: string | null;
  enablePushNotifications: () => Promise<boolean>;
  disablePushNotifications: () => Promise<void>;
  setAllMemberPushEnabled: (enabled: boolean) => Promise<void>;
  sendTestPush: () => Promise<void>;
  refreshPushState: () => Promise<void>;
}

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('tour_lang');
    return saved === 'en' ? 'en' : 'bn';
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => getSystemPrefersDark());
  const resolvedTheme = useMemo(
    () => resolveTheme(theme, systemPrefersDark),
    [theme, systemPrefersDark],
  );

  const [soundMuted, setSoundMuted] = useState(false);
  const [notifSoundEnabled, setNotifSoundEnabled] = useState(() => loadNotifSoundEnabled());
  const [musicState, setMusicState] = useState<MusicSnapshot>(() => musicManager.getSnapshot());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting',
  );
  const [gateStatus, setGateStatus] = useState<GateStatus | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [state, setState] = useState<FullTourState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<MoneyNotification[]>([]);
  const [activeMoneyToast, setActiveMoneyToast] = useState<MoneyNotification | null>(null);
  const [pushDiagnostics, setPushDiagnostics] = useState<BrowserPushDiagnostics>(() =>
    detectPushDiagnostics({ isSupabaseConfigured: tourApi.isSupabaseMode() }),
  );
  const [pushDeviceSubscribed, setPushDeviceSubscribed] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatusSummary>({
    push_enabled: true,
    device_count: 0,
    devices: [],
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const sessionRef = useRef<SessionInfo | null>(null);
  const soundMutedRef = useRef(false);
  const notifSoundEnabledRef = useRef(notifSoundEnabled);
  const fetchSeqRef = useRef(0);
  const appliedSeqRef = useRef(0);
  const baselineRef = useRef<{ memberId: string; baseline: NotificationBaseline } | null>(null);
  const notificationsRef = useRef<MoneyNotification[]>([]);
  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const moneyToastTimerRef = useRef<number | null>(null);
  const lastVisibilitySyncRef = useRef(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

  useEffect(() => {
    notifSoundEnabledRef.current = notifSoundEnabled;
  }, [notifSoundEnabled]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const dismissMoneyToast = useCallback(() => {
    if (moneyToastTimerRef.current !== null) {
      window.clearTimeout(moneyToastTimerRef.current);
      moneyToastTimerRef.current = null;
    }
    setActiveMoneyToast(null);
  }, []);

  const showMoneyToast = useCallback((notif: MoneyNotification) => {
    if (moneyToastTimerRef.current !== null) {
      window.clearTimeout(moneyToastTimerRef.current);
    }
    setActiveMoneyToast(notif);
    moneyToastTimerRef.current = window.setTimeout(() => {
      setActiveMoneyToast((curr) => (curr?.eventKey === notif.eventKey ? null : curr));
      moneyToastTimerRef.current = null;
    }, 6500);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3600);
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem('tour_lang', l);
    document.documentElement.lang = l;
  }, []);

  const toggleLang = useCallback(() => {
    soundEngine.playTick();
    setLang(lang === 'bn' ? 'en' : 'bn');
  }, [lang, setLang]);

  useEffect(() => {
    setSystemPrefersDark(getSystemPrefersDark());
    return subscribeToSystemTheme(setSystemPrefersDark);
  }, []);

  useEffect(() => {
    applyThemeToDocument(resolvedTheme);
    saveStoredTheme(theme);
  }, [theme, resolvedTheme]);

  useEffect(() => {
    const name =
      lang === 'bn'
        ? state?.settings.website_name_bn || gateStatus?.website_name_bn || 'সস্তায় ১ দিনের ট্যুর'
        : state?.settings.website_name_en || gateStatus?.website_name_en || 'Sostay 1 diner tour';
    document.title =
      lang === 'bn' ? `${name} — সোনারগাঁও ও পুরান ঢাকা` : `${name} — Sonargaon & Puran Dhaka`;
  }, [lang, state?.settings.website_name_bn, state?.settings.website_name_en, gateStatus]);

  const setTheme = useCallback((next: ThemeMode) => {
    soundEngine.playTick();
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    soundEngine.playTick();
    setThemeState((prev) => getNextThemeMode(prev));
  }, []);

  const toggleSoundMute = useCallback(() => {
    const next = !soundMuted;
    setSoundMuted(next);
    soundEngine.setMuted(next);
  }, [soundMuted]);

  const toggleNotifSound = useCallback(() => {
    setNotifSoundEnabled((prev) => {
      const next = !prev;
      saveNotifSoundEnabled(next);
      return next;
    });
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    const memberId = sessionRef.current?.member.id;
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      if (memberId) saveStoredNotifications(memberId, next);
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    const memberId = sessionRef.current?.member.id;
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      if (memberId) saveStoredNotifications(memberId, next);
      return next;
    });
  }, []);

  const dismissNotification = useCallback((id: string) => {
    const memberId = sessionRef.current?.member.id;
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, dismissed: true, read: true } : n));
      if (memberId) saveStoredNotifications(memberId, next);
      return next;
    });
    setActiveMoneyToast((curr) => (curr?.id === id ? null : curr));
  }, []);

  const clearAllNotifications = useCallback(() => {
    const memberId = sessionRef.current?.member.id;
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, dismissed: true, read: true }));
      if (memberId) saveStoredNotifications(memberId, next);
      return next;
    });
    dismissMoneyToast();
  }, [dismissMoneyToast]);

  const toggleMusic = useCallback(() => {
    void musicManager.toggle();
  }, []);

  const syncMusicForRoute = useCallback(
    (activeTab: NavTab) => {
      const trackKey = resolveTrackKeyForSection(Boolean(session), activeTab);
      void musicManager.setActiveTrack(trackKey);
    },
    [session],
  );

  useEffect(() => {
    const unsub = musicManager.subscribe(setMusicState);
    return () => {
      unsub();
      musicManager.dispose();
    };
  }, []);

  useEffect(() => {
    if (!musicState.autoplayBlocked || musicState.userPaused || !musicState.isConfigured) {
      return;
    }
    const handleUnlock = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-music-control="true"]')) return;
      window.removeEventListener('pointerdown', handleUnlock, { capture: true });
      window.removeEventListener('keydown', handleUnlock, { capture: true });
      void musicManager.play();
    };
    window.addEventListener('pointerdown', handleUnlock, { capture: true });
    window.addEventListener('keydown', handleUnlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock, { capture: true });
      window.removeEventListener('keydown', handleUnlock, { capture: true });
    };
  }, [musicState.autoplayBlocked, musicState.userPaused, musicState.isConfigured]);

  const processFinancialNotifications = useCallback(
    (full: FullTourState, memberId?: string | null) => {
      if (!memberId) return;

      // Hydrate stored notifications + baseline when session initializes or switches member
      if (baselineRef.current?.memberId !== memberId) {
        const stored = loadStoredNotifications(memberId);
        const storedBaseline = loadNotificationBaseline(memberId);

        seenEventKeysRef.current = new Set(stored.map((n) => n.eventKey));

        if (!storedBaseline) {
          const initialBaseline = createNotificationBaseline(full);
          baselineRef.current = { memberId, baseline: initialBaseline };
          saveNotificationBaseline(memberId, initialBaseline);

          const seeded =
            stored.length > 0 ? stored : buildQuietSeedNotifications(full, memberId, 6);
          seeded.forEach((n) => seenEventKeysRef.current.add(n.eventKey));
          notificationsRef.current = seeded;
          saveStoredNotifications(memberId, seeded);
          setNotifications(seeded);
          return;
        }

        baselineRef.current = { memberId, baseline: storedBaseline };
        notificationsRef.current = stored;
        setNotifications(stored);
      }

      const { notifications: newItems, nextBaseline } = extractNewMoneyNotifications({
        prevBaseline: baselineRef.current.baseline,
        nextState: full,
        viewerMemberId: memberId,
        seenEventKeys: seenEventKeysRef.current,
      });

      baselineRef.current = { memberId, baseline: nextBaseline };
      saveNotificationBaseline(memberId, nextBaseline);

      if (newItems.length === 0) return;

      newItems.forEach((n) => seenEventKeysRef.current.add(n.eventKey));
      const merged = [...newItems, ...notificationsRef.current].slice(0, 50);
      notificationsRef.current = merged;
      saveStoredNotifications(memberId, merged);
      setNotifications(merged);

      // Show only the latest notification card so catch-up bursts never flood UI
      showMoneyToast(newItems[0]);

      if (!soundMutedRef.current && notifSoundEnabledRef.current) {
        soundEngine.playNotificationPop();
      }
    },
    [showMoneyToast],
  );

  const refreshState = useCallback(
    async (memberIdOverride?: string) => {
      const reqSeq = ++fetchSeqRef.current;
      try {
        const full = await tourApi.fetchFullState();
        if (reqSeq < appliedSeqRef.current) return;
        appliedSeqRef.current = reqSeq;
        setState(full);
        const targetMemberId = memberIdOverride ?? sessionRef.current?.member.id;
        processFinancialNotifications(full, targetMemberId);
      } catch (err) {
        const cached = loadOfflineSnapshot();
        if (cached) {
          setState((prev) =>
            prev
              ? { ...prev, ...cached }
              : {
                  settings: cached.settings,
                  members: cached.members,
                  itinerary: cached.itinerary,
                  checklist: cached.checklist,
                  progress: cached.progress,
                  contributions: [],
                  expenses: [],
                  polls: [],
                  notes: [],
                  photos: [],
                  badges: [],
                  funEvents: [],
                  activityLog: [],
                },
          );
        } else {
          showToast(err instanceof Error ? err.message : 'Failed to load tour data');
        }
      }
    },
    [processFinancialNotifications, showToast],
  );

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setRealtimeStatus('connected');
      if (sessionRef.current) {
        void refreshState();
      }
    };
    const onOffline = () => {
      setIsOnline(false);
      setRealtimeStatus('offline');
    };
    const onVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        sessionRef.current &&
        (typeof navigator === 'undefined' || navigator.onLine)
      ) {
        const now = Date.now();
        if (now - lastVisibilitySyncRef.current > 2000) {
          lastVisibilitySyncRef.current = now;
          void refreshState();
        }
      }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshState]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [gate, restored] = await Promise.all([
          tourApi.getGateStatus(),
          tourApi.restoreSession(),
        ]);
        if (!active) return;
        setGateStatus(gate);
        if (restored) {
          sessionRef.current = restored;
          setSession(restored);
          await refreshState(restored.member.id);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshState]);

  useEffect(() => {
    if (!session) {
      setRealtimeStatus(isOnline ? 'connecting' : 'offline');
      return;
    }
    return tourApi.subscribeToRealtime(
      () => {
        void refreshState();
      },
      (status) => {
        setRealtimeStatus(status);
      },
    );
  }, [session, isOnline, refreshState]);

  const refreshPushState = useCallback(async () => {
    const diag = detectPushDiagnostics({ isSupabaseConfigured: tourApi.isSupabaseMode() });
    setPushDiagnostics(diag);

    const browserSub = await getActivePushSubscription();
    setPushDeviceSubscribed(Boolean(browserSub));

    if (!sessionRef.current || !tourApi.isSupabaseMode() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return;
    }
    try {
      const serverStatus = await tourApi.getMyPushStatus();
      setPushStatus(serverStatus);
      // Keep an already-granted device synced for the active member
      if (browserSub && diag.support === 'supported' && diag.permission === 'granted' && serverStatus.push_enabled) {
        try {
          const serialized = serializePushSubscription(browserSub);
          await tourApi.upsertPushSubscription(serialized);
        } catch {
          // ignore transient background sync error
        }
      }
    } catch {
      // ignore if offline or push migration not yet applied
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setPushDeviceSubscribed(false);
      setPushStatus({ push_enabled: true, device_count: 0, devices: [] });
      setPushError(null);
      return;
    }
    void refreshPushState();
  }, [session, refreshPushState]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent<{ type?: string; payload?: { eventKey?: string } }>) => {
      if (!event.data?.type) return;
      if (event.data.type === 'TOUR_PUSH_RECEIVED' && sessionRef.current) {
        void refreshState();
      } else if (event.data.type === 'TOUR_PUSH_SUBSCRIPTION_CHANGED' && sessionRef.current) {
        void refreshPushState();
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, [refreshState, refreshPushState]);

  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    setPushError(null);
    setPushBusy(true);
    try {
      const serialized = await requestAndSubscribeDevicePush();
      const status = await tourApi.upsertPushSubscription(serialized);
      setPushDeviceSubscribed(true);
      setPushStatus(status);
      setPushDiagnostics(detectPushDiagnostics({ isSupabaseConfigured: tourApi.isSupabaseMode() }));
      soundEngine.playNotificationPop(true);
      showToast(
        lang === 'bn'
          ? '🔔 এই ডিভাইসে ব্যাকগ্রাউন্ড পুশ নোটিফিকেশন চালু হয়েছে!'
          : '🔔 Background push notifications enabled on this device!',
      );
      return true;
    } catch (err) {
      setPushDiagnostics(detectPushDiagnostics({ isSupabaseConfigured: tourApi.isSupabaseMode() }));
      setPushError(
        err instanceof Error
          ? err.message
          : lang === 'bn'
            ? 'পুশ নোটিফিকেশন চালু করা যায়নি।'
            : 'Could not enable push notifications.',
      );
      return false;
    } finally {
      setPushBusy(false);
    }
  }, [lang, showToast]);

  const disablePushNotifications = useCallback(async () => {
    setPushError(null);
    setPushBusy(true);
    try {
      const endpoint = await unsubscribeDeviceBrowserPush();
      const status = await tourApi.removePushSubscription(endpoint);
      setPushDeviceSubscribed(false);
      setPushStatus(status);
      setPushDiagnostics(detectPushDiagnostics({ isSupabaseConfigured: tourApi.isSupabaseMode() }));
      showToast(
        lang === 'bn'
          ? 'এই ডিভাইসে ব্যাকগ্রাউন্ড পুশ বন্ধ করা হয়েছে।'
          : 'Background push notifications disabled on this device.',
      );
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Failed to disable notifications');
    } finally {
      setPushBusy(false);
    }
  }, [lang, showToast]);

  const setAllMemberPushEnabled = useCallback(
    async (enabled: boolean) => {
      setPushError(null);
      setPushBusy(true);
      try {
        const status = await tourApi.setMemberPushPreference(enabled);
        setPushStatus(status);
        showToast(
          enabled
            ? lang === 'bn'
              ? 'সব ডিভাইসে পুশ নোটিফিকেশন পুনরায় চালু হয়েছে।'
              : 'Push notifications resumed across your devices.'
            : lang === 'bn'
              ? 'আপনার সব ডিভাইসের পুশ নোটিফিকেশন বন্ধ করা হয়েছে।'
              : 'Paused push notifications across all your devices.',
        );
      } catch (err) {
        setPushError(err instanceof Error ? err.message : 'Failed to update push preference');
      } finally {
        setPushBusy(false);
      }
    },
    [lang, showToast],
  );

  const sendTestPush = useCallback(async () => {
    setPushError(null);
    setPushBusy(true);
    try {
      const res = await tourApi.sendTestPushNotification();
      showToast(
        res.sent > 0
          ? lang === 'bn'
            ? `টেস্ট পুশ পাঠানো হয়েছে (${res.sent}টি ডিভাইস)!`
            : `Test push sent (${res.sent} device${res.sent === 1 ? '' : 's'})!`
          : lang === 'bn'
            ? 'কোনো সক্রিয় ডিভাইসে পাঠানো যায়নি — আবার চালু করে চেষ্টা করুন।'
            : 'No active push devices reached — re-enable notifications first.',
      );
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Failed to send test push');
    } finally {
      setPushBusy(false);
    }
  }, [lang, showToast]);

  const login = useCallback(
    async (studentId: string, groupPasscode?: string) => {
      const sess = await tourApi.loginWithStudentId(studentId, groupPasscode);
      sessionRef.current = sess;
      setSession(sess);
      await refreshState(sess.member.id);
      soundEngine.playCelebration();
      showToast(
        lang === 'bn'
          ? `ওয়েলকাম ${sess.member.name_bn} মামা! ব্যাগ গুছান, ট্যুর অন!`
          : `Welcome ${sess.member.name_en} mama! Crew ID verified — hop on the bus!`,
      );
    },
    [refreshState, showToast, lang],
  );

  const elevateAdmin = useCallback(
    async (password: string) => {
      await tourApi.elevateAdmin(password);
      setSession((prev) => (prev ? { ...prev, isAdmin: true } : prev));
      await refreshState();
      soundEngine.playCoinChime();
    },
    [refreshState],
  );

  const logout = useCallback(async () => {
    try {
      const endpoint = await getActivePushEndpoint().catch(() => null);
      if (endpoint && tourApi.isSupabaseMode()) {
        await tourApi.removePushSubscription(endpoint).catch(() => {});
      }
    } finally {
      await tourApi.logout();
    }
    sessionRef.current = null;
    baselineRef.current = null;
    notificationsRef.current = [];
    seenEventKeysRef.current = new Set();
    dismissMoneyToast();
    setPushDeviceSubscribed(false);
    setPushStatus({ push_enabled: true, device_count: 0, devices: [] });
    setNotifications([]);
    setSession(null);
    setState(null);
  }, [dismissMoneyToast]);

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => !n.dismissed),
    [notifications],
  );

  const unreadNotificationCount = useMemo(
    () => visibleNotifications.filter((n) => !n.read).length,
    [visibleNotifications],
  );

  const finance = useMemo(() => {
    if (!state) return null;
    return computeFinancialSummary(
      state.members,
      state.contributions,
      state.expenses,
      state.settings,
    );
  }, [state]);

  return (
    <TourContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        soundMuted,
        toggleSoundMute,
        musicPlaying: musicState.isPlaying,
        musicState,
        toggleMusic,
        syncMusicForRoute,
        isOnline,
        isSupabaseMode: tourApi.isSupabaseMode(),
        gateStatus,
        session,
        loading,
        state,
        finance,
        refreshState,
        login,
        elevateAdmin,
        logout,
        toast,
        showToast,
        notifications: visibleNotifications,
        unreadNotificationCount,
        activeMoneyToast,
        dismissMoneyToast,
        markNotificationRead,
        markAllNotificationsRead,
        dismissNotification,
        clearAllNotifications,
        notifSoundEnabled,
        toggleNotifSound,
        realtimeStatus,
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
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used inside TourProvider');
  return ctx;
}
