export function ErrorCard({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/40">
      <p className="text-sm font-semibold text-red-800 dark:text-red-300">{title}</p>
      <p className="mt-1 text-xs text-red-700 dark:text-red-300/80">{detail}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ onReopenLast }: { onReopenLast?: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-brand-100 text-3xl dark:bg-brand-700/30" aria-hidden>
        🍽️
      </div>
      <h2 className="mt-4 text-base font-semibold">Check the vibe before you order</h2>
      <p className="mt-1 max-w-xs text-sm text-stone-500 dark:text-stone-400">
        Search for a restaurant to see its photos and Street View from Google Maps.
      </p>
      {onReopenLast && (
        <button
          type="button"
          onClick={onReopenLast}
          className="mt-4 rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-900"
        >
          Reopen last restaurant
        </button>
      )}
    </div>
  );
}
