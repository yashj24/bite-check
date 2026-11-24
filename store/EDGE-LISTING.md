# Bite Check — Microsoft Edge Add-ons submission kit

Everything needed to submit in Partner Center (partner.microsoft.com/dashboard/microsoftedge).
Field names below follow Partner Center; they may be worded slightly differently on screen.

## Files
| What | File |
|---|---|
| Extension package | `store/bite-check-store.zip`, built with `cd extension && npm run build:store` and zipped from `extension/dist-store/` (manifest at zip root) |
| Store logo (required, 300×300) | `store/logo-300.png` |
| Screenshots (at least 1; 1280×800 or 640×400) | Take your own; see "Screenshots" below |
| Privacy policy URL | https://bite-check-proxy.yashhj45.workers.dev/privacy |

## Submission order (important)
1. **Upload the package** (`Extension overview → Create new extension → upload zip`). Partner Center assigns the
   extension its permanent **ID** (a 32-letter id shown on the extension's overview page).
2. **Before submitting**, add that ID to the proxy allowlist in `proxy/wrangler.toml`:
   `ALLOWED_ORIGINS = "chrome-extension://nchocabamllnjgedjmglpenihacaokpf,chrome-extension://<EDGE_ID>"`,
   then run `npx wrangler deploy` in `proxy/`. Otherwise the reviewer gets "Not allowed" errors and rejects it.
3. Fill in Availability, Properties and Store listing as below, then **Publish** (submits for review).

## Availability
- **Visibility:** Public
- **Markets:** all markets, or India only if you prefer. Auto-detect only works on Zomato/Swiggy (India), but manual search works anywhere.

## Properties
- **Category:** Shopping (alternative: Productivity)
- **Does your extension access, collect, or transmit personal information?** Yes. It transmits the search text
  and the detected restaurant name/area to its server, and IP addresses are seen by the server. Link the privacy policy URL above.
- **Website URL:** optional (your GitHub repo or the privacy page)
- **Support contact:** an email address or URL you're happy to make public
- **Mature content:** No

## Store listing (English)

**Display name:** Bite Check

**Short description (one line):**
See a restaurant's photos and Street View from Google Maps in a side panel, before you order.

**Description** (paste as is; it's over the 250-character minimum):
```
Before you order, check the vibe.

Bite Check shows what a restaurant actually looks like, without leaving the page you're on. Open the side panel to see:

• Photos from Google Maps: interior, exterior, ambience and food shots, each credited to its author.
• Street View: a 360° look at the street and the building's exterior, pointed at the restaurant. Indoor views appear where Google has them.
• Key info at a glance: address, rating, price level, open now, and a one-click "Open in Google Maps".

Works two ways:
1. Search for any restaurant or café by name.
2. On Zomato and Swiggy restaurant pages, Bite Check spots the restaurant you're viewing and offers to show it. Nothing is looked up until you click "View". Picked the wrong branch? Choose the right one from "Not the right place?".

Private by design:
• No account, no ads, no analytics, no tracking of your browsing.
• On Zomato and Swiggy it reads only the restaurant name and area shown on the page. It never reads menus, prices, reviews or your orders, and it never changes the page.
• All place data, photos and Street View come live from official Google Maps Platform APIs. Nothing is copied or stored.

Bite Check is an independent project and is not affiliated with Google, Zomato or Swiggy.
```

**Search terms** (keep within Partner Center's limits):
restaurant photos, street view, zomato, swiggy, google maps, food delivery, restaurant preview

## Permission justifications
Use these if Partner Center (or the reviewer) asks why each permission is needed.

| Permission | Justification |
|---|---|
| `sidePanel` | The extension's whole UI lives in the browser side panel, so the user can view restaurant photos next to the page they're on. |
| `storage` | Saves the Google place ID of the last viewed restaurant and the user's "photos to show" preference (local), and keeps the restaurant detected on the current tab in temporary session memory. |
| Host access: `zomato.com`, `swiggy.com` (content script) | Reads only the restaurant name (main heading) and area/city (page title) on restaurant pages the user is viewing, so the panel can offer to show that restaurant. No other page data is read, the page isn't modified, and no requests are made to these sites. |
| Host access: `bite-check-proxy.yashhj45.workers.dev` | The extension's own backend, which calls Google Maps Platform APIs so that no API key ships inside the extension. |

**Single purpose:** Show photos and Street View of a restaurant from Google Maps in a side panel.

**Remote code:** None. All extension code is bundled in the package. Google Maps (Street View) is shown inside a sandboxed iframe of the extension's own web page; no remote script runs in extension pages.

## Notes for certification (for the reviewer)
```
How to test:
1. Click the Bite Check toolbar icon. The side panel opens.
2. Type "Karim's Delhi" in the search box and pick a result. Place info and photos load; open the "Street View" tab for the 360° view.
3. Optional: open any restaurant page on zomato.com or swiggy.com (e.g. a restaurant's order page). The panel shows "Detected on Zomato: <name> [View]". Click View.

No login is needed. The extension talks only to its own backend (bite-check-proxy.yashhj45.workers.dev), which calls official Google Maps Platform APIs. The content script on zomato.com/swiggy.com reads only the restaurant name and page title, and makes no network requests.
```

## Screenshots
Take 2–4 screenshots of the browser window with the side panel open, then crop or resize to **1280×800**:
1. A Zomato restaurant page with the "Detected on Zomato" banner in the panel.
2. The photo gallery for a well-known restaurant.
3. The Street View tab.
4. Optional: the "Not the right place?" list open.

Avoid showing personal info such as your name, address or orders in the Zomato/Swiggy header. Windows: `Win+Shift+S` to capture, then resize in Paint (Resize → Pixels → 1280×800, untick "Maintain aspect ratio" only if it's already close).

## After approval
- Updates: bump `version` in `extension/package.json`, run `npm run build:store`, zip `dist-store/` again, and upload a new package in Partner Center.
- Keep the Edge ID in `ALLOWED_ORIGINS` permanently.
