import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// In-memory only, for the lifetime of this open side panel, so the preview and its
// thumbnail share one Place Photos request. Never persisted; photoUris are short-lived.
const pending = new Map<string, Promise<string>>();

function resolve(name: string): Promise<string> {
  let p = pending.get(name);
  if (!p) {
    p = api.photoUri(name).then((r) => r.photoUri);
    p.catch(() => pending.delete(name));
    pending.set(name, p);
  }
  return p;
}

/** Resolves a photo's image URL only once `enabled` becomes true (lazy loading). */
export function usePhotoUri(name: string, enabled: boolean) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setError(false);
    resolve(name).then(
      (u) => alive && setUri(u),
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [name, enabled, nonce]);

  /** Call when the image fails to load (e.g. the short-lived URL expired). */
  const retry = useCallback(() => {
    pending.delete(name);
    setUri(null);
    setNonce((n) => n + 1);
  }, [name]);

  return { uri, error, retry };
}
