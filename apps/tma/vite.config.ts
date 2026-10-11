import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the build works from any folder. Telegram opens the Mini App from the address the bot is given.
  base: './',
  // The .env is in the root of the repository, like the one of the web app.
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  build: { outDir: '.dist', target: 'baseline-widely-available', assetsInlineLimit: 0 },
  server: { port: 5174, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
});
