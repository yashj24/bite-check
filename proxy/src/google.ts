// Thin wrappers around Places API (New). Every call sends a strict field mask.
// Nothing here is cached or stored: responses are mapped and returned once.

import { HttpError } from './validate';

const BASE = 'https://places.googleapis.com/v1';
const TIMEOUT_MS = 8000;

// --- Field masks (billing tier is set by the most expensive field) -----------
// Autocomplete: no charge per request when the session ends in a Details call.
const AUTOCOMPLETE_MASK =
  'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat';
// Details: rating, priceLevel and currentOpeningHours make this the Enterprise tier.
// Trim these if you want the cheaper Pro tier (see README, "Cost").
const DETAILS_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'googleMapsUri',
  'businessStatus',
  'photos',
  'rating',
  'userRatingCount',
  'priceLevel',
  'currentOpeningHours',
].join(',');

// Types used for autocomplete filtering (max 5 for includedPrimaryTypes).
const FOOD_TYPES = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway'];

// --- Public response shapes (what the extension receives) ---------------------
export interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

export interface PhotoAttribution {
  displayName: string;
  uri?: string;
}

export interface Photo {
  name: string;
  widthPx: number;
  heightPx: number;
  attributions: PhotoAttribution[];
  flagContentUri?: string;
}

export interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number } | null;
  googleMapsUri: string | null;
  businessStatus: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  photos: Photo[];
}

// --- Core fetch ----------------------------------------------------------------
async function callGoogle(apiKey: string, url: string, init: RequestInit & { fieldMask?: string }) {
  const headers = new Headers(init.headers);
  headers.set('X-Goog-Api-Key', apiKey); // header, so the key never appears in URLs/logs
  if (init.fieldMask) headers.set('X-Goog-FieldMask', init.fieldMask);
  if (init.body) headers.set('Content-Type', 'application/json');

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers,
      body: init.body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new HttpError(504, 'timeout', 'Google Maps took too long to respond.');
    }
    throw new HttpError(502, 'upstream', 'Could not reach Google Maps.');
  }

  if (res.ok) return res.json<any>();

  // Map upstream errors without leaking details about the key or project.
  let status = '';
  try {
    status = ((await res.json()) as any)?.error?.status ?? '';
  } catch {
    /* ignore */
  }
  console.warn('google_error', res.status, status); // no request data logged
  if (res.status === 429 || status === 'RESOURCE_EXHAUSTED') {
    throw new HttpError(503, 'quota', 'Google Maps quota reached. Try again later.');
  }
  if (res.status === 404 || status === 'NOT_FOUND') {
    throw new HttpError(404, 'not_found', 'Place not found.');
  }
  if (res.status === 400) {
    throw new HttpError(400, 'bad_request', 'Google Maps rejected the request.');
  }
  throw new HttpError(502, 'upstream', 'Google Maps returned an error.');
}

// --- Endpoints -------------------------------------------------------------------
export async function autocomplete(apiKey: string, input: string, sessionToken?: string) {
  const data = await callGoogle(apiKey, `${BASE}/places:autocomplete`, {
    method: 'POST',
    fieldMask: AUTOCOMPLETE_MASK,
    body: JSON.stringify({
      input,
      sessionToken,
      includedPrimaryTypes: FOOD_TYPES,
      languageCode: 'en',
    }),
  });
  const suggestions: Suggestion[] = (data?.suggestions ?? [])
    .map((s: any) => s.placePrediction)
    .filter(Boolean)
    .map((p: any) => ({
      placeId: p.placeId,
      primary: p.structuredFormat?.mainText?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
  return { suggestions };
}

export async function placeDetails(
  apiKey: string,
  id: string,
  maxPhotos: number,
  sessionToken?: string,
): Promise<PlaceDetails> {
  const qs = new URLSearchParams({ languageCode: 'en' });
  if (sessionToken) qs.set('sessionToken', sessionToken);
  const p = await callGoogle(apiKey, `${BASE}/places/${encodeURIComponent(id)}?${qs}`, {
    fieldMask: DETAILS_MASK,
  });

  return {
    id: p.id,
    name: p.displayName?.text ?? 'Unnamed place',
    address: p.formattedAddress ?? '',
    location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    googleMapsUri: p.googleMapsUri ?? null,
    businessStatus: p.businessStatus ?? null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    userRatingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    priceLevel: p.priceLevel ?? null,
    openNow:
      typeof p.currentOpeningHours?.openNow === 'boolean' ? p.currentOpeningHours.openNow : null,
    photos: (p.photos ?? []).slice(0, maxPhotos).map(
      (ph: any): Photo => ({
        name: ph.name,
        widthPx: ph.widthPx,
        heightPx: ph.heightPx,
        // Passed through as returned by the API; the UI must display these.
        attributions: (ph.authorAttributions ?? []).map((a: any) => ({
          displayName: a.displayName ?? '',
          uri: a.uri || undefined,
        })),
        flagContentUri: ph.flagContentUri || undefined,
      }),
    ),
  };
}

// --- Text Search (New), IDs only --------------------------------------------------
// Requesting only `places.id` bills the "Text Search Essentials (IDs Only)" SKU,
// which has no charge. Used as a fallback when Autocomplete finds nothing.
export async function textSearchPlaceId(apiKey: string, textQuery: string): Promise<string | null> {
  const data = await callGoogle(apiKey, `${BASE}/places:searchText`, {
    method: 'POST',
    fieldMask: 'places.id',
    body: JSON.stringify({ textQuery, pageSize: 1, languageCode: 'en' }),
  });
  const id = data?.places?.[0]?.id;
  return typeof id === 'string' ? id : null;
}

// --- Street View coverage (Street View Static API metadata: no charge) ----------
export interface StreetViewInfo {
  available: boolean;
  panoId?: string;
  /** Compass heading from the panorama to the restaurant, 0-360. */
  heading?: number;
  /** Distance in metres between the panorama and the restaurant. */
  distanceM?: number;
  /** Capture month, "YYYY-MM", as returned by Google. */
  date?: string;
}

const SV_RADIUS_M = 50;

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const dφ = toRad(b.lat - a.lat);
  const dλ = toRad(b.lng - a.lng);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function streetViewMetadata(
  apiKey: string,
  place: { lat: number; lng: number },
): Promise<StreetViewInfo> {
  // This legacy endpoint only accepts the key as a query parameter. The URL is
  // built here on the server and never logged or returned.
  const qs = new URLSearchParams({
    location: `${place.lat},${place.lng}`,
    radius: String(SV_RADIUS_M),
    key: apiKey,
  });
  let res: Response;
  try {
    res = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${qs}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new HttpError(504, 'timeout', 'Google Maps took too long to respond.');
    }
    throw new HttpError(502, 'upstream', 'Could not reach Google Maps.');
  }
  const data: any = await res.json().catch(() => null);
  const status: string = data?.status ?? '';

  if (status === 'OK' && data.pano_id && data.location) {
    const pano = { lat: data.location.lat, lng: data.location.lng };
    return {
      available: true,
      panoId: data.pano_id,
      heading: Math.round(bearing(pano, place)),
      distanceM: Math.round(distance(pano, place)),
      date: typeof data.date === 'string' ? data.date : undefined,
    };
  }
  if (status === 'ZERO_RESULTS' || status === 'NOT_FOUND') return { available: false };

  console.warn('streetview_error', res.status, status);
  if (status === 'OVER_QUERY_LIMIT') throw new HttpError(503, 'quota', 'Google Maps quota reached. Try again later.');
  throw new HttpError(502, 'upstream', 'Street View is unavailable right now.');
}

// Returns a short-lived Google-hosted image URL. The image bytes never pass
// through (or get stored on) the proxy: the browser loads them from Google.
export async function photoUri(apiKey: string, name: string, maxWidthPx: number) {
  const qs = new URLSearchParams({ maxWidthPx: String(maxWidthPx), skipHttpRedirect: 'true' });
  const data = await callGoogle(apiKey, `${BASE}/${name}/media?${qs}`, {});
  if (typeof data?.photoUri !== 'string' || !data.photoUri.startsWith('https://')) {
    throw new HttpError(502, 'upstream', 'Photo unavailable.');
  }
  return { photoUri: data.photoUri as string };
}
