# Bite Check

A Chrome extension (Manifest V3) that shows what a restaurant looks like before you order. It shows photos and Street View, taken live from official Google Maps Platform APIs, in Chrome's side panel.

> **Status:** Done: side panel, manual search, info strip, photo gallery (Stage 1); Street View with satellite fallback (Stage 2); Zomato/Swiggy auto-detect (Stage 4).
> Stage 3 (Neighbourhood map) was removed from scope.
> Still to do: Stage 5 polish, packaging, store docs.

### Auto-detect (Zomato / Swiggy)
- `src/content/detect.ts` runs only on `zomato.com` and `swiggy.com`.
  - From the URL path it decides whether the page is a single-restaurant page.
  - It reads only the visible `<h1>` (restaurant name) and the page title (area/city).
  - It makes **no network requests**, doesn't modify the page and injects no UI.
- The service worker keeps the detection per tab in `chrome.storage.session`. That is in memory only and cleared when the browser closes.
- The side panel shows **"Detected on Zomato: name · area [View]"**. Nothing leaves the browser until the user clicks **View**; then only the text "name, area, city" is sent to the proxy.
- The proxy's `/v1/resolve` runs Autocomplete first. That's free, because the session ends in the Details call, and it supplies the **"Not the right place?"** list. If Autocomplete finds nothing, it falls back to Text Search with an **IDs-only** field mask, which is the free SKU. Fallback place_ids are cached in memory for 1 hour; only place_ids, never other Places content.
- Permissions stay minimal: `sidePanel`, `storage`, the proxy host, and content-script matches for the two sites. No `tabs`, `activeTab` or `<all_urls>`.

> ⚠️ **Terms-of-service note.** Zomato's and Swiggy's terms restrict scraping and automated access. Bite Check only reads two pieces of visible text locally on a page the user opened, and never calls their servers. That's much lower risk than scraping, but it's still a grey area. Review their current terms, ideally with legal advice, before publishing (see the Stage 5 checklist).

### Why maps are on a hosted page (MV3)
MV3 forbids remotely hosted code, so the Maps JavaScript API can't run inside extension pages. Bite Check uses **option (b)**: the proxy serves `/embed/map` (modes: `pano`, or `map` for the satellite fallback), a small page on *your* domain that loads the Maps JavaScript API, and the side panel embeds it in a sandboxed iframe. This was chosen over Maps Embed API iframes because:
- an Embed API iframe would carry the key in its URL inside the extension, and Google's website (referrer) restriction can't be locked to a `chrome-extension://` origin;
- the hosted page can tell the panel when the panorama has loaded or failed, so the panel can show proper loading and error states.

The page uses a **separate browser key**, locked to your proxy's domain (HTTP referrer) and to the Maps JavaScript API. As with any Google map on the web, that key is visible to people who load the page. The referrer lock, the API restriction and quotas are what protect it. The page sends a strict nonce-based CSP, and its `frame-ancestors` setting lets only your extension embed it.

```
bite-check/
├── extension/                 Chrome extension (TS + React + Tailwind v4 + Vite/CRXJS)
│   ├── manifest.config.ts     manifest.json source (permissions, CSP)
│   ├── .env.example           VITE_PROXY_URL
│   ├── public/icons/
│   └── src/
│       ├── background/service-worker.ts   opens the side panel; relays detections per tab
│       ├── content/detect.ts  Zomato/Swiggy: reads restaurant name + area locally
│       ├── lib/               api client, storage (place_id only), photo + detection hooks, types
│       └── sidepanel/         React UI (App, SearchBox, Detected, InfoStrip, PhotoGallery, StreetViewTab, States)
└── proxy/                     Cloudflare Worker that holds the Google API keys
    ├── wrangler.toml          origin allowlist, per-IP rate limit binding
    ├── .dev.vars.example
    └── src/                   index.ts (router, CORS, rate limit, place_id cache), google.ts,
                               embed.ts (hosted map page), validate.ts
```

## How data flows

```
Side panel ──(query / place_id / photo name)──▶ Proxy (holds key) ──▶ Places API (New)
     ▲                                               │
     └──────── JSON (no-store) ◀─────────────────────┘
     └──────── <img src=photoUri>  ◀── loaded directly from Google (short-lived URL)
```

- The extension never holds an API key.
- Photo bytes never pass through the proxy. The proxy asks Place Photos for a short-lived `photoUri` (`skipHttpRedirect=true`), and the browser loads that URL from Google.
- Nothing from Google is cached or stored. Every proxy response is sent with `Cache-Control: no-store`. The extension stores only `lastPlaceId` (a place_id) and the `maxPhotos` setting.

## Setup

**Requirements:** Node.js **22.12 or newer** (Wrangler 4 needs it) and Chrome 116 or newer.

### 1. Google Cloud
1. Create a project and enable billing.
2. Enable **Places API (New)**, **Street View Static API** (only its free metadata endpoint is used) and **Maps JavaScript API**.
3. Create a **server key**, `GOOGLE_MAPS_API_KEY`, used only by the proxy:
   - *API restrictions:* Places API (New) + Street View Static API.
   - *Application restrictions:* None (see the ⚠️ note below about IP restriction on Cloudflare).
4. Create a **browser key**, `MAPS_BROWSER_KEY`, used by the hosted map page:
   - *Application restrictions:* Websites, with `http://localhost:8787/*` for dev and `https://<your-proxy-domain>/*` for production.
   - *API restrictions:* Maps JavaScript API only.
5. Set **quotas**: a daily cap per method under Places API (New) → Quotas, plus Maps JavaScript API → *Dynamic Street View* and *Dynamic Maps* loads per day.
6. Set **budget alerts** under Billing → Budgets & alerts, at 50%, 90% and 100% of your monthly limit.
7. Never commit keys. `.dev.vars` and `.env` are already in `.gitignore`.

> ⚠️ **Server-IP restriction and Cloudflare Workers.** Workers send requests from shared Cloudflare IP ranges, not a fixed IP, so Google's "IP address" key restriction can't be applied. This project restricts the server key **by API only**, and relies on hard daily quotas, budget alerts, the proxy rate limit and the origin allowlist. If you need an IP-restricted key, host the same proxy logic on Cloud Run (or a VM) with a static egress IP (Cloud NAT). The handler only uses standard `fetch`/`Request`/`Response`, so moving it needs only a small adapter.

### 2. Proxy (local)
```bash
cd proxy
npm install
cp .dev.vars.example .dev.vars      # put your server key and browser key in it
npm run dev                         # http://localhost:8787
```
Deploy:
```bash
npx wrangler secret put GOOGLE_MAPS_API_KEY
npx wrangler secret put MAPS_BROWSER_KEY      # add https://<your-proxy-domain>/* to its website restriction
# edit wrangler.toml → ALLOWED_ORIGINS = "chrome-extension://<your-extension-id>"
npm run deploy
```

### 3. Extension
```bash
cd extension
npm install
cp .env.example .env               # VITE_PROXY_URL=http://localhost:8787
npm run build                      # outputs extension/dist
```
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select `extension/dist`.
3. Click the Bite Check toolbar icon. The side panel opens.

For live reload during development, run `npm run dev` and load `extension/dist` the same way.

**Stable extension ID:** the ID of an unpacked extension depends on its folder path. To pin it, add a `key` field to the manifest; Chrome's docs explain how to generate one. Then put that ID in `ALLOWED_ORIGINS`. After you publish, use the Web Store ID instead.

## Proxy API

| Endpoint | Google call | Notes |
|---|---|---|
| `GET /v1/autocomplete?q=&session=` | Autocomplete (New) | `q` 2–100 chars; restricted to restaurant/cafe/bakery/bar/takeaway |
| `GET /v1/resolve?q=&session=` | Autocomplete (New), then Text Search IDs-only | Auto-detect; returns `{ suggestions, placeId }` |
| `GET /v1/place/:placeId?session=&maxPhotos=` | Place Details (New) | `maxPhotos` 0–10; the extension offers 4, 6 or 8 (default 6) |
| `GET /v1/photo?name=&w=` | Place Photos (New) | returns `{ photoUri }`; `w` 100–1600 |
| `GET /v1/streetview?lat=&lng=` | Street View metadata (free) | nearest panorama within 50 m, heading toward the restaurant, distance, capture date |
| `GET /embed/map?mode=pano\|map&…` | Maps JavaScript API (in the browser) | HTML page for the iframe; refused when opened directly in a tab |
| `GET /privacy` | none | Public privacy policy page |
| `GET /health` | none | |

Guardrails: strict regex validation on every input; 60 requests/min per IP (Workers Rate Limiting binding, with an in-memory fallback in dev); `Origin` allowlist; 8 s upstream timeout; Google errors mapped to `quota`, `not_found`, `timeout` or `upstream` without leaking key or project details.

## Cost (approximate)

Check current prices on Google's Places API pricing page. Google changed its SKUs and free monthly caps in 2025, so the numbers below are ballpark USD per 1,000 calls.

| Action | SKU | Calls per restaurant view |
|---|---|---|
| Typing a search | Autocomplete: free when the session ends in Details | 0 billed |
| Opening a place | Place Details **Enterprise** (because of rating, price and opening hours) ≈ $20/1k | 1 |
| Auto-detect (on clicking View) | Autocomplete (free in a session) or Text Search IDs-only (free) | 0 billed |
| Viewing photos | Place Photos ≈ $7/1k | 2 on open (current + next); +1 per photo swiped. Dots replace image thumbnails to avoid extra billed requests |
| Opening the Street View tab | Street View metadata: **free** · then Dynamic Street View ≈ $14/1k, or Dynamic Maps ≈ $7/1k for the satellite fallback | 1 (only if the tab is opened; switching tabs doesn't reload it) |

**Typical view: about $0.035 on open, +$0.007 per extra photo swiped, +$0.014 if Street View is opened.** Removing `rating`, `userRatingCount`, `priceLevel` and `currentOpeningHours` from the field mask in `proxy/src/google.ts` drops Details to the Pro tier, at the cost of a thinner info strip.

## Compliance checklist
**Google Maps Platform**
- [x] Official APIs only (Places API (New), Street View metadata, Maps JavaScript API). No scraping of Google pages.
- [x] Field masks on every Places call.
- [x] No Google content cached or stored: proxy responses are `no-store`, photo bytes never touch the proxy, and photo URIs are held in memory only while the panel is open. Only `place_id`s are persisted: the last viewed place in the browser, and a 1-hour in-memory place_id cache on the proxy.
- [x] Every photo shows its author attribution, linked as returned, plus a "Report" link (`flagContentUri`). "Google Maps" text attribution appears in the footer and under autocomplete results. Google's logo and copyright stay visible on Street View.
- [x] No ML or derived data from Google content. No bulk pre-fetching: photos load one ahead of the one being viewed.
- [x] Keys never in the extension or the repo. Server key restricted by API; browser key restricted by website + API. Quotas and budget alerts set.

**Zomato / Swiggy**
- [x] The content script reads only the `<h1>` and the page title on restaurant pages, locally. No requests to their servers, no page changes, no injected UI.
- [x] Nothing leaves the browser until the user clicks **View**.
- [ ] Their current terms checked (see [store/TERMS-CHECKLIST.md](store/TERMS-CHECKLIST.md)).

**Browser store**
- [x] Single purpose; minimal permissions (`sidePanel`, `storage`, the proxy host, content-script matches for the two sites).
- [x] No remote code in extension pages; strict CSP. Maps run in a sandboxed iframe of our own page.
- [x] Public privacy policy at `/privacy` on the proxy, also linked in the panel footer.
- [x] No analytics and no browsing-history tracking.
- [x] Content script not exposed as a web-accessible resource, so the sites can't detect the extension.

Store submission kit (Edge): [store/EDGE-LISTING.md](store/EDGE-LISTING.md).

## Known limitations
- **Street View** mostly shows the street and the outside of the building. Indoor 360° views exist only where Google has them. The nearest panorama may be up to 50 m away, and imagery can be years old; the capture date is shown.
- **Photos** come from Google Maps users and may be mostly food, outdated, or few for small or cloud-kitchen restaurants.
- **Auto-detect** depends on Zomato's and Swiggy's URL and title formats; a redesign can break it, and manual search is the fallback. Matching can pick the wrong branch of a chain ("Not the right place?" fixes this). Swiggy titles sometimes have no city.
- **Cloud kitchens / delivery-only brands** often aren't on Google Maps, or have no photos.
- **API-key protection:** the server key can't be IP-restricted on Cloudflare Workers. The extension-ID check is a browser-level gate that a determined script could fake. Daily quotas cap the worst-case cost.
- **Proxy cache and rate limit:** the place_id cache and the in-memory rate-limit fallback are per Worker instance (best effort). The Workers Rate Limiting binding is the main limit.
- **Browsers:** needs Chrome or Edge 116+ with side panel support. Firefox isn't supported (it uses a different sidebar API).
- **Quotas:** with the testing caps (100–200/day), the app stops working for the day when a cap is hit, until midnight Pacific time.
