import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, friendlyError } from '../lib/api';
import {
  DEFAULT_MAX_PHOTOS,
  getLastPlaceId,
  getMaxPhotos,
  PHOTO_CAP_OPTIONS,
  setLastPlaceId,
  setMaxPhotos,
} from '../lib/storage';
import type { PlaceDetails, Suggestion } from '../lib/types';
import { useDetection } from '../lib/useDetection';
import { DetectedBanner, NotRightPlace } from './components/Detected';
import { InfoStrip, InfoStripSkeleton } from './components/InfoStrip';
import { PhotoGallery, PhotoGallerySkeleton } from './components/PhotoGallery';
import { SearchBox } from './components/SearchBox';
import { StreetViewTab } from './components/StreetViewTab';
import { EmptyState, ErrorCard } from './components/States';

type Tab = 'photos' | 'street';
const TABS: { id: Tab; label: string }[] = [
  { id: 'photos', label: 'Photos' },
  { id: 'street', label: 'Street View' },
];

type View =
  | { status: 'idle' }
  | { status: 'loading'; placeId: string }
  | { status: 'ready'; place: PlaceDetails }
  | { status: 'error'; placeId: string; error: unknown };

const SLOW_MS = 4000;

export function App() {
  const [view, setView] = useState<View>({ status: 'idle' });
  const [tab, setTab] = useState<Tab>('photos');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(['photos']));
  const [maxPhotos, setMax] = useState<number | null>(null);
  const [lastPlaceId, setLast] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  // Auto-detect (Zomato/Swiggy). Nothing is looked up until the user clicks View.
  const detection = useDetection();
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Suggestion[]>([]);
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null);

  // A new detection (user moved to another restaurant page) resets the banner's error.
  useEffect(() => setResolveError(null), [detection?.query]);

  useEffect(() => {
    getMaxPhotos().then(setMax);
    getLastPlaceId().then(setLast);
  }, []);

  const load = useCallback(
    (placeId: string, session?: string) => {
      inflight.current?.abort();
      const ctrl = new AbortController();
      inflight.current = ctrl;
      setView({ status: 'loading', placeId });
      setTab('photos');
      setVisited(new Set<Tab>(['photos'])); // new place → other tabs lazy again
      setSlow(false);
      const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);

      api
        .place(placeId, { maxPhotos: maxPhotos ?? DEFAULT_MAX_PHOTOS, session }, ctrl.signal)
        .then((place) => {
          setView({ status: 'ready', place });
          setLastPlaceId(place.id); // place_id only — nothing else is stored
          setLast(place.id);
        })
        .catch((error) => {
          if (error instanceof ApiError && error.code === 'aborted') return;
          setView({ status: 'error', placeId, error });
        })
        .finally(() => clearTimeout(slowTimer));
    },
    [maxPhotos],
  );

  const viewDetected = async () => {
    if (!detection) return;
    setResolving(true);
    setResolveError(null);
    const session = crypto.randomUUID(); // ends in the Details call below → Autocomplete is free
    try {
      const r = await api.resolve(detection.query, session);
      if (r.suggestions.length > 0) {
        setCandidates(r.suggestions);
        setResolvedQuery(detection.query);
        load(r.suggestions[0].placeId, session);
      } else if (r.placeId) {
        setCandidates([]);
        setResolvedQuery(detection.query);
        load(r.placeId);
      } else {
        setResolveError('Couldn’t find this place on Google Maps. Try searching above.');
        setPrefill({ text: detection.name, n: Date.now() });
      }
    } catch (err) {
      setResolveError(friendlyError(err).detail);
    } finally {
      setResolving(false);
    }
  };

  const onManualSelect = (placeId: string, session: string) => {
    setCandidates([]);
    setResolvedQuery(null);
    load(placeId, session);
  };

  // Hide the banner once the detected restaurant is the one being shown.
  const showBanner = detection != null && detection.query !== resolvedQuery;
  const currentId = view.status === 'ready' ? view.place.id : view.status !== 'idle' ? view.placeId : null;
  const alternatives = candidates.filter((c) => c.placeId !== currentId);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <header className="sticky top-0 z-30 space-y-3 border-b border-stone-200 bg-stone-50/95 px-4 pt-3 pb-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-32.png" alt="" className="size-6" />
            <span className="text-base font-bold tracking-tight">
              Bite <span className="text-brand-500">Check</span>
            </span>
          </div>
          {maxPhotos !== null && (
            <label className="flex items-center gap-1 text-xs text-stone-500">
              Photos
              <select
                value={maxPhotos}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setMax(n);
                  setMaxPhotos(n);
                }}
                className="rounded-md border border-stone-200 bg-white px-1 py-0.5 text-xs dark:border-stone-700 dark:bg-stone-900"
              >
                {PHOTO_CAP_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <SearchBox onSelect={onManualSelect} prefill={prefill} />
        {showBanner && detection && (
          <DetectedBanner detection={detection} busy={resolving} error={resolveError} onView={viewDetected} />
        )}
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        {view.status === 'idle' && (
          <EmptyState onReopenLast={lastPlaceId ? () => load(lastPlaceId) : undefined} />
        )}

        {view.status === 'loading' && (
          <>
            <InfoStripSkeleton />
            <PhotoGallerySkeleton />
            {slow && <p className="text-center text-xs text-stone-500">Still loading… your connection seems slow.</p>}
          </>
        )}

        {view.status === 'error' && (
          <ErrorCard
            {...friendlyError(view.error)}
            onRetry={friendlyError(view.error).retryable ? () => load(view.placeId) : undefined}
          />
        )}

        {view.status === 'ready' && (
          <>
            <InfoStrip place={view.place} />

            {alternatives.length > 0 && (
              <NotRightPlace
                alternatives={alternatives}
                onPick={(s) => load(s.placeId)}
                onSearchManually={() => setPrefill({ text: view.place.name, n: Date.now() })}
              />
            )}

            <div role="tablist" aria-label="Views" className="grid grid-cols-2 rounded-xl bg-stone-200/70 p-1 dark:bg-stone-900">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => {
                    setTab(t.id);
                    setVisited((v) => (v.has(t.id) ? v : new Set(v).add(t.id)));
                  }}
                  className={`rounded-lg py-1.5 text-xs font-medium transition ${
                    tab === t.id
                      ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-white'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* A tab mounts the first time it is opened (lazy), then stays mounted but
                hidden, so switching back does not reload (and re-bill) the map. */}
            <div role="tabpanel" id="panel-photos" hidden={tab !== 'photos'}>
              <PhotoGallery key={view.place.id} photos={view.place.photos} />
            </div>
            <div role="tabpanel" id="panel-street" hidden={tab !== 'street'}>
              {visited.has('street') && <StreetViewTab key={view.place.id} place={view.place} />}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-stone-200 px-4 py-2 text-[11px] text-stone-500 dark:border-stone-800">
        Place info and photos from <span className="font-medium text-stone-700 dark:text-stone-300">Google Maps</span>.
        Bite Check is not affiliated with Google, Zomato or Swiggy.
      </footer>
    </div>
  );
}
