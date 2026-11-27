import type { PushSupportStatus } from '../types/tour';

export const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || '';

export interface BrowserPushDiagnostics {
  support: PushSupportStatus;
  permission: NotificationPermission | 'unsupported';
  isStandalonePwa: boolean;
  deviceLabel: string;
}

/**
 * Converts a URL-safe base64 VAPID public key string into a tightly typed ArrayBuffer
 * required by PushManager.subscribe({ applicationServerKey }).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const clean = base64String.trim();
  const padding = '='.repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function isIosDevice(userAgent?: string): boolean {
  const ua =
    userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return /iPad|iPhone|iPod/i.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);
}

export function isStandalonePwaMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    Boolean(nav.standalone) ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}

export function detectDeviceLabel(userAgent?: string): string {
  const ua =
    userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const mode = isStandalonePwaMode() ? 'PWA' : 'Browser';
  if (/Android/i.test(ua)) return `Android ${mode}`;
  if (isIosDevice(ua)) return `iPhone/iPad ${mode}`;
  if (/Mac OS X/i.test(ua)) return `Mac ${mode}`;
  if (/Windows/i.test(ua)) return `Windows ${mode}`;
  if (/Linux/i.test(ua)) return `Linux ${mode}`;
  return `Web ${mode}`;
}

function readNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  const win = window as Window & { Notification?: { permission?: NotificationPermission } };
  return win.Notification?.permission ?? 'unsupported';
}

export function detectPushDiagnostics(options?: {
  vapidPublicKey?: string;
  isSupabaseConfigured?: boolean;
  userAgent?: string;
  isSecureContext?: boolean;
  standalone?: boolean;
}): BrowserPushDiagnostics {
  const vapidKey = (options?.vapidPublicKey ?? VAPID_PUBLIC_KEY).trim();
  const deviceLabel = detectDeviceLabel(options?.userAgent);
  const standalone = options?.standalone ?? isStandalonePwaMode();

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      support: 'unsupported',
      permission: 'unsupported',
      isStandalonePwa: false,
      deviceLabel,
    };
  }

  const secure = options?.isSecureContext ?? Boolean(window.isSecureContext);
  if (!secure) {
    return {
      support: 'insecure_context',
      permission: readNotificationPermission(),
      isStandalonePwa: standalone,
      deviceLabel,
    };
  }

  // iOS Safari only exposes Notification / PushManager when launched from Home Screen
  if (isIosDevice(options?.userAgent) && !standalone) {
    const rawPerm = readNotificationPermission();
    return {
      support: 'ios_install_required',
      permission: rawPerm === 'unsupported' ? 'default' : rawPerm,
      isStandalonePwa: false,
      deviceLabel,
    };
  }

  const permission = readNotificationPermission();
  const hasWebPushApis =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    permission !== 'unsupported';

  if (!hasWebPushApis) {
    return {
      support: 'unsupported',
      permission,
      isStandalonePwa: standalone,
      deviceLabel,
    };
  }

  const supabaseReady = options?.isSupabaseConfigured ?? true;
  if (!vapidKey || !supabaseReady) {
    return {
      support: 'not_configured',
      permission,
      isStandalonePwa: standalone,
      deviceLabel,
    };
  }

  return {
    support: 'supported',
    permission,
    isStandalonePwa: standalone,
    deviceLabel,
  };
}

async function getReadyServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker is not supported in this browser.');
  }
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing && (existing.active || existing.installing || existing.waiting)) {
    return await navigator.serviceWorker.ready;
  }
  // Ensure SW readiness waits safely with bounded timeout instead of hanging indefinitely in dev
  return await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () =>
          reject(
            new Error(
              'Service Worker is not active yet. Build/preview in production or HTTPS mode to enable background Web Push.',
            ),
          ),
        5000,
      );
    }),
  ]);
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function getActivePushEndpoint(): Promise<string | null> {
  const sub = await getActivePushSubscription();
  return sub?.endpoint ?? null;
}

export interface SerializedPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  deviceLabel: string;
}

export function serializePushSubscription(sub: PushSubscription): SerializedPushSubscription {
  const p256dh = arrayBufferToBase64Url(sub.getKey('p256dh'));
  const auth = arrayBufferToBase64Url(sub.getKey('auth'));
  if (!sub.endpoint || !p256dh || !auth) {
    throw new Error('Browser returned an incomplete push subscription.');
  }
  return {
    endpoint: sub.endpoint,
    p256dh,
    auth,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    deviceLabel: detectDeviceLabel(),
  };
}

/**
 * Requests browser Notification permission ONLY inside a user click gesture
 * and creates/retrieves the Web Push subscription for the current device.
 */
export async function requestAndSubscribeDevicePush(
  vapidPublicKey = VAPID_PUBLIC_KEY,
): Promise<SerializedPushSubscription> {
  if (!vapidPublicKey) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not configured.');
  }
  if (!('Notification' in window) || !('PushManager' in window)) {
    throw new Error('This browser does not support Web Push notifications.');
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission was blocked in browser settings.'
        : 'Notification permission was dismissed.',
    );
  }

  const registration = await getReadyServiceWorkerRegistration();
  let sub = await registration.pushManager.getSubscription();

  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  return serializePushSubscription(sub);
}

/**
 * Unsubscribes the current device browser from PushManager and returns its previous endpoint
 * so the backend database record can be removed.
 */
export async function unsubscribeDeviceBrowserPush(): Promise<string | null> {
  const sub = await getActivePushSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    // Still return endpoint so backend row can be cleaned up cleanly
  }
  return endpoint;
}
