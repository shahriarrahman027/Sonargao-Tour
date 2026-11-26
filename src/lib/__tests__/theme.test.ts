import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../../../index.html?raw';
import {
  applyThemeToDocument,
  getNextThemeMode,
  getStoredTheme,
  getSystemPrefersDark,
  resolveTheme,
  saveStoredTheme,
  subscribeToSystemTheme,
  THEME_STORAGE_KEY,
} from '../theme';

function installBrowserMocks(initialSystemDark = false) {
  const store = new Map<string, string>();
  const classes = new Set<string>();
  let systemDark = initialSystemDark;
  const mqListeners = new Set<(e: MediaQueryListEvent) => void>();

  const localStorageMock = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };

  const matchMediaMock = (query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? systemDark : false,
    media: query,
    addEventListener: (_event: string, fn: (e: MediaQueryListEvent) => void) => {
      mqListeners.add(fn);
    },
    removeEventListener: (_event: string, fn: (e: MediaQueryListEvent) => void) => {
      mqListeners.delete(fn);
    },
  });

  const documentMock = {
    documentElement: {
      classList: {
        toggle: (name: string, force?: boolean) => {
          const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
          if (shouldAdd) classes.add(name);
          else classes.delete(name);
          return shouldAdd;
        },
        contains: (name: string) => classes.has(name),
      },
    },
  };

  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('window', { matchMedia: matchMediaMock });
  vi.stubGlobal('document', documentMock);

  return {
    store,
    classes,
    emitOsThemeChange(nextDark: boolean) {
      systemDark = nextDark;
      mqListeners.forEach((fn) => fn({ matches: nextDark } as MediaQueryListEvent));
    },
  };
}

describe('Theme System: Light, Dark & System Modes', () => {
  beforeEach(() => {
    installBrowserMocks(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to system mode when no preference exists or when stored value is invalid', () => {
    expect(getStoredTheme()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid-mode');
    expect(getStoredTheme()).toBe('system');
  });

  it('resolves light, dark, and system modes accurately against OS color scheme', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(getNextThemeMode('system')).toBe('light');
    expect(getNextThemeMode('light')).toBe('dark');
    expect(getNextThemeMode('dark')).toBe('system');
  });

  it('persists selected mode across refresh and applies dark class cleanly', () => {
    saveStoredTheme('dark');
    expect(getStoredTheme()).toBe('dark');
    applyThemeToDocument(resolveTheme(getStoredTheme(), false));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    saveStoredTheme('light');
    expect(getStoredTheme()).toBe('light');
    applyThemeToDocument(resolveTheme(getStoredTheme(), true));
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    saveStoredTheme('system');
    expect(getStoredTheme()).toBe('system');
  });

  it('reacts automatically to OS prefers-color-scheme changes in system mode', () => {
    const mocks = installBrowserMocks(false);
    expect(getSystemPrefersDark()).toBe(false);

    let activeResolved = resolveTheme('system', getSystemPrefersDark());
    expect(activeResolved).toBe('light');

    const unsub = subscribeToSystemTheme((prefersDark) => {
      activeResolved = resolveTheme('system', prefersDark);
      applyThemeToDocument(activeResolved);
    });

    mocks.emitOsThemeChange(true);
    expect(activeResolved).toBe('dark');
    expect(mocks.classes.has('dark')).toBe(true);

    mocks.emitOsThemeChange(false);
    expect(activeResolved).toBe('light');
    expect(mocks.classes.has('dark')).toBe(false);

    unsub();
  });

  it('pre-paint head script in index.html applies saved or system theme synchronously without flash', () => {
    const match = indexHtml.match(/<script>([\s\S]*?)<\/script>/);
    expect(match?.[1]).toBeTruthy();
    const scriptCode = match![1];
    const runHeadScript = new Function('localStorage', 'window', 'document', scriptCode);

    // 1. No preference + OS dark -> applies .dark synchronously
    const m1 = installBrowserMocks(true);
    runHeadScript(globalThis.localStorage, globalThis.window, globalThis.document);
    expect(m1.classes.has('dark')).toBe(true);

    // 2. Saved light + OS dark -> stays light
    const m2 = installBrowserMocks(true);
    globalThis.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    runHeadScript(globalThis.localStorage, globalThis.window, globalThis.document);
    expect(m2.classes.has('dark')).toBe(false);

    // 3. Saved dark + OS light -> applies .dark
    const m3 = installBrowserMocks(false);
    globalThis.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    runHeadScript(globalThis.localStorage, globalThis.window, globalThis.document);
    expect(m3.classes.has('dark')).toBe(true);
  });
});
