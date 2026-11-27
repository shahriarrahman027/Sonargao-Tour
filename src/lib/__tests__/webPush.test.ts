import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildVapidAuthHeader,
  base64UrlDecode,
  base64UrlEncode,
  encryptWebPushPayload,
  sendWebPushMessage,
} from '../../../supabase/functions/_shared/webpush';
import {
  buildPushNotificationForRecipient,
  computeServerBalances,
  type ContributionRow,
  type ExpenseRow,
  type MemberRow,
} from '../../../supabase/functions/_shared/pushMessage';
import { detectPushDiagnostics, urlBase64ToUint8Array } from '../pushClient';

async function generateVapidPair() {
  const pair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const rawPub = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', pair.publicKey));
  const jwkPriv = await globalThis.crypto.subtle.exportKey('jwk', pair.privateKey);
  return {
    publicKey: base64UrlEncode(rawPub),
    privateKey: jwkPriv.d!,
    publicCryptoKey: pair.publicKey,
  };
}

async function decryptAes128GcmPayload(
  encrypted: Uint8Array,
  uaPrivateKey: CryptoKey,
  uaPublicBytes: Uint8Array,
  authSecret: Uint8Array,
): Promise<Uint8Array> {
  const salt = encrypted.slice(0, 16);
  const keyLen = encrypted[20];
  const asPublicBytes = encrypted.slice(21, 21 + keyLen);
  const ciphertext = encrypted.slice(21 + keyLen);

  const subtle = globalThis.crypto.subtle;
  const asPublicKey = await subtle.importKey(
    'raw',
    asPublicBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedSecret = await subtle.deriveBits(
    { name: 'ECDH', public: asPublicKey },
    uaPrivateKey,
    256,
  );

  const enc = new TextEncoder();
  const authInfo = new Uint8Array(14 + uaPublicBytes.length + asPublicBytes.length);
  authInfo.set(enc.encode('WebPush: info\0'), 0);
  authInfo.set(uaPublicBytes, 14);
  authInfo.set(asPublicBytes, 14 + uaPublicBytes.length);

  const prkKey = await subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const ikm = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo },
    prkKey,
    256,
  );

  const ikmKey = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const cek = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: aes128gcm\0') },
    ikmKey,
    128,
  );
  const nonce = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('Content-Encoding: nonce\0') },
    ikmKey,
    96,
  );

  const aesKey = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const padded = new Uint8Array(
    await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, ciphertext),
  );
  // Strip trailing RFC 8188 0x02 delimiter byte
  expect(padded[padded.length - 1]).toBe(0x02);
  return padded.slice(0, padded.length - 1);
}

describe('Web Push RFC 8291 Encryption, VAPID Auth & Server Payload Accuracy', () => {
  it('signs verifiable RFC 8292 ES256 VAPID JWT headers and encrypts/decrypts RFC 8291 payloads faithfully', async () => {
    const vapid = await generateVapidPair();
    const authHeader = await buildVapidAuthHeader(
      'https://fcm.googleapis.com/fcm/send/example-token',
      {
        subject: 'mailto:tour@example.com',
        publicKey: vapid.publicKey,
        privateKey: vapid.privateKey,
      },
      1_700_000_000,
    );

    expect(authHeader.startsWith('vapid t=')).toBe(true);
    const match = authHeader.match(/^vapid t=([^,]+),\s*k=(.+)$/);
    expect(match).not.toBeNull();
    const jwt = match![1];
    const [headerB64, payloadB64, sigB64] = jwt.split('.');

    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    expect(claims.aud).toBe('https://fcm.googleapis.com');
    expect(claims.sub).toBe('mailto:tour@example.com');
    expect(claims.exp).toBe(1_700_000_000 + 12 * 3600);

    const verified = await globalThis.crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      vapid.publicCryptoKey,
      base64UrlDecode(sigB64),
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    expect(verified).toBe(true);

    // Simulate subscriber browser keys & verify roundtrip decryption of Bangla JSON
    const subKeyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const uaPublicBytes = new Uint8Array(
      await globalThis.crypto.subtle.exportKey('raw', subKeyPair.publicKey),
    );
    const authSecret = globalThis.crypto.getRandomValues(new Uint8Array(16));

    const payloadObj = {
      title: '🎟️ মাহাদি • টিকিট',
      body: 'মাহাদির পকেট থেকে টাকা উধাও! ২০ টাকা খরচ, এখনো ৯৮০ টাকা বাকি!',
      url: '/?tab=money&notif=expense%3A1',
    };
    const encoded = new TextEncoder().encode(JSON.stringify(payloadObj));
    const encrypted = await encryptWebPushPayload(
      encoded,
      base64UrlEncode(uaPublicBytes),
      base64UrlEncode(authSecret),
    );

    const decrypted = await decryptAes128GcmPayload(
      encrypted,
      subKeyPair.privateKey,
      uaPublicBytes,
      authSecret,
    );
    expect(JSON.parse(new TextDecoder().decode(decrypted))).toEqual(payloadObj);
  });

  it('handles HTTP 201, transient retry (503 -> 201), and expired/invalid subscriptions (410/404/bad keys)', async () => {
    const vapid = await generateVapidPair();
    const subKeyPair = await globalThis.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const uaPub = base64UrlEncode(
      new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', subKeyPair.publicKey)),
    );
    const auth = base64UrlEncode(globalThis.crypto.getRandomValues(new Uint8Array(16)));

    const sub = {
      id: 'sub-1',
      member_id: 'm-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p256dh: uaPub,
      auth,
    };

    // Retry 503 -> 201 succeeds cleanly
    let calls = 0;
    const retryRes = await sendWebPushMessage({
      subscription: sub,
      payload: { title: 'Test' },
      vapid: { subject: 'mailto:a@b.com', publicKey: vapid.publicKey, privateKey: vapid.privateKey },
      fetchImpl: async () => {
        calls += 1;
        return new Response(null, { status: calls === 1 ? 503 : 201 });
      },
    });
    expect(calls).toBe(2);
    expect(retryRes.ok).toBe(true);
    expect(retryRes.expired).toBe(false);

    // 410 Gone marks expired so Edge Function removes it automatically
    const goneRes = await sendWebPushMessage({
      subscription: sub,
      payload: { title: 'Test' },
      vapid: { subject: 'mailto:a@b.com', publicKey: vapid.publicKey, privateKey: vapid.privateKey },
      fetchImpl: async () => new Response('Gone', { status: 410 }),
    });
    expect(goneRes.ok).toBe(false);
    expect(goneRes.expired).toBe(true);

    // Malformed subscription key fails safely & marks expired without throwing
    const badRes = await sendWebPushMessage({
      subscription: { ...sub, p256dh: 'invalid-short-key' },
      payload: { title: 'Test' },
      vapid: { subject: 'mailto:a@b.com', publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    });
    expect(badRes.ok).toBe(false);
    expect(badRes.expired).toBe(true);
  });

  it('computes exact server balances and generates accurate Bangla lock-screen push content', () => {
    const members: MemberRow[] = [
      { id: 'm1', slug: 'mahadi', name_en: 'Mahadi', name_bn: 'মাহাদি', role: 'member', is_active: true },
      { id: 'm2', slug: 'shahriar', name_en: 'Shahriar', name_bn: 'শাহরিয়ার', role: 'admin', is_active: true },
    ];
    const contributions: ContributionRow[] = [
      {
        id: 'c1',
        member_id: 'm1',
        amount: 1000,
        payment_method: 'Cash',
        is_correction: false,
        created_by: 'm2',
        created_at: '2026-11-27T08:00:00Z',
      },
    ];
    const exp: ExpenseRow = {
      id: 'e1',
      title: 'টিকিট',
      category: 'Tickets',
      total_amount: 20,
      funding_source: 'group_cash',
      is_reimbursed: false,
      voided_by_correction: false,
      created_by: 'm2',
      created_at: '2026-11-27T09:00:00Z',
      updated_at: '2026-11-27T09:00:00Z',
      allocations: [{ member_id: 'm1', allocated_amount: 20 }],
    };

    const balances = computeServerBalances(contributions, [exp]);
    expect(balances.remainingGroupCash).toBe(980);
    expect(balances.memberBalances.get('m1')).toBe(980);

    const push = buildPushNotificationForRecipient({
      kind: 'expense_created',
      eventKey: 'expense:e1',
      recipientMember: members[0],
      members,
      contributions,
      expenses: [exp],
      targetExpense: exp,
    });

    expect(push.tag).toBe('expense:e1');
    expect(push.url).toContain('/?tab=money');
    expect(push.body).toContain('মাহাদি');
    expect(push.body).toContain('২০ টাকা');
    expect(push.body).toContain('৯৮০ টাকা');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects Web Push browser/OS compatibility including iOS Home Screen requirement and converts VAPID keys', async () => {
    const vapid = await generateVapidPair();
    const keyBytes = urlBase64ToUint8Array(vapid.publicKey);
    expect(keyBytes).toBeInstanceOf(Uint8Array);
    expect(keyBytes.length).toBe(65);
    expect(keyBytes[0]).toBe(0x04);

    // Without DOM globals in node test, reports unsupported honestly without claiming Web Push works
    const serverDiag = detectPushDiagnostics({
      vapidPublicKey: vapid.publicKey,
      isSupabaseConfigured: true,
    });
    expect(serverDiag.support).toBe('unsupported');

    const mockNav = {
      serviceWorker: {},
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
    };
    vi.stubGlobal('navigator', mockNav);
    vi.stubGlobal('window', {
      isSecureContext: true,
      PushManager: function PushManager() {},
      Notification: { permission: 'default' },
      navigator: mockNav,
      matchMedia: () => ({ matches: false }),
    });

    expect(
      detectPushDiagnostics({
        vapidPublicKey: vapid.publicKey,
        isSupabaseConfigured: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
        isSecureContext: true,
        standalone: false,
      }).support,
    ).toBe('ios_install_required');

    expect(
      detectPushDiagnostics({
        vapidPublicKey: vapid.publicKey,
        isSupabaseConfigured: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)',
        isSecureContext: true,
        standalone: true,
      }).support,
    ).toBe('supported');

    expect(
      detectPushDiagnostics({
        vapidPublicKey: vapid.publicKey,
        isSupabaseConfigured: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36',
        isSecureContext: true,
        standalone: false,
      }).support,
    ).toBe('supported');

    expect(
      detectPushDiagnostics({
        vapidPublicKey: '',
        isSupabaseConfigured: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/125.0.0.0',
        isSecureContext: true,
        standalone: false,
      }).support,
    ).toBe('not_configured');

    expect(
      detectPushDiagnostics({
        vapidPublicKey: vapid.publicKey,
        isSupabaseConfigured: true,
        userAgent: 'Mozilla/5.0 Chrome/125.0.0.0',
        isSecureContext: false,
        standalone: false,
      }).support,
    ).toBe('insecure_context');
  });
});
