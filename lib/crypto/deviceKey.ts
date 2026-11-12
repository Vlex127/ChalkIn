import type { SupabaseClient } from '@supabase/supabase-js';
import { getDb } from '../offline/db';

const KEY_ALGO = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_ALGO = { name: 'ECDSA', hash: 'SHA-256' } as const;

const toBase64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

export type BindingStatus = 'bound_here' | 'not_bound' | 'bound_elsewhere';

/**
 * Register THIS phone for the logged-in user.
 * Generates a key pair, sends only the public half to the server (bind_device RPC),
 * and stores the private half in IndexedDB. Needs internet.
 *
 * Throws:
 *  - 'phone_bound_to_other_user': another account already has a key on this phone
 *  - 'already_bound': the server already has an active device for this user
 *    (a lecturer/admin must run revoke_student_device before a new phone can bind)
 */
export async function bindThisPhone(
  supabase: SupabaseClient,
  userId: string,
  label?: string,
): Promise<void> {
  const db = await getDb();

  const existing = await db.getAll('keys');
  if (existing.some((k) => k.userId !== userId)) {
    // Local guard only. The server enforces one device per USER; it cannot
    // stop one phone from being registered by two users if browser data is cleared.
    throw new Error('phone_bound_to_other_user');
  }

  // extractable:false makes the PRIVATE key non-exportable. The public key
  // is always exportable, which is what we need.
  const pair = await crypto.subtle.generateKey(KEY_ALGO, false, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);

  const { error } = await supabase.rpc('bind_device', {
    p_public_key: publicJwk,
    p_label: label ?? null,
  });
  if (error) {
    throw new Error(error.message.includes('already_bound') ? 'already_bound' : error.message);
  }

  await db.put('keys', {
    userId,
    privateKey: pair.privateKey,
    publicJwk,
    createdAt: Date.now(),
  });
}

/** Does this phone's key match the server's active device? Needs internet. */
export async function getBindingStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<BindingStatus> {
  const db = await getDb();
  const local = await db.get('keys', userId);

  const { data, error } = await supabase
    .from('devices')
    .select('public_key')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw error;

  if (!data) return 'not_bound';
  const remote = data.public_key as JsonWebKey;
  if (local && local.publicJwk.x === remote.x && local.publicJwk.y === remote.y) {
    return 'bound_here';
  }
  return 'bound_elsewhere';
}

/** Works offline. Used by outbox.ts for every submission and session. */
export async function sign(userId: string, message: string): Promise<string> {
  const db = await getDb();
  const rec = await db.get('keys', userId);
  if (!rec) throw new Error('no_device_key');
  const sig = await crypto.subtle.sign(SIGN_ALGO, rec.privateKey, new TextEncoder().encode(message));
  return toBase64(sig);
}

export async function hasLocalKey(userId: string): Promise<boolean> {
  const db = await getDb();
  return !!(await db.get('keys', userId));
}
