import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SubmissionPayload, SessionPayload } from '../crypto/canonical';

export type ServerStatus = 'pending' | 'verified' | 'flagged' | 'rejected' | 'expired';

export interface DeviceKeyRecord {
  userId: string;
  privateKey: CryptoKey;       // non-extractable: JS can sign with it but never read it
  publicJwk: JsonWebKey;
  createdAt: number;
}

// A session the lecturer has opened but not closed yet.
export interface LiveSession {
  id: string;
  userId: string;
  courseId: string;
  code: string;
  openedAt: string;
  plannedEndAt: number;        // ms since epoch
  lat: number | null;
  lng: number | null;
}

// state      = has the SERVER received it yet? (queued -> sending -> sent)
// serverStatus = what the server decided about it (only meaningful once sent)
export type OutboxItem = {
  id: string;
  userId: string;
  createdAt: number;
  signature: string;
  state: 'queued' | 'sending' | 'sent';
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  serverStatus?: ServerStatus;
  serverReason?: string | null;
} & (
  | { kind: 'submission'; payload: SubmissionPayload }
  | { kind: 'session'; payload: SessionPayload }
);

interface ChalkDB extends DBSchema {
  outbox: { key: string; value: OutboxItem; indexes: { 'by-user': string } };
  keys:   { key: string; value: DeviceKeyRecord };
  live:   { key: string; value: LiveSession; indexes: { 'by-user': string } };
  cache:  { key: string; value: { key: string; value: unknown; updatedAt: number } };
}

let dbPromise: Promise<IDBPDatabase<ChalkDB>> | null = null;

export function getDb() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available here (server render?)');
  }
  return (dbPromise ??= openDB<ChalkDB>('chalkin', 1, {
    upgrade(db) {
      const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
      outbox.createIndex('by-user', 'userId');
      db.createObjectStore('keys', { keyPath: 'userId' });
      const live = db.createObjectStore('live', { keyPath: 'id' });
      live.createIndex('by-user', 'userId');
      db.createObjectStore('cache', { keyPath: 'key' });
    },
  }));
}

// Ask the browser not to evict our data. Call once after login.
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
