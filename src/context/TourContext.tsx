import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { NavTab } from '../components/Navbar';
import { resolveTrackKeyForSection } from '../config/music';
import { computeFinancialSummary, type FinancialSummary } from '../lib/accounting';
import { musicManager, type MusicSnapshot } from '../lib/musicManager';
import { loadOfflineSnapshot } from '../lib/offlineCache';
import { soundEngine } from '../lib/sound';
import { tourApi, type FullTourState } from '../lib/tourApi';
import type { GateStatus, Language, SessionInfo, ThemeMode } from '../types/tour';

interface TourContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  toggleLang: () => void;
  theme: ThemeMode;
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
}

const TourContext = createContext<TourContextValue | null>(null);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('tour_lang');
    return saved === 'en' ? 'en' : 'bn';
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('tour_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [soundMuted, setSoundMuted] = useState(false);
  const [musicState, setMusicState] = useState<MusicSnapshot>(() => musicManager.getSnapshot());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [gateStatus, setGateStatus] = useState<GateStatus | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [state, setState] = useState<FullTourState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

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
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('tour_theme', theme);
  }, [theme]);

  useEffect(() => {
    const name =
      lang === 'bn'
        ? state?.settings.website_name_bn || gateStatus?.website_name_bn || 'সস্তায় ১ দিনের ট্যুর'
        : state?.settings.website_name_en || gateStatus?.website_name_en || 'Sostay 1 diner tour';
    document.title =
      lang === 'bn' ? `${name} — সোনারগাঁও ও পুরান ঢাকা` : `${name} — Sonargaon & Puran Dhaka`;
  }, [lang, state?.settings.website_name_bn, state?.settings.website_name_en, gateStatus]);

  const toggleTheme = useCallback(() => {
    soundEngine.playTick();
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const toggleSoundMute = useCallback(() => {
    const next = !soundMuted;
    setSoundMuted(next);
    soundEngine.setMuted(next);
  }, [soundMuted]);

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
      void musicManager.play();
    };
    window.addEventListener('pointerdown', handleUnlock, { once: true, capture: true });
    window.addEventListener('keydown', handleUnlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock, { capture: true });
      window.removeEventListener('keydown', handleUnlock, { capture: true });
    };
  }, [musicState.autoplayBlocked, musicState.userPaused, musicState.isConfigured]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const full = await tourApi.fetchFullState();
      setState(full);
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
  }, [showToast]);

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
          setSession(restored);
          await refreshState();
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
    if (!session) return;
    return tourApi.subscribeToRealtime(() => {
      void refreshState();
    });
  }, [session, refreshState]);

  const login = useCallback(
    async (studentId: string, groupPasscode?: string) => {
      const sess = await tourApi.loginWithStudentId(studentId, groupPasscode);
      setSession(sess);
      await refreshState();
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
    await tourApi.logout();
    setSession(null);
    setState(null);
  }, []);

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
