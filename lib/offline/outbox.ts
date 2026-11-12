import { getDb, type LiveSession, type OutboxItem } from './db';
import { sign } from '../crypto/deviceKey';
import {
  canonicalSession,
  canonicalSubmission,
  type SessionPayload,
  type SubmissionPayload,
} from '../crypto/canonical';
import { generateCode } from '../code';

const SESSION_MINUTES = 5;
const round6 = (n: number) => Number(n.toFixed(6));

type Position = { lat: number; lng: number; accuracy: number };

// GPS works without internet. Never block the student for more than ~4s.
function getPosition(): Promise<Position | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: round6(p.coords.latitude),
          lng: round6(p.coords.longitude),
          accuracy: Math.round(p.coords.accuracy),
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 120_000 },
    ),
  );
}

export const receiptCode = (id: string) => id.slice(0, 4).toUpperCase();

// ---------------------------------------------------------------------------
// STUDENT
// ---------------------------------------------------------------------------

/** Did this student already submit for this course in the last few minutes? */
export async function findRecentSubmission(
  userId: string,
  courseId: string,
  withinMs = 10 * 60_000,
): Promise<OutboxItem | undefined> {
  const db = await getDb();
  const since = Date.now() - withinMs;
  const mine = await db.getAllFromIndex('outbox', 'by-user', userId);
  return mine.find(
    (i) => i.kind === 'submission' && i.payload.courseId === courseId && i.createdAt >= since,
  );
}

/**
 * Save a submission on the phone. No network call. Returns the id, which the
 * UI shows as the receipt. The sync engine sends it later.
 */
export async function enqueueSubmission(
  userId: string,
  courseId: string,
  code: string,
): Promise<{ id: string }> {
  if (!/^\d{6}$/.test(code)) throw new Error('bad_code');

  const pos = await getPosition();
  const payload: SubmissionPayload = {
    id: crypto.randomUUID(),
    courseId,
    codeEntered: code,
    clientTs: new Date().toISOString(),
    lat: pos?.lat ?? null,
    lng: pos?.lng ?? null,
    accuracyM: pos?.accuracy ?? null,
  };
  const signature = await sign(userId, canonicalSubmission(payload));

  const db = await getDb();
  await db.put('outbox', {
    id: payload.id,
    userId,
    kind: 'submission',
    payload,
    signature,
    state: 'queued',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Date.now(),
  });
  return { id: payload.id };
}

// ---------------------------------------------------------------------------
// LECTURER
// A session lives in the 'live' store while open. Only when it is closed is the
// FINAL record (with closedAt) signed and moved to the outbox, so the server
// only ever sees one signed version.
// ---------------------------------------------------------------------------

async function freshCode(userId: string, courseId: string): Promise<string> {
  const db = await getDb();
  const dayAgo = Date.now() - 24 * 3600_000;
  const recent = new Set<string>();
  for (const i of await db.getAllFromIndex('outbox', 'by-user', userId)) {
    if (i.kind === 'session' && i.payload.courseId === courseId && i.createdAt >= dayAgo) {
      recent.add(i.payload.code);
    }
  }
  for (const l of await db.getAllFromIndex('live', 'by-user', userId)) {
    if (l.courseId === courseId) recent.add(l.code);
  }
  // Avoid reusing a code from the last 24h for the same course.
  for (let n = 0; n < 20; n++) {
    const c = generateCode();
    if (!recent.has(c)) return c;
  }
  return generateCode();
}

export async function startSession(userId: string, courseId: string): Promise<LiveSession> {
  const db = await getDb();
  const pos = await getPosition();
  const now = Date.now();
  const live: LiveSession = {
    id: crypto.randomUUID(),
    userId,
    courseId,
    code: await freshCode(userId, courseId),
    openedAt: new Date(now).toISOString(),
    plannedEndAt: now + SESSION_MINUTES * 60_000,
    lat: pos?.lat ?? null,
    lng: pos?.lng ?? null,
  };
  await db.put('live', live);
  return live;
}

export async function extendSession(userId: string, id: string, minutes = 5): Promise<void> {
  const db = await getDb();
  const live = await db.get('live', id);
  if (!live || live.userId !== userId) return;
  await db.put('live', { ...live, plannedEndAt: live.plannedEndAt + minutes * 60_000 });
}

async function finalize(userId: string, id: string, atMs: number): Promise<void> {
  const db = await getDb();
  const live = await db.get('live', id);
  if (!live || live.userId !== userId) return;

  // Never later than the planned end, even if the lecturer closes late.
  const closedAt = new Date(Math.min(atMs, live.plannedEndAt)).toISOString();
  const payload: SessionPayload = {
    id: live.id,
    courseId: live.courseId,
    code: live.code,
    openedAt: live.openedAt,
    closedAt,
    lat: live.lat,
    lng: live.lng,
  };
  const signature = await sign(userId, canonicalSession(payload));

  const tx = db.transaction(['outbox', 'live'], 'readwrite');
  await tx.objectStore('outbox').put({
    id: payload.id,
    userId,
    kind: 'session',
    payload,
    signature,
    state: 'queued',
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Date.now(),
  });
  await tx.objectStore('live').delete(id);
  await tx.done;
}

export const closeSession = (userId: string, id: string) => finalize(userId, id, Date.now());

/**
 * Call on app start. If the lecturer's phone died or the app was closed
 * mid-session, close it at its planned end time so it still gets synced.
 */
export async function finalizeExpiredSessions(userId: string): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  for (const l of await db.getAllFromIndex('live', 'by-user', userId)) {
    if (l.plannedEndAt < now) await finalize(userId, l.id, l.plannedEndAt);
  }
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Items the server has not received yet. Use this to warn before logout. */
export async function countUnsent(userId: string): Promise<number> {
  const db = await getDb();
  const mine = await db.getAllFromIndex('outbox', 'by-user', userId);
  return mine.filter((i) => i.state !== 'sent').length;
}
