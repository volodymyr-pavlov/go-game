import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

type Policy = Record<string, string[]>;

// Only added to the production build, because the dev server puts styles inline. The frame-ancestors rule is in firebase/firebase.json.
const BASE_POLICY: Policy = {
  'default-src': ["'none'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'"],
  'font-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'frame-src': ["'none'"],
  'manifest-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'object-src': ["'none'"],
};

// Only added when the build has a Firebase project. A build without one keeps the stricter policy. Firebase is for sign-in only. The game server is on this site, so 'self' covers it, WebSocket included.
const FIREBASE_CONNECT = ['https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com'];

// App Check with reCAPTCHA v3. The script and the iframe come from Google, and the tokens come from the App Check API.
const APP_CHECK = {
  script: ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'],
  frame: ['https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/'],
  connect: ['https://firebaseappcheck.googleapis.com'],
};

// Cloudflare Turnstile: the script, and the iframe of its widget.
const TURNSTILE = ['https://challenges.cloudflare.com'];

// Analytics sends data to servers in many regions, so these rules use Google's wildcard hosts. They are added at runtime after the visitor says yes.
const ANALYTICS = {
  script: ['https://www.googletagmanager.com'],
  image: ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
  connect: ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'],
};

function allow(policy: Policy, directive: string, sources: string[]): void {
  const current = (policy[directive] ?? []).filter((source) => source !== "'none'");
  policy[directive] = [...current, ...sources];
}

function serialize(policy: Policy): string {
  return Object.entries(policy)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

function contentSecurityPolicy(env: Record<string, string>): Plugin {
  const policy: Policy = structuredClone(BASE_POLICY);
  if (env.VITE_FIREBASE_PROJECT_ID) allow(policy, 'connect-src', FIREBASE_CONNECT);
  if (env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_RECAPTCHA_SITE_KEY) {
    allow(policy, 'script-src', APP_CHECK.script);
    allow(policy, 'frame-src', APP_CHECK.frame);
    allow(policy, 'connect-src', APP_CHECK.connect);
  }
  if (env.VITE_FIREBASE_PROJECT_ID && env.VITE_TURNSTILE_SITE_KEY) {
    allow(policy, 'script-src', TURNSTILE);
    allow(policy, 'frame-src', TURNSTILE);
    allow(policy, 'connect-src', TURNSTILE);
  }
  if (env.VITE_GA4_ID) {
    allow(policy, 'script-src', ANALYTICS.script);
    allow(policy, 'img-src', ANALYTICS.image);
    allow(policy, 'connect-src', ANALYTICS.connect);
  }
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      // Runs after Vite has minified the page, so the hashes match the inline <style> blocks as they are shipped.
      order: 'post',
      handler: (html) => {
        const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, css]) => css);
        const hashes = styles.map((css) => `'sha256-${createHash('sha256').update(css).digest('base64')}'`);
        const withHashes = structuredClone(policy);
        allow(withHashes, 'style-src', hashes);
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: serialize(withHashes) },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

/** The .env is in the root of the repository, where the game server and the scripts find it too. */
const envDir = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => ({
  envDir,
  // Assets use relative paths, so the build works from any folder, also inside the blog.
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Supports the browsers that Baseline calls "widely available". Older browsers get a message from the check in main.ts.
  build: {
    // A folder that starts with a dot is a folder of generated files, like .wrangler and .reports.
    outDir: '.dist',
    target: 'baseline-widely-available',
    // Small files are not inlined as data: URLs. The security policy in index.html allows fonts only from this site.
    assetsInlineLimit: 0,
    // Property names are not renamed. Each chunk is minified alone, so renaming would break objects that chunks share.
    minify: 'oxc',
  },
  plugins: [tailwindcss(), contentSecurityPolicy(loadEnv(mode, envDir, 'VITE_'))],
  // `npm run cloudflare:dev` serves the game server on this port. The page calls /api on its own address, WebSocket included.
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
}));
