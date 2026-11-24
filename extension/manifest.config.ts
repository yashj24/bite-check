import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';
import pkg from './package.json';

// Public key that pins the unpacked/dev extension ID to:
//   nchocabamllnjgedjmglpenihacaokpf
// It's a PUBLIC key (safe to commit); no private key is needed or kept.
// The Chrome Web Store assigns its own ID, so `npm run build:store` leaves this out.
const DEV_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Nv7d5HX29RhDy7/4ab9Rrc/Y23ALyKd8xrL127nPISdXeJbdrYOyziWLOGGEhyNz9s9KZamQN2Of5T8o5d10grsoX3hCiayqY+YCZ7Jws1QF7mBNhm0I3Jj1vrtVu8v/7NIHmStqM4At/XuQD/U/n0vmsRXUjYHthJyaB+RTtjxR9kYj38S1GjX8SWIdlGS1pJbo/g+unRZyJU+rDbfJd8GjdXrAQhXjyPPEyS6GfhQZwCWYIw1qi6cGyivCEJRRAhdJnLINumU8hh+Sllxjbb+PYMHZ8Pm8LKzEJC+RGtQ+1g3G2cJv10B5O/HMhSomLfolunaXg0rn8Q1fj8P2QIDAQAB';

export default defineManifest((env) => {
  const vars = loadEnv(env.mode, process.cwd(), '');
  const proxyOrigin = new URL(vars.VITE_PROXY_URL || 'http://localhost:8787').origin;
  const isBuild = env.command === 'build';
  const forStore = env.mode === 'store';

  return {
    manifest_version: 3,
    ...(!forStore && { key: DEV_PUBLIC_KEY }),
    name: 'Bite Check',
    short_name: 'Bite Check',
    description:
      'See what a restaurant looks like (photos and Street View) from Google Maps, in a side panel.',
    version: pkg.version,
    minimum_chrome_version: '116',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: { default_title: 'Open Bite Check' },
    background: { service_worker: 'src/background/service-worker.ts', type: 'module' },
    side_panel: { default_path: 'src/sidepanel/index.html' },
    // Minimal: no "tabs", no "activeTab", no <all_urls>. The content script's match
    // patterns are the only access to zomato.com / swiggy.com.
    permissions: ['sidePanel', 'storage'],
    host_permissions: [`${proxyOrigin}/*`],
    content_scripts: [
      {
        matches: ['https://www.zomato.com/*', 'https://zomato.com/*', 'https://www.swiggy.com/*', 'https://swiggy.com/*'],
        js: ['src/content/detect.ts'],
        run_at: 'document_idle',
      },
    ],
    // Strict CSP in built packages. `npm run dev` keeps Chrome's default so Vite HMR works.
    ...(isBuild && {
      content_security_policy: {
        extension_pages: [
          "script-src 'self'",
          "object-src 'self'",
          `connect-src ${proxyOrigin}`,
          // Street View / map page hosted on the proxy domain (MV3 option b).
          `frame-src ${proxyOrigin}`,
          "img-src 'self' data: https://*.googleusercontent.com",
        ].join('; '),
      },
    }),
  };
});
