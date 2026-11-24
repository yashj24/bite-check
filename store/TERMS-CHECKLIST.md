# Terms to verify before publishing

Bite Check was designed to stay within these terms, but terms change. Read the **current** versions and tick each
item. Where something is unclear, get legal advice, especially for the Zomato/Swiggy items. This list isn't legal advice.

## Google Maps Platform
Sources: Google Maps Platform Terms of Service, Service Specific Terms (Places API, Street View, Maps JavaScript API),
Places API policies and attribution requirements, and the Google Maps/Google Earth Additional Terms.

- [ ] **Caching and storage:** only `place_id` may be stored indefinitely. Confirm that Bite Check's practices are allowed:
  no stored photos or details; photo URIs held in memory only while the panel is open; a 1-hour server cache of place IDs.
- [ ] **Photo attribution:** each photo must show its `authorAttributions` (name and link) as returned. Bite Check shows
  them on each large photo. Confirm that the dot navigation (no thumbnails) needs no extra attribution.
- [ ] **Google Maps attribution when data is shown without a Google map:** check the required wording or logo
  ("Google Maps" text attribution) and its styling rules. Bite Check uses "Place info and photos from Google Maps" in the footer.
- [ ] **Autocomplete results** shown without a map: Bite Check shows "Results from Google Maps". Confirm the requirement.
- [ ] **Using Autocomplete for auto-detect** (a programmatic query from detected text rather than typed input): confirm it's
  permitted, and that session tokens are used correctly (the session ends in a Place Details call).
- [ ] **Text Search IDs-only** fallback: confirm the field mask `places.id` is still billed as the free Essentials (IDs Only) SKU.
- [ ] **Street View:** a panorama shown in an iframe on your own domain inside an extension is allowed; Google's logo and
  copyright are not hidden.
- [ ] **No derived data:** no ML or vision analysis of Google photos, and no scraping of Google pages. (Bite Check does neither.)
- [ ] **Browser extensions:** check for any specific restriction on using Maps Platform in browser extensions, or on
  embedding maps in third-party sites' context.
- [ ] **Pricing:** check current prices and free monthly caps per SKU (Place Details Enterprise, Place Photos, Dynamic
  Street View, Dynamic Maps) and update the README cost table.

## Zomato
Sources: Zomato Terms of Service / Terms of Use, any API or developer terms, and brand or trademark guidelines.

- [ ] Clauses on **scraping, crawling, data mining, robots or automated access**. Bite Check reads two visible text values
  locally on a page the user opened and makes **no requests** to Zomato. Confirm whether that falls outside these clauses.
- [ ] Clauses on **browser extensions, overlays or framing**: Bite Check injects nothing into the page.
- [ ] **Trademark use:** the listing and UI mention "Zomato" only to say where detection works, plus a "not affiliated"
  disclaimer. Check whether their guidelines allow this, and avoid any logo use.

## Swiggy
Sources: Swiggy Terms of Use, and brand or trademark guidelines.

- [ ] The same three checks as Zomato: scraping/automated access, extensions/overlays, trademark mention.

## Microsoft Edge Add-ons
Sources: Microsoft Edge Add-ons developer policies and the Microsoft Store Policies.

- [ ] **Single purpose** and **minimal permissions**: confirm the listing's permission justifications match the manifest.
- [ ] **Privacy policy** is required because data is transmitted. The URL is live and matches actual behaviour.
- [ ] **Trademarks in the listing:** Microsoft can reject listings that use third-party brand names misleadingly. Keep
  "not affiliated" in the description.
- [ ] **Remote code:** confirm that the sandboxed iframe approach for Street View is acceptable.

## Before going public (not terms, but required)
- [ ] Rotate the Google **server key**: Credentials → key → *Regenerate*, then `npx wrangler secret put GOOGLE_MAPS_API_KEY`.
- [ ] Raise the Google **daily quotas** from the testing caps (100–200/day) to expected traffic, and keep budget alerts on.
- [ ] Add the Edge Store extension ID to `ALLOWED_ORIGINS` and redeploy the proxy.
