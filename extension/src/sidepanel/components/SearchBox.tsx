import { useEffect, useId, useRef, useState } from 'react';
import { ApiError, api, friendlyError } from '../../lib/api';
import type { Suggestion } from '../../lib/types';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

interface Props {
  /** sessionToken ends the Autocomplete session in the Details call (billing). */
  onSelect: (placeId: string, sessionToken: string) => void;
  /** Fill the box and focus it (e.g. "search manually" after a wrong auto-detect). */
  prefill?: { text: string; n: number } | null;
}

export function SearchBox({ onSelect, prefill }: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const session = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!prefill) return;
    setQuery(prefill.text);
    setOpen(true);
    input.current?.focus();
  }, [prefill]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    session.current ??= crypto.randomUUID();
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api
        .autocomplete(q, session.current!, ctrl.signal)
        .then((r) => {
          setItems(r.suggestions);
          setError(null);
          setActive(-1);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.code === 'aborted') return;
          setItems([]);
          setError(friendlyError(err).detail);
        })
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function choose(s: Suggestion) {
    const token = session.current ?? crypto.randomUUID();
    session.current = null; // next search starts a new session
    setQuery(s.primary);
    setItems([]);
    setOpen(false);
    onSelect(s.placeId, token);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && query.trim().length >= MIN_CHARS;

  return (
    <div className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search restaurants
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-stone-800 dark:bg-stone-900">
        <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0 text-stone-400" fill="currentColor">
          <path d="M8.5 3a5.5 5.5 0 1 0 3.36 9.86l3.64 3.64a.75.75 0 1 0 1.06-1.06l-3.64-3.64A5.5 5.5 0 0 0 8.5 3Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" />
        </svg>
        <input
          ref={input}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          placeholder="Search a restaurant or café…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {loading && (
          <span aria-label="Searching" className="size-4 shrink-0 animate-spin rounded-full border-2 border-stone-300 border-t-brand-500" />
        )}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-800 dark:bg-stone-900">
          <ul id={listId} role="listbox">
            {items.map((s, i) => (
              <li
                key={s.placeId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-brand-50 dark:bg-stone-800' : 'hover:bg-stone-50 dark:hover:bg-stone-800/60'}`}
              >
                <div className="truncate text-sm font-medium">{s.primary}</div>
                <div className="truncate text-xs text-stone-500 dark:text-stone-400">{s.secondary}</div>
              </li>
            ))}
          </ul>
          {!loading && !error && items.length === 0 && (
            <p className="px-3 py-3 text-sm text-stone-500">No restaurants match “{query.trim()}”.</p>
          )}
          {error && <p className="px-3 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {/* Autocomplete predictions shown without a Google map need Google attribution */}
          <p className="border-t border-stone-100 px-3 py-1.5 text-right text-[11px] text-stone-500 dark:border-stone-800">
            Results from Google Maps
          </p>
        </div>
      )}
    </div>
  );
}
