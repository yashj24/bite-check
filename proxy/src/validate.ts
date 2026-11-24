// Input validation. Everything coming from the client is untrusted.

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type ErrorCode =
  | 'bad_request'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'quota'
  | 'timeout'
  | 'upstream';

const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,512}$/;
const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]{10,512}\/photos\/[A-Za-z0-9_-]{10,1024}$/;
// Google session tokens: URL/filename-safe base64, max 36 chars (a UUID fits).
const SESSION_RE = /^[A-Za-z0-9_-]{8,36}$/;

export function searchQuery(raw: string | null): string {
  // Strip control characters and collapse whitespace.
  const q = (raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (q.length < 2 || q.length > 100) {
    throw new HttpError(400, 'bad_request', 'Query must be 2-100 characters.');
  }
  return q;
}

export function placeId(raw: string | null): string {
  if (!raw || !PLACE_ID_RE.test(raw)) throw new HttpError(400, 'bad_request', 'Invalid place id.');
  return raw;
}

export function photoName(raw: string | null): string {
  if (!raw || !PHOTO_NAME_RE.test(raw)) throw new HttpError(400, 'bad_request', 'Invalid photo name.');
  return raw;
}

export function sessionToken(raw: string | null): string | undefined {
  if (raw == null || raw === '') return undefined;
  if (!SESSION_RE.test(raw)) throw new HttpError(400, 'bad_request', 'Invalid session token.');
  return raw;
}

export function latLng(rawLat: string | null, rawLng: string | null): { lat: number; lng: number } {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (rawLat == null || rawLng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new HttpError(400, 'bad_request', 'Invalid coordinates.');
  }
  // 6 decimals is ~10 cm; anything more is noise.
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

export function intInRange(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, 'bad_request', `Expected an integer between ${min} and ${max}.`);
  }
  return n;
}
