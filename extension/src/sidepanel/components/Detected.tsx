import type { Detection } from '../../lib/useDetection';
import type { Suggestion } from '../../lib/types';

const SITE_LABEL = { zomato: 'Zomato', swiggy: 'Swiggy' } as const;

/** "Detected on Zomato: Karim's · Jama Masjid, Delhi  [View]". Loads only on click. */
export function DetectedBanner({
  detection,
  busy,
  error,
  onView,
}: {
  detection: Detection;
  busy: boolean;
  error: string | null;
  onView: () => void;
}) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 dark:border-brand-700/40 dark:bg-brand-700/15">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-brand-700 uppercase dark:text-brand-400">
            Detected on {SITE_LABEL[detection.site]}
          </p>
          <p className="truncate text-sm font-semibold">{detection.name}</p>
          {detection.context && <p className="truncate text-xs text-stone-500 dark:text-stone-400">{detection.context}</p>}
        </div>
        <button
          type="button"
          onClick={onView}
          disabled={busy}
          className="shrink-0 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Finding…' : 'View'}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

/** Other Google matches for the detected name, so the user can correct a wrong match. */
export function NotRightPlace({
  alternatives,
  onPick,
  onSearchManually,
}: {
  alternatives: Suggestion[];
  onPick: (s: Suggestion) => void;
  onSearchManually: () => void;
}) {
  return (
    <details className="group rounded-xl border border-stone-200 bg-white text-sm dark:border-stone-800 dark:bg-stone-900">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-stone-600 select-none hover:text-stone-900 dark:text-stone-300 dark:hover:text-white">
        Not the right place? <span className="text-brand-600 dark:text-brand-400">Pick another</span>
        <span className="float-right transition group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <ul className="border-t border-stone-100 dark:border-stone-800">
        {alternatives.map((s) => (
          <li key={s.placeId}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="block w-full px-3 py-2 text-left hover:bg-stone-50 dark:hover:bg-stone-800/60"
            >
              <span className="block truncate text-sm">{s.primary}</span>
              <span className="block truncate text-xs text-stone-500">{s.secondary}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onSearchManually}
            className="block w-full px-3 py-2 text-left text-xs font-medium text-brand-600 hover:bg-stone-50 dark:text-brand-400 dark:hover:bg-stone-800/60"
          >
            None of these — search manually
          </button>
        </li>
      </ul>
      <p className="border-t border-stone-100 px-3 py-1.5 text-right text-[11px] text-stone-500 dark:border-stone-800">
        Results from Google Maps
      </p>
    </details>
  );
}
