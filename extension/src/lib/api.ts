import type { ApiErrorCode, PlaceDetails, StreetViewInfo, Suggestion } from './types';

export const BASE = (import.meta.env.VITE_PROXY_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8787';
const TIMEOUT_MS = 10_000;

/** Max width requested from Place Photos. One size is used for both preview and
 *  thumbnails so each photo is billed once. ~2x the side panel width. */
export const PHOTO_WIDTH = 800;

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string, params: Record<string, string | undefined>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) if (val !== undefined) qs.set(k, val);

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs.size ? `?${qs}` : ''}`, {
      signal: combined,
      cache: 'no-store',
      // Chrome may omit Origin for extension GETs; the proxy checks this instead.
      headers: { 'X-Extension-Id': chrome.runtime.id },
    });
  } catch (err) {
    if (signal?.aborted) throw new ApiError('aborted', 'Cancelled.');
    if (timeout.aborted) throw new ApiError('timeout', 'This is taking too long. Check your connection.');
    throw new ApiError('network', "Can't reach Bite Check right now. Check your connection.");
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const code: ApiErrorCode = body?.error?.code ?? 'upstream';
    throw new ApiError(code, body?.error?.message ?? 'Something went wrong.');
  }
  return body as T;
}

export const api = {
  autocomplete(q: string, session: string, signal?: AbortSignal) {
    return get<{ suggestions: Suggestion[] }>('/v1/autocomplete', { q, session }, signal);
  },
  place(placeId: string, opts: { maxPhotos: number; session?: string }, signal?: AbortSignal) {
    return get<PlaceDetails>(
      `/v1/place/${encodeURIComponent(placeId)}`,
      { maxPhotos: String(opts.maxPhotos), session: opts.session },
      signal,
    );
  },
  /** Detected "name, area, city" → Google place candidates (free; see proxy). */
  resolve(q: string, session: string, signal?: AbortSignal) {
    return get<{ suggestions: Suggestion[]; placeId: string | null }>('/v1/resolve', { q, session }, signal);
  },
  streetView(loc: { lat: number; lng: number }, signal?: AbortSignal) {
    return get<StreetViewInfo>('/v1/streetview', { lat: String(loc.lat), lng: String(loc.lng) }, signal);
  },
  photoUri(name: string, w = PHOTO_WIDTH, signal?: AbortSignal) {
    return get<{ photoUri: string }>('/v1/photo', { name, w: String(w) }, signal);
  },
};

export function friendlyError(err: unknown): { title: string; detail: string; retryable: boolean } {
  const code = err instanceof ApiError ? err.code : 'upstream';
  switch (code) {
    case 'rate_limited':
      return { title: 'Easy there!', detail: 'Too many lookups in a minute. Wait a moment and try again.', retryable: true };
    case 'quota':
      return { title: 'Daily limit reached', detail: 'Google Maps lookups are paused for now. Please try later.', retryable: true };
    case 'not_found':
      return { title: 'Place not found', detail: 'Google Maps no longer lists this place.', retryable: false };
    case 'timeout':
    case 'network':
      return { title: 'Connection trouble', detail: (err as Error).message, retryable: true };
    case 'forbidden':
      return { title: 'Not allowed', detail: 'This extension build is not authorised by the proxy.', retryable: false };
    default:
      return { title: 'Something went wrong', detail: 'Google Maps data could not be loaded.', retryable: true };
  }
}
