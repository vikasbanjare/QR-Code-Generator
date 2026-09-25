import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { buildRedirectPages, parseLinksFile } from './src/lib/shortlinks.ts';

/** Emits a static redirect page per short link, plus links.json and a 404 fallback. */
function shortLinks(): Plugin {
  return {
    name: 'short-links',
    apply: 'build',
    generateBundle() {
      const text = readFileSync(new URL('./links.json', import.meta.url), 'utf8');
      const file = parseLinksFile(text);
      const { pages, skipped } = buildRedirectPages(file);
      for (const [fileName, source] of Object.entries(pages)) this.emitFile({ type: 'asset', fileName, source });
      this.emitFile({ type: 'asset', fileName: 'links.json', source: text });
      this.emitFile({ type: 'asset', fileName: '404.html', source: readFileSync(new URL('./src/404.html', import.meta.url), 'utf8') });
      if (skipped.length) this.warn(`Skipped invalid short links: ${skipped.join(', ')}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), shortLinks()],
  base: './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
