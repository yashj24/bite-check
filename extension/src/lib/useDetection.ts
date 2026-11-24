import { useEffect, useState } from 'react';
import type { Detection } from '../content/detect';

export type { Detection };

/** The restaurant detected on the active tab (Zomato/Swiggy), or null. */
export function useDetection(): Detection | null {
  const [tabId, setTabId] = useState<number | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);

  // Track the active tab of this window (no "tabs" permission needed for the id).
  useEffect(() => {
    const refresh = () =>
      chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([t]) => setTabId(t?.id ?? null))
        .catch(() => setTabId(null));
    refresh();
    chrome.tabs.onActivated.addListener(refresh);
    return () => chrome.tabs.onActivated.removeListener(refresh);
  }, []);

  useEffect(() => {
    if (tabId == null) {
      setDetection(null);
      return;
    }
    const k = `detected:${tabId}`;
    chrome.storage.session
      .get(k)
      .then((r) => setDetection((r[k] as Detection | undefined) ?? null))
      .catch(() => setDetection(null));
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'session' && k in changes) setDetection((changes[k].newValue as Detection | undefined) ?? null);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [tabId]);

  return detection;
}
