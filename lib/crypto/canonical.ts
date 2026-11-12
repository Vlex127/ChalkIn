// Shared by the browser (to sign) and /api/sync (to verify).
// If these two ever disagree by a single character, every signature fails,
// so keep the field order and number formatting exactly as written.
//
// Clients must round before building the payload:
//   lat / lng -> 6 decimals, accuracyM -> whole number.

export type SubmissionPayload = {
  id: string;            // client-generated uuid (idempotency key)
  courseId: string;
  codeEntered: string;   // 6 digits
  clientTs: string;      // ISO string from the phone clock
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
};

export type SessionPayload = {
  id: string;
  courseId: string;
  code: string;          // 6 digits
  openedAt: string;
  closedAt: string | null;
  lat: number | null;
  lng: number | null;
};

const fmt = (v: number | null, digits: number) =>
  v === null ? '' : v.toFixed(digits);

// The prefix stops a signature made for one kind of record being replayed as another.
export function canonicalSubmission(p: SubmissionPayload): string {
  return [
    'chalkin:submission:v1',
    p.id,
    p.courseId,
    p.codeEntered,
    p.clientTs,
    fmt(p.lat, 6),
    fmt(p.lng, 6),
    fmt(p.accuracyM, 0),
  ].join('|');
}

export function canonicalSession(p: SessionPayload): string {
  return [
    'chalkin:session:v1',
    p.id,
    p.courseId,
    p.code,
    p.openedAt,
    p.closedAt ?? '',
    fmt(p.lat, 6),
    fmt(p.lng, 6),
  ].join('|');
}
