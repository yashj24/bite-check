import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

// CRXJS adds a web_accessible_resources entry for content scripts. Ours is a single
// self-contained file that needs no dynamic imports, and exposing it would let
// zomato.com / swiggy.com detect that Bite Check is installed. Remove it from builds.
function stripContentScriptWar(): Plugin {
  let outDir = 'dist';
  return {
    name: 'bite-check:strip-war',
    apply: 'build',
    enforce: 'post',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const file = resolve(outDir, 'manifest.json');
      const m = JSON.parse(readFileSync(file, 'utf8'));
      const scripts = new Set<string>((m.content_scripts ?? []).flatMap((c: { js?: string[] }) => c.js ?? []));
      m.web_accessible_resources = (m.web_accessible_resources ?? []).filter(
        (w: { resources: string[] }) => !w.resources.every((r) => scripts.has(r)),
      );
      if (m.web_accessible_resources.length === 0) delete m.web_accessible_resources;
      writeFileSync(file, JSON.stringify(m, null, 2));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), crx({ manifest }), stripContentScriptWar()],
  build: {
    target: 'chrome116',
    // Store builds go to their own folder so the unpacked dev copy in dist/ keeps its pinned ID.
    outDir: mode === 'store' ? 'dist-store' : 'dist',
    emptyOutDir: true,
  },
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
}));
