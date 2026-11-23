import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';
import pkg from './package.json';

export default defineManifest((env) => {
  const vars = loadEnv(env.mode, process.cwd(), '');
  const proxyOrigin = new URL(vars.VITE_PROXY_URL || 'http://localhost:8787').origin;
  const isProd = env.mode === 'production';

  return {
    manifest_version: 3,
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
    // Strict CSP in production builds. Dev builds keep Chrome's default so Vite HMR works.
    ...(isProd && {
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
