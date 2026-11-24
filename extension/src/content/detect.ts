// Bite Check content script for zomato.com and swiggy.com.
//
// What it does, and nothing more:
//  - Reads the restaurant NAME (visible <h1>) and the area/city text from the page
//    TITLE of the page the user is already viewing, locally in their browser.
//  - Passes that text to the Bite Check extension (never to any server).
//
// What it never does: read menus, prices, reviews, ratings or any other data; make
// network requests; modify the page or inject UI.

export type Detection = {
  site: 'zomato' | 'swiggy';
  /** Restaurant name as shown on the page. */
  name: string;
  /** Area / city text from the page title, if any. */
  context: string;
  /** "name, area, city", sent to the proxy only when the user clicks View. */
  query: string;
};

const SITE: Detection['site'] = location.hostname.includes('zomato') ? 'zomato' : 'swiggy';
const CHECK_MS = 1500; // both sites are single-page apps, so re-check on navigation

const ZOMATO_NON_RESTAURANT =
  /^(restaurants|delivery|dine-out|drinks-and-nightlife|nightlife|collections|events|directory|order-food-online)$|^(best|top)-|-(restaurants|delivery)$/;

// Decide from the URL path only whether this looks like a single-restaurant page.
function isRestaurantPage(): boolean {
  const parts = location.pathname.split('/').filter(Boolean);
  if (SITE === 'swiggy') {
    return (parts[0] === 'restaurants' && parts.length >= 2) || /-rest\d+$/.test(parts[parts.length - 1] ?? '');
  }
  // Zomato: /{city}/{restaurant-slug}[/{section}]
  return parts.length >= 2 && parts.length <= 3 && !ZOMATO_NON_RESTAURANT.test(parts[1]);
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function cleanTitle(raw: string): string {
  return clean(raw)
    .replace(/\s*[|\-\u2013\u2014]\s*(zomato|swiggy)\b.*$/i, '') // site suffix
    .replace(/^(order (food )?online from|order from|order online)\s+/i, '') // "Order online from X"
    .replace(/\s*[|\-\u2013\u2014]\s*(order online|menu|reviews|photos|info|delivery)\b.*$/i, '')
    .replace(/\s+(menu|order online)$/i, '');
}

function detect(): Detection | null {
  if (!isRestaurantPage()) return null;
  const h1 = clean(document.querySelector('h1')?.textContent ?? '');
  const title = cleanTitle(document.title);

  let name = h1.length >= 2 && h1.length <= 80 ? h1 : clean(title.split(',')[0] ?? '');
  name = name.slice(0, 80);
  if (name.length < 2) return null;

  // Area/city = whatever the title adds after the name (e.g. "Jama Masjid, New Delhi").
  let context = '';
  const idx = title.toLowerCase().indexOf(name.toLowerCase());
  if (idx >= 0) context = clean(title.slice(idx + name.length).replace(/^[\s,\-\u2013\u2014|:]+/, ''));
  context = context.slice(0, 80);

  const query = [name, context].filter(Boolean).join(', ').slice(0, 100);
  return { site: SITE, name, context, query };
}

let lastSignature = '';
let ticks = 0;
const HEARTBEAT_TICKS = 5; // re-send every ~7.5 s even if unchanged (the extension may have cleared it)

function check() {
  if (document.visibilityState !== 'visible') return;
  const d = detect();
  const signature = d ? d.query : `none:${location.pathname}`;
  ticks++;
  if (signature === lastSignature && ticks % HEARTBEAT_TICKS !== 0) return;
  lastSignature = signature;
  try {
    chrome.runtime.sendMessage({ type: 'bv:detected', detection: d }).catch(() => {});
  } catch {
    // Extension was reloaded/updated; this old content script is orphaned.
    clearInterval(timer);
  }
}

const timer = setInterval(check, CHECK_MS);
document.addEventListener('visibilitychange', check);
check();
