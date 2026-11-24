// The hosted map page (MV3 option b). The extension cannot load the Maps JavaScript
// API itself (no remotely hosted code), so it embeds this page in an iframe.
//
// Modes:  pano  – Street View panorama pointed at the restaurant
//         map   – satellite fallback when there is no Street View
//
// This page uses a SEPARATE browser key (MAPS_BROWSER_KEY), restricted in Google
// Cloud to:  HTTP referrers = this proxy's domain  +  API = Maps JavaScript API.
// Like every browser map, that key is visible to anyone who loads this page.
//
// Query params are read by the page's own script, never interpolated into HTML.

// Outdoor pano IDs are 22 chars; indoor/business and user-contributed panoramas use
// longer base64-style IDs. The ID is only read by the page's script (never put into
// HTML), so a permissive character set is safe.
const PANO_ID_RE = /^[A-Za-z0-9_\-+/=.]{10,1000}$/;

export function frameAncestors(allowedOrigins: string): string {
  const list = allowedOrigins.split(',').map((s) => s.trim()).filter(Boolean);
  // "chrome-extension://*" (dev) → allow any extension via the scheme source.
  return list.map((o) => (o === 'chrome-extension://*' ? 'chrome-extension:' : o)).join(' ') || "'none'";
}

/** Returns null when valid, otherwise a short reason (logged, never echoed into HTML). */
export function embedParamsError(q: URLSearchParams): string | null {
  const mode = q.get('mode');
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (!q.get('lat') || !q.get('lng') || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return 'coords';
  }
  if (mode === 'map') return null;
  if (mode !== 'pano') return 'mode';
  const pano = q.get('pano') ?? '';
  if (!PANO_ID_RE.test(pano)) return `pano(len=${pano.length})`;
  const heading = Number(q.get('heading'));
  if (!Number.isFinite(heading) || heading < 0 || heading > 360) return 'heading';
  return null;
}

// Runs inside the hosted page. Plain JavaScript in a string (not a serialised
// function) so the bundler can't inject helpers into it. Must not contain backticks,
// "${" sequences or backslashes.
const PAGE_SCRIPT = `(function () {
  var w = window;
  var parentOrigin = (location.ancestorOrigins && location.ancestorOrigins[0]) || null;
  function tell(type, detail) {
    if (parentOrigin) parent.postMessage({ source: 'bite-check-embed', type: type, detail: (detail === undefined ? null : detail) }, parentOrigin);
  }
  // Called by the Maps JS API when the key is rejected (wrong referrer, API not enabled…)
  w.gm_authFailure = function () {
    tell('error', 'auth');
  };

  w.bvInit = function () {
    try {
      var g = w.google.maps;
      var p = new URLSearchParams(location.search);
      var mode = p.get('mode');
      var place = { lat: Number(p.get('lat')), lng: Number(p.get('lng')) };
      var el = document.getElementById('view');

      if (mode === 'pano') {
        var pano = new g.StreetViewPanorama(el, {
          pano: p.get('pano'),
          pov: { heading: Number(p.get('heading')), pitch: 0 },
          zoom: 0,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          showRoadLabels: true,
        });
        pano.addListener('status_changed', function () {
          tell(pano.getStatus() === 'OK' ? 'ready' : 'error', 'pano');
        });
        return;
      }

      // Satellite fallback when there is no Street View coverage.
      var map = new g.Map(el, {
        center: place,
        zoom: 19,
        tilt: 0,
        mapTypeId: 'hybrid',
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
      });
      new g.Marker({ position: place, map: map, title: 'This restaurant' });
      g.event.addListenerOnce(map, 'tilesloaded', function () {
        tell('ready', 'map');
      });
    } catch (err) {
      tell('error', 'init');
    }
  };
})();`;

export function mapEmbedHtml(browserKey: string, nonce: string): string {
  const src =
    'https://maps.googleapis.com/maps/api/js?' +
    new URLSearchParams({ key: browserKey, v: 'weekly', loading: 'async', callback: 'bvInit' }).toString();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bite Check · Map</title>
<style nonce="${nonce}">
  html, body, #view { margin: 0; height: 100%; width: 100%; background: #e7e5e4; }
  @media (prefers-color-scheme: dark) { html, body, #view { background: #1c1917; } }
</style>
</head>
<body>
<div id="view" role="application" aria-label="Map"></div>
<script nonce="${nonce}">${PAGE_SCRIPT}</script>
<script nonce="${nonce}" async src="${src.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></script>
</body>
</html>`;
}
