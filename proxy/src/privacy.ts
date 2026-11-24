// Public privacy policy page, served at /privacy (linked from the store listing
// and from the extension's side panel). Static content written for Bite Check.

const UPDATED = '25 November 2026';

export function privacyHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bite Check · Privacy policy</title>
<style>
  :root { color-scheme: light dark; --bg:#fafaf9; --fg:#1c1917; --muted:#57534e; --line:#e7e5e4; --accent:#e14d14; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0c0a09; --fg:#f5f5f4; --muted:#a8a29e; --line:#292524; --accent:#ff8a4c; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:720px; margin:0 auto; padding:32px 16px 64px; }
  h1 { font-size:28px; margin:0 0 4px; } h2 { font-size:19px; margin:32px 0 8px; }
  p, li { color:var(--fg); } .muted { color:var(--muted); font-size:14px; }
  a { color:var(--accent); } ul { padding-left:20px; } li { margin:4px 0; }
  table { width:100%; border-collapse:collapse; font-size:14px; margin-top:8px; }
  th, td { text-align:left; vertical-align:top; padding:8px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:600; }
  .box { border:1px solid var(--line); border-radius:12px; padding:12px 16px; }
</style>
</head>
<body>
<main>
<h1>Bite Check privacy policy</h1>
<p class="muted">Last updated: ${UPDATED}</p>

<div class="box">
  <strong>In short:</strong> Bite Check has no accounts, no analytics and no ads. It never tracks your
  browsing history. The only thing that leaves your browser is what's needed to look up a restaurant on
  Google Maps, and only when you ask for it.
</div>

<h2>What Bite Check does</h2>
<p>Bite Check is a browser extension that shows photos and Street View of a restaurant from
Google Maps in your browser's side panel. You can search for a restaurant, or, on Zomato and Swiggy restaurant pages,
let Bite Check detect the restaurant you are viewing.</p>

<h2>What data leaves your browser, and when</h2>
<table>
  <tr><th>When</th><th>What is sent</th><th>Sent to</th></tr>
  <tr><td>You type in the search box</td><td>The text you type</td><td>Bite Check's server, which forwards it to Google Maps</td></tr>
  <tr><td>You click <em>View</em> on a detected Zomato/Swiggy restaurant</td><td>The restaurant name and the area/city text shown on that page</td><td>Bite Check's server, which forwards it to Google Maps</td></tr>
  <tr><td>A restaurant is opened</td><td>Its Google Maps place ID, and the IDs of the photos you view</td><td>Bite Check's server, which forwards them to Google Maps</td></tr>
  <tr><td>You open the Street View tab</td><td>The restaurant's map coordinates</td><td>Bite Check's server, then Google Maps</td></tr>
  <tr><td>Photos and Street View are displayed</td><td>Normal web requests for images and map tiles</td><td>Google, directly from your browser</td></tr>
</table>
<p>Nothing is sent while you simply browse Zomato or Swiggy. Detection happens locally in your browser,
and nothing is looked up until you click <em>View</em>.</p>

<h2>What the Zomato / Swiggy integration reads</h2>
<p>On zomato.com and swiggy.com only, Bite Check reads the restaurant <strong>name</strong> (the page's main heading) and
the <strong>area/city</strong> text from the page title of the page you are already viewing. It does not read
menus, prices, reviews, ratings, your orders, your address or account, or anything else, and it does
not change those pages. It runs on no other websites.</p>

<h2>What is stored</h2>
<ul>
  <li><strong>In your browser:</strong> the Google Maps place ID of the last restaurant you opened (so you can reopen it)
    and your "photos to show" setting. The restaurant detected on your current Zomato/Swiggy tab is kept in temporary
    browser memory and erased when the browser closes.</li>
  <li><strong>On Bite Check's server:</strong> nothing about you. Requests are processed and discarded. To speed up repeat
    lookups, the server may briefly (up to 1 hour) remember which Google place ID matches a restaurant name. This is not
    linked to you.</li>
  <li>Bite Check does not store Google Maps photos, reviews or other Google content.</li>
</ul>

<h2>IP addresses and abuse protection</h2>
<p>Like any website, Bite Check's server (hosted on Cloudflare) receives your IP address when your browser contacts it.
It is used only to rate-limit requests (to prevent abuse), is not stored by Bite Check, and is not combined with
anything else. Cloudflare processes traffic under its own privacy policy.</p>

<h2>Third parties</h2>
<ul>
  <li><strong>Google Maps Platform</strong> provides all place information, photos and Street View. When images and maps
    load, your browser connects to Google, so Google's
    <a href="https://policies.google.com/privacy" rel="noopener">Privacy Policy</a> and
    <a href="https://maps.google.com/help/terms_maps/" rel="noopener">Google Maps Terms of Service</a> apply.</li>
  <li><strong>Cloudflare</strong> hosts Bite Check's server:
    <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare Privacy Policy</a>.</li>
</ul>
<p>Bite Check does not sell, rent or share your data, and does not use it for advertising, profiling or credit decisions.
Bite Check is not affiliated with Google, Zomato or Swiggy.</p>

<h2>Permissions the extension uses</h2>
<ul>
  <li><strong>Side panel</strong>: to show Bite Check next to the page you're viewing.</li>
  <li><strong>Storage</strong>: to remember the last place ID, your photo setting, and the restaurant detected on the current tab.</li>
  <li><strong>Access to zomato.com and swiggy.com</strong>: only to read the restaurant name and area/city, as described above.</li>
  <li><strong>Access to Bite Check's server</strong>: to look up restaurants on Google Maps without exposing an API key.</li>
</ul>

<h2>Children</h2>
<p>Bite Check is not directed at children and does not knowingly collect personal information from anyone.</p>

<h2>Changes</h2>
<p>If this policy changes, the new version will be posted on this page with a new "Last updated" date.</p>

<h2>Contact</h2>
<p>Questions about this policy: use the support/contact link on Bite Check's listing in the Microsoft Edge Add-ons store.</p>
</main>
</body>
</html>`;
}
