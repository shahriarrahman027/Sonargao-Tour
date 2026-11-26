import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  !SUPABASE_URL.includes('your-project-id') &&
  !SUPABASE_ANON_KEY.includes('your-supabase-anon-key');

const SESSION_STORAGE_KEY = 'ek_diner_tour_session_token';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

let cachedClient: SupabaseClient | null = null;
let cachedToken: string | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  const token = getStoredSessionToken() || '';
  if (!cachedClient || cachedToken !== token) {
    cachedToken = token;
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: token ? { 'x-tour-session': token } : {},
      },
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
      },
    });
  }
  return cachedClient;
}
