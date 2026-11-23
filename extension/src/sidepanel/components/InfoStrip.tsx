import type { PlaceDetails } from '../../lib/types';

const PRICE_LABEL: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: 'Inexpensive',
  PRICE_LEVEL_MODERATE: 'Moderate',
  PRICE_LEVEL_EXPENSIVE: 'Expensive',
  PRICE_LEVEL_VERY_EXPENSIVE: 'Very expensive',
};

function Badge({ tone, children }: { tone: 'green' | 'red' | 'stone'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    stone: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function InfoStrip({ place }: { place: PlaceDetails }) {
  const price = place.priceLevel ? PRICE_LABEL[place.priceLevel] : undefined;
  const closedForGood = place.businessStatus === 'CLOSED_PERMANENTLY';
  const closedTemp = place.businessStatus === 'CLOSED_TEMPORARILY';

  return (
    <section aria-label="Place info" className="space-y-1.5">
      <h1 className="text-lg leading-tight font-semibold">{place.name}</h1>
      {place.address && <p className="text-xs text-stone-500 dark:text-stone-400">{place.address}</p>}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {place.rating !== null && (
          <span className="inline-flex items-center gap-1 font-medium">
            <svg aria-hidden viewBox="0 0 20 20" className="size-4 text-amber-500" fill="currentColor">
              <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
            </svg>
            {place.rating.toFixed(1)}
            {place.userRatingCount !== null && (
              <span className="font-normal text-stone-500">({place.userRatingCount.toLocaleString()})</span>
            )}
          </span>
        )}
        {price && <span className="text-stone-600 dark:text-stone-300">· {price}</span>}
        {closedForGood ? (
          <Badge tone="red">Permanently closed</Badge>
        ) : closedTemp ? (
          <Badge tone="red">Temporarily closed</Badge>
        ) : place.openNow === true ? (
          <Badge tone="green">Open now</Badge>
        ) : place.openNow === false ? (
          <Badge tone="red">Closed now</Badge>
        ) : null}
      </div>

      {place.googleMapsUri && (
        <a
          href={place.googleMapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Open in Google Maps
          <svg aria-hidden viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
            <path d="M11 3h6v6h-1.5V5.56l-6.47 6.47-1.06-1.06 6.47-6.47H11V3ZM4.5 6A1.5 1.5 0 0 0 3 7.5v8A1.5 1.5 0 0 0 4.5 17h8a1.5 1.5 0 0 0 1.5-1.5V11h-1.5v4.5h-8v-8H9V6H4.5Z" />
          </svg>
        </a>
      )}
    </section>
  );
}

export function InfoStripSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="skeleton h-5 w-2/3 rounded" />
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-4 w-1/3 rounded" />
    </div>
  );
}
