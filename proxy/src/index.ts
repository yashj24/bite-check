// Bite Check proxy: holds the Google API key, validates input, rate-limits per IP.
// It stores nothing. All Google responses are sent with Cache-Control: no-store.

import { embedParamsError, frameAncestors, mapEmbedHtml } from './embed';
import { autocomplete, photoUri, placeDetails, streetViewMetadata, textSearchPlaceId } from './google';
import { privacyHtml } from './privacy';
import * as v from './validate';
import { HttpError } from './validate';

interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  GOOGLE_MAPS_API_KEY: string;
  /** Separate browser key for the hosted map page (referrer-restricted to this domain). */
  MAPS_BROWSER_KEY?: string;
  ALLOWED_ORIGINS: string;
  MAX_PHOTOS_LIMIT?: string;
  RATE_LIMITER?: RateLimiter;
}

// ---- Rate limiting -------------------------------------------------------------
// Prefer the Workers Rate Limiting binding. The in-memory fallback is per-isolate
// and best-effort only (used in local dev or if the binding is missing).
const memoryHits = new Map<string, { count: number; reset: number }>();
const FALLBACK_LIMIT = 60;
const FALLBACK_WINDOW_MS = 60_000;

async function allow(env: Env, ip: string): Promise<boolean> {
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return success;
  }
  const now = Date.now();
  const entry = memoryHits.get(ip);
  if (!entry || entry.reset < now) {
    memoryHits.set(ip, { count: 1, reset: now + FALLBACK_WINDOW_MS });
    if (memoryHits.size > 10_000) memoryHits.clear();
    return true;
  }
  entry.count++;
  return entry.count <= FALLBACK_LIMIT;
}

// ---- Short-lived place_id cache ------------------------------------------------------------
// Only place_ids are cached (the one Places value Google allows you to store), keyed by
// the detected query. In-memory per Worker isolate, so it is best-effort and short-lived.
const PLACE_ID_TTL_MS = 60 * 60 * 1000; // 1 hour
const placeIdCache = new Map<string, { placeId: string; expires: number }>();

function cacheKey(q: string) {
  return q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function cachedPlaceId(q: string): string | null {
  const hit = placeIdCache.get(cacheKey(q));
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    placeIdCache.delete(cacheKey(q));
    return null;
  }
  return hit.placeId;
}
function rememberPlaceId(q: string, placeId: string) {
  if (placeIdCache.size > 5000) placeIdCache.clear();
  placeIdCache.set(cacheKey(q), { placeId, expires: Date.now() + PLACE_ID_TTL_MS });
}

// ---- CORS / origin allowlist ------------------------------------------------------
// Note: an Origin check only stops other websites from using the proxy in a browser.
// Non-browser clients can fake it, so quotas + rate limits are the real guardrail.
// Chrome often omits the Origin header on GET requests from extension pages that
// hold host permissions, so the extension also sends its ID in X-Extension-Id.
const EXTENSION_ID_RE = /^[a-p]{32}$/;

function clientOrigin(req: Request): string | null {
  const origin = req.headers.get('Origin');
  if (origin) return origin;
  const extId = req.headers.get('X-Extension-Id');
  return extId && EXTENSION_ID_RE.test(extId) ? `chrome-extension://${extId}` : null;
}

function originAllowed(env: Env, origin: string | null): boolean {
  if (!origin) return false;
  const list = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  return list.includes('chrome-extension://*') && origin.startsWith('chrome-extension://');
}

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Extension-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(origin ? corsHeaders(origin) : {}),
      ...extra,
    },
  });
}

// ---- Hosted embed page ------------------------------------------------------------------
async function embedStreet(req: Request, env: Env, url: URL): Promise<Response> {
  // Error page that also tells the side panel immediately, instead of leaving it waiting.
  const plain = (body: string, status: number) => {
    const n = crypto.randomUUID().replace(/-/g, '');
    const html =
      `<!doctype html><meta charset="utf-8"><p style="font:14px system-ui;color:#78716c;text-align:center;margin-top:40%">${body}</p>` +
      `<script nonce="${n}">var o=location.ancestorOrigins&&location.ancestorOrigins[0];` +
      `if(o)parent.postMessage({source:'bite-check-embed',type:'error',detail:${status}},o);</script>`;
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': `script-src 'nonce-${n}'; object-src 'none'; base-uri 'none'; frame-ancestors ${frameAncestors(env.ALLOWED_ORIGINS)}`,
      },
    });
  };

  // Opening the page directly in a tab is not supported; it is meant to be framed.
  if (req.headers.get('Sec-Fetch-Dest') === 'document') return plain('This page only works inside Bite Check.', 403);
  if (!env.MAPS_BROWSER_KEY) return plain('Map page not configured.', 500);
  const paramError = embedParamsError(url.searchParams);
  if (paramError) {
    console.warn('embed_bad_params', paramError);
    return plain('Invalid parameters.', 400);
  }

  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await allow(env, ip))) return plain('Too many requests.', 429);

  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = [
    // Google's recommended strict CSP for the Maps JavaScript API.
    `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-eval' blob:`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    "object-src 'none'",
    "base-uri 'none'",
    `frame-ancestors ${frameAncestors(env.ALLOWED_ORIGINS)}`,
  ].join('; ');

  return new Response(mapEmbedHtml(env.MAPS_BROWSER_KEY, nonce), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': csp,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}

// ---- Router --------------------------------------------------------------------------
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = clientOrigin(req);
    const okOrigin = originAllowed(env, origin) ? origin : null;

    if (url.pathname === '/health') return json({ ok: true }, 200, null);

    // Public privacy policy (store listing + side panel footer link).
    if (url.pathname === '/privacy' && req.method === 'GET') {
      return new Response(privacyHtml(), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    // Hosted Street View page, loaded inside the side panel's iframe. Iframe
    // navigations carry no Origin header, so it is guarded by frame-ancestors
    // (only the extension may embed it) and by the browser key's referrer lock.
    if ((url.pathname === '/embed/map' || url.pathname === '/embed/street') && req.method === 'GET') {
      return embedStreet(req, env, url);
    }

    if (req.method === 'OPTIONS') {
      return okOrigin
        ? new Response(null, { status: 204, headers: corsHeaders(okOrigin) })
        : new Response(null, { status: 403 });
    }

    try {
      if (req.method !== 'GET') throw new HttpError(405, 'bad_request', 'Method not allowed.');
      if (!okOrigin) throw new HttpError(403, 'forbidden', 'Origin not allowed.');
      if (!env.GOOGLE_MAPS_API_KEY) throw new HttpError(500, 'upstream', 'Proxy not configured.');

      const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (!(await allow(env, ip))) {
        throw new HttpError(429, 'rate_limited', 'Too many requests. Slow down a little.');
      }

      const key = env.GOOGLE_MAPS_API_KEY;
      const q = url.searchParams;

      if (url.pathname === '/v1/autocomplete') {
        const data = await autocomplete(key, v.searchQuery(q.get('q')), v.sessionToken(q.get('session')));
        return json(data, 200, okOrigin);
      }

      const placeMatch = url.pathname.match(/^\/v1\/place\/([^/]+)$/);
      if (placeMatch) {
        const limit = Number(env.MAX_PHOTOS_LIMIT ?? '10') || 10;
        const data = await placeDetails(
          key,
          v.placeId(decodeURIComponent(placeMatch[1])),
          v.intInRange(q.get('maxPhotos'), 0, limit, 8),
          v.sessionToken(q.get('session')),
        );
        return json(data, 200, okOrigin);
      }

      // Auto-detect: "name, area, city" read from a Zomato/Swiggy page → Google place.
      // 1) Autocomplete: no charge when the session ends in Place Details, and returns
      //    named alternatives for "Not the right place?".
      // 2) Fallback: Text Search IDs-only (no charge), cached briefly.
      if (url.pathname === '/v1/resolve') {
        const query = v.searchQuery(q.get('q'));
        const auto = await autocomplete(key, query, v.sessionToken(q.get('session')));
        if (auto.suggestions.length > 0) {
          return json({ suggestions: auto.suggestions.slice(0, 5), placeId: null }, 200, okOrigin);
        }
        let placeId = cachedPlaceId(query);
        if (!placeId) {
          placeId = await textSearchPlaceId(key, query);
          if (placeId) rememberPlaceId(query, placeId);
        }
        return json({ suggestions: [], placeId }, 200, okOrigin);
      }

      if (url.pathname === '/v1/streetview') {
        const data = await streetViewMetadata(key, v.latLng(q.get('lat'), q.get('lng')));
        return json(data, 200, okOrigin);
      }

      if (url.pathname === '/v1/photo') {
        const data = await photoUri(key, v.photoName(q.get('name')), v.intInRange(q.get('w'), 100, 1600, 800));
        return json(data, 200, okOrigin);
      }

      throw new HttpError(404, 'not_found', 'Unknown endpoint.');
    } catch (err) {
      if (err instanceof HttpError) {
        const extra: HeadersInit = err.status === 429 ? { 'Retry-After': '60' } : {};
        return json({ error: { code: err.code, message: err.message } }, err.status, okOrigin, extra);
      }
      console.error('unhandled', err instanceof Error ? err.message : 'unknown');
      return json({ error: { code: 'upstream', message: 'Unexpected error.' } }, 500, okOrigin);
    }
  },
} satisfies ExportedHandler<Env>;
