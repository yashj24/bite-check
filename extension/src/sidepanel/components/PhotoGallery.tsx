import { useEffect, useRef, useState } from 'react';
import { usePhotoUri } from '../../lib/usePhotoUri';
import type { Photo } from '../../lib/types';

/** Attribution exactly as the API returns it: author display name, linked to their profile. */
function Attribution({ photo, className = '' }: { photo: Photo; className?: string }) {
  if (photo.attributions.length === 0) return null;
  return (
    <span className={className}>
      Photo:{' '}
      {photo.attributions.map((a, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {a.uri ? (
            <a href={a.uri} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {a.displayName}
            </a>
          ) : (
            a.displayName
          )}
        </span>
      ))}
    </span>
  );
}

function Slide({ photo, index, total, shouldLoad }: { photo: Photo; index: number; total: number; shouldLoad: boolean }) {
  // Once a slide has been near the viewport, keep it loaded.
  const [armed, setArmed] = useState(shouldLoad);
  useEffect(() => {
    if (shouldLoad) setArmed(true);
  }, [shouldLoad]);
  const { uri, error, retry } = usePhotoUri(photo.name, armed);
  const [loaded, setLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const failed = error || imgFailed;

  return (
    <figure
      className="relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden bg-stone-200 dark:bg-stone-800"
      aria-roledescription="slide"
      aria-label={`Photo ${index + 1} of ${total}`}
    >
      {!loaded && !failed && <div className="skeleton absolute inset-0" />}
      {uri && !imgFailed && (
        <img
          src={uri}
          alt={`Photo ${index + 1} of ${total} from Google Maps`}
          referrerPolicy="no-referrer"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setImgFailed(true)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500">
          <span>Couldn’t load this photo.</span>
          <button
            type="button"
            onClick={() => {
              setImgFailed(false);
              setLoaded(false);
              retry();
            }}
            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-800 shadow dark:bg-stone-700 dark:text-stone-100"
          >
            Retry
          </button>
        </div>
      )}
      {/* Per-photo author attribution, always visible on the photo it belongs to */}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 text-[11px] text-white">
        <Attribution photo={photo} className="min-w-0 truncate" />
        {photo.flagContentUri && (
          <a href={photo.flagContentUri} target="_blank" rel="noopener noreferrer" className="shrink-0 opacity-80 hover:opacity-100">
            Report
          </a>
        )}
      </figcaption>
    </figure>
  );
}

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 p-6 text-center dark:border-stone-700">
        <p className="text-2xl" aria-hidden>📷</p>
        <p className="mt-2 text-sm font-medium">No photos on Google Maps yet</p>
        <p className="mt-1 text-xs text-stone-500">Try Street View to see the outside of the place.</p>
      </div>
    );
  }

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    setActive(clamped);
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) setActive(i);
  };

  return (
    <section aria-label="Photos" aria-roledescription="carousel" className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl">
        <div
          ref={track}
          tabIndex={0}
          onScroll={onScroll}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') goTo(active + 1);
            if (e.key === 'ArrowLeft') goTo(active - 1);
          }}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {photos.map((p, i) => (
            // Only the current and next photo are requested (each request is billed);
            // earlier ones stay loaded once seen.
            <Slide key={p.name} photo={p} index={i} total={photos.length} shouldLoad={i === active || i === active + 1} />
          ))}
        </div>

        <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
          {active + 1} / {photos.length}
        </span>
        {active > 0 && (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => goTo(active - 1)}
            className="absolute top-1/2 left-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-stone-800 shadow hover:bg-white dark:bg-stone-900/80 dark:text-stone-100"
          >
            ‹
          </button>
        )}
        {active < photos.length - 1 && (
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => goTo(active + 1)}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-stone-800 shadow hover:bg-white dark:bg-stone-900/80 dark:text-stone-100"
          >
            ›
          </button>
        )}
      </div>

      {/* Dots instead of image thumbnails: thumbnails would each be a billed photo request. */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5" role="group" aria-label="Choose photo">
          {photos.map((p, i) => (
            <button
              key={p.name}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1} of ${photos.length}`}
              aria-current={i === active}
              className="grid size-5 place-items-center"
            >
              <span
                className={`block rounded-full transition-all ${
                  i === active ? 'h-2 w-4 bg-brand-500' : 'size-2 bg-stone-300 hover:bg-stone-400 dark:bg-stone-700'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-stone-500 dark:text-stone-400">
        Photos are from Google Maps and may include food shots.
      </p>
    </section>
  );
}

export function PhotoGallerySkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="skeleton aspect-[4/3] w-full rounded-2xl" />
      <div className="flex justify-center gap-1.5 py-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton size-2 rounded-full" />
        ))}
      </div>
    </div>
  );
}
