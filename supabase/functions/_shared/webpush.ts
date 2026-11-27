// Pure Web Standards RFC 8291 (aes128gcm) + RFC 8292 (VAPID ES256) Web Push utility.
// Uses only globalThis.crypto.subtle and fetch() so it runs identically in Deno 2
// (Supabase Edge Functions) and Node 20+ (Vitest verification).

const textEncoder = new TextEncoder();

export interface StoredPushSubscription {
  id: string;
  member_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidConfig {
  subject: string;
  publicKey: string;
  privateKey: string;
}

export interface PushSendResult {
  subscriptionId: string;
  ok: boolean;
  status: number;
  expired: boolean;
  error?: string;
}

export function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i += 1) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(input.length / 4) * 4,
    '=',
  );
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Generates an RFC 8292 VAPID Authorization header using ECDSA P-256 (ES256).
 */
export async function buildVapidAuthHeader(
  endpoint: string,
  vapid: VapidConfig,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const url = new URL(endpoint);
  const audience = url.origin;

  const publicBytes = base64UrlDecode(vapid.publicKey.trim());
  const privateBytes = base64UrlDecode(vapid.privateKey.trim());
  if (publicBytes.length !== 65 || publicBytes[0] !== 0x04) {
    throw new Error('Invalid VAPID public key format (expected 65-byte uncompressed P-256 point).');
  }
  if (privateBytes.length !== 32) {
    throw new Error('Invalid VAPID private key format (expected 32-byte raw P-256 scalar).');
  }

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(publicBytes.slice(1, 33)),
    y: base64UrlEncode(publicBytes.slice(33, 65)),
    d: base64UrlEncode(privateBytes),
    ext: true,
  };

  const signingKey = await globalThis.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const headerSegment = base64UrlEncode(
    textEncoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
  );
  const claimsSegment = base64UrlEncode(
    textEncoder.encode(
      JSON.stringify({
        aud: audience,
        exp: nowEpochSeconds + 12 * 3600,
        sub: vapid.subject,
      }),
    ),
  );
  const unsignedToken = `${headerSegment}.${claimsSegment}`;

  const signatureBuf = await globalThis.crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    toArrayBuffer(textEncoder.encode(unsignedToken)),
  );
  const signatureSegment = base64UrlEncode(new Uint8Array(signatureBuf));
  const jwt = `${unsignedToken}.${signatureSegment}`;

  return `vapid t=${jwt}, k=${vapid.publicKey.trim()}`;
}

/**
 * Encrypts push message bytes according to RFC 8291 (`aes128gcm` content-encoding).
 */
export async function encryptWebPushPayload(
  plaintextBytes: Uint8Array,
  p256dhBase64Url: string,
  authBase64Url: string,
): Promise<Uint8Array> {
  const uaPublicBytes = base64UrlDecode(p256dhBase64Url.trim());
  const authSecretBytes = base64UrlDecode(authBase64Url.trim());

  if (uaPublicBytes.length !== 65 || uaPublicBytes[0] !== 0x04) {
    throw new Error('Invalid subscriber p256dh key.');
  }
  if (authSecretBytes.length !== 16) {
    throw new Error('Invalid subscriber auth secret.');
  }

  const subtle = globalThis.crypto.subtle;

  const uaPublicKey = await subtle.importKey(
    'raw',
    toArrayBuffer(uaPublicBytes),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const asKeyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const asPublicBytes = new Uint8Array(await subtle.exportKey('raw', asKeyPair.publicKey));

  const sharedSecretBits = await subtle.deriveBits(
    { name: 'ECDH', public: uaPublicKey },
    asKeyPair.privateKey,
    256,
  );

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));

  // Step 1: Derive RFC 8291 IKM from ECDH secret + auth_secret
  const authInfo = concatBytes(
    textEncoder.encode('WebPush: info\0'),
    uaPublicBytes,
    asPublicBytes,
  );
  const prkBaseKey = await subtle.importKey('raw', sharedSecretBits, 'HKDF', false, ['deriveBits']);
  const ikmBits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(authSecretBytes),
      info: toArrayBuffer(authInfo),
    },
    prkBaseKey,
    256,
  );

  // Step 2: Derive AES-128 content encryption key (16 bytes) and GCM nonce (12 bytes)
  const ikmKey = await subtle.importKey('raw', ikmBits, 'HKDF', false, ['deriveBits']);
  const cekBits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(textEncoder.encode('Content-Encoding: aes128gcm\0')),
    },
    ikmKey,
    128,
  );
  const nonceBits = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(textEncoder.encode('Content-Encoding: nonce\0')),
    },
    ikmKey,
    96,
  );

  const cekKey = await subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);

  // Single final RFC 8188 record terminated by 0x02 delimiter byte
  const paddedPlaintext = concatBytes(plaintextBytes, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: 'AES-GCM', iv: nonceBits },
      cekKey,
      toArrayBuffer(paddedPlaintext),
    ),
  );

  // RFC 8188 aes128gcm binary header (86 bytes)
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const keyIdLength = new Uint8Array([asPublicBytes.length]);

  return concatBytes(salt, recordSize, keyIdLength, asPublicBytes, ciphertext);
}

/**
 * Sends a single encrypted Web Push message with transient retry and permanent expiry classification.
 */
export async function sendWebPushMessage(params: {
  subscription: StoredPushSubscription;
  payload: Record<string, unknown>;
  vapid: VapidConfig;
  fetchImpl?: typeof fetch;
}): Promise<PushSendResult> {
  const { subscription, payload, vapid, fetchImpl = globalThis.fetch } = params;

  let body: Uint8Array;
  let authHeader: string;
  try {
    const encodedPayload = textEncoder.encode(JSON.stringify(payload));
    body = await encryptWebPushPayload(encodedPayload, subscription.p256dh, subscription.auth);
    authHeader = await buildVapidAuthHeader(subscription.endpoint, vapid);
  } catch (err) {
    return {
      subscriptionId: subscription.id,
      ok: false,
      status: 400,
      expired: true,
      error: err instanceof Error ? err.message : 'Malformed subscription or VAPID configuration',
    };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(subscription.endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          TTL: '86400',
          Urgency: 'high',
        },
        body: toArrayBuffer(body),
      });

      if (response.ok) {
        return { subscriptionId: subscription.id, ok: true, status: response.status, expired: false };
      }

      if (response.status === 404 || response.status === 410) {
        return {
          subscriptionId: subscription.id,
          ok: false,
          status: response.status,
          expired: true,
          error: `Push subscription expired (${response.status})`,
        };
      }

      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }

      const text = await response.text().catch(() => '');
      return {
        subscriptionId: subscription.id,
        ok: false,
        status: response.status,
        expired: false,
        error: text || `HTTP ${response.status}`,
      };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      return {
        subscriptionId: subscription.id,
        ok: false,
        status: 0,
        expired: false,
        error: err instanceof Error ? err.message : 'Network error sending push',
      };
    }
  }

  return {
    subscriptionId: subscription.id,
    ok: false,
    status: 0,
    expired: false,
    error: 'Push retry exhausted',
  };
}
