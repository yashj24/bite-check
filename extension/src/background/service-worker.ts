// Clicking the toolbar icon opens the side panel (the primary UI).
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

// ---- Auto-detect relay -------------------------------------------------------------
// The content script reports the restaurant name/area it sees on the current
// Zomato/Swiggy tab. We keep it per tab in chrome.storage.session: in memory only,
// cleared when the browser closes, readable only by the extension's own pages.
// Nothing is sent anywhere until the user clicks "View" in the side panel.

const key = (tabId: number) => `detected:${tabId}`;
const SITES = ['zomato', 'swiggy'];

function validDetection(d: any): boolean {
  const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
  return (
    d != null &&
    SITES.includes(d.site) &&
    str(d.name, 80) &&
    d.name.length >= 2 &&
    str(d.context, 80) &&
    str(d.query, 100)
  );
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'bv:detected') return;
  const tabId = sender.tab?.id;
  if (tabId == null || sender.id !== chrome.runtime.id) return;
  const d = msg.detection;
  if (d === null) {
    chrome.storage.session.remove(key(tabId));
  } else if (validDetection(d)) {
    const { site, name, context, query } = d;
    // Write only when it changed, so the panel isn't re-rendered by heartbeats.
    chrome.storage.session.get(key(tabId)).then((r) => {
      if (r[key(tabId)]?.query !== query) chrome.storage.session.set({ [key(tabId)]: { site, name, context, query } });
    });
  }
});

// A full page load (any site) clears the old detection; the content script will
// report again if the new page is a restaurant page.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') chrome.storage.session.remove(key(tabId));
});
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(key(tabId));
});
