import { useEffect, useMemo, useState } from 'react';
import { ApiError, BASE, api, friendlyError } from '../../lib/api';
import type { PlaceDetails, StreetViewInfo } from '../../lib/types';
import { ErrorCard } from './States';

const EMBED_TIMEOUT_MS = 15_000;

type Meta = { status: 'loading' } | { status: 'ready'; info: StreetViewInfo } | { status: 'error'; error: unknown };
type Frame = 'loading' | 'ready' | 'slow' | 'error';

function formatDate(d?: string) {
  if (!d) return null;
  const [y, m] = d.split('-').map(Number);
  if (!y) return null;
  return m ? new Date(y, m - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : String(y);
}

export function StreetViewTab({ place }: { place: PlaceDetails }) {
  const [meta, setMeta] = useState<Meta>({ status: 'loading' });
  const [frame, setFrame] = useState<Frame>('loading');
  const [attempt, setAttempt] = useState(0);
  const loc = place.location;

  // 1. Coverage check (free metadata call via the proxy).
  useEffect(() => {
    if (!loc) return;
    const ctrl = new AbortController();
    setMeta({ status: 'loading' });
    api
      .streetView(loc, ctrl.signal)
      .then((info) => setMeta({ status: 'ready', info }))
      .catch((error) => {
        if (error instanceof ApiError && error.code === 'aborted') return;
        setMeta({ status: 'error', error });
      });
    return () => ctrl.abort();
  }, [loc?.lat, loc?.lng, attempt]);

  const src = useMemo(() => {
    if (!loc || meta.status !== 'ready') return null;
    const qs = new URLSearchParams({ lat: String(loc.lat), lng: String(loc.lng) });
    const { info } = meta;
    if (info.available && info.panoId) {
      qs.set('mode', 'pano');
      qs.set('pano', info.panoId);
      qs.set('heading', String(info.heading ?? 0));
    } else {
      qs.set('mode', 'map');
    }
    return `${BASE}/embed/map?${qs}`;
  }, [loc, meta]);

  // 2. Hosted page tells us when the panorama / map has rendered.
  useEffect(() => {
    if (!src) return;
    setFrame('loading');
    const embedOrigin = new URL(BASE).origin;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== embedOrigin || e.data?.source !== 'bite-check-embed') return;
      if (e.data.type === 'ready') setFrame('ready');
      if (e.data.type === 'error') setFrame('error');
    };
    window.addEventListener('message', onMsg);
    const t = setTimeout(() => setFrame((f) => (f === 'loading' ? 'slow' : f)), EMBED_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', onMsg);
      clearTimeout(t);
    };
  }, [src, attempt]);

  if (!loc) {
    return <ErrorCard title="No location" detail="Google Maps has no coordinates for this place." />;
  }
  if (meta.status === 'error') {
    const f = friendlyError(meta.error);
    return <ErrorCard {...f} onRetry={f.retryable ? () => setAttempt((a) => a + 1) : undefined} />;
  }

  const info = meta.status === 'ready' ? meta.info : null;
  const date = formatDate(info?.date);

  return (
    <section aria-label="Street View" className="space-y-2">
      {info && !info.available && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          No Street View within 50 m of this place. Showing the satellite view instead.
        </p>
      )}

      <div className="relative h-[340px] overflow-hidden rounded-2xl bg-stone-200 dark:bg-stone-800">
        {(meta.status === 'loading' || frame === 'loading' || frame === 'slow') && frame !== 'error' && (
          <div className="skeleton absolute inset-0 grid place-items-center">
            <span className="text-xs text-stone-500">
              {frame === 'slow' ? 'Still loading… your connection seems slow.' : 'Loading view…'}
            </span>
          </div>
        )}
        {frame === 'error' && (
          <div className="absolute inset-0 grid place-items-center p-4">
            <ErrorCard
              title="View unavailable"
              detail="The map couldn’t load. If this keeps happening, the map key may be misconfigured."
              onRetry={() => setAttempt((a) => a + 1)}
            />
          </div>
        )}
        {src && (
          <iframe
            key={`${src}#${attempt}`}
            src={src}
            title={info?.available ? 'Street View near the restaurant' : 'Satellite view of the restaurant'}
            // Locked down: scripts for the map, popups so Google's own links/terms open in a tab.
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="strict-origin-when-cross-origin"
            className={`absolute inset-0 size-full border-0 transition-opacity ${frame === 'ready' ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>

      {info?.available && (
        <p className="text-xs text-stone-600 dark:text-stone-300">
          {info.distanceM !== undefined && info.distanceM > 10 ? `Nearest view is about ${info.distanceM} m away` : 'Right outside'}
          {date && ` · captured ${date}`}. Drag to look around.
        </p>
      )}
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Street View mostly shows the street and the outside of the building. Indoor 360° views exist only where Google
        has captured them, so they may be old or missing.
      </p>
    </section>
  );
}
