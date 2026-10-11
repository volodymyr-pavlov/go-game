/**
 * The Worker in front of the static site. Every request goes to the assets, except `engine.wasm` for a browser that
 * accepts Brotli: that one gets `engine.wasm.br`, which `packages/engine/scripts/build.sh` compressed once at the
 * highest level. Cloudflare would otherwise compress the 4.7 MB binary on every response at a fast, low level, and
 * send a quarter more bytes. `wrangler.jsonc` runs the Worker first for that path only.
 */
interface Env {
  ASSETS: Fetcher;
}

const ENGINE_PATH = '/engine.wasm';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== ENGINE_PATH || request.headers.has('Range') || !acceptsBrotli(request)) {
      return env.ASSETS.fetch(request);
    }
    const compressed = await env.ASSETS.fetch(new Request(new URL(`${ENGINE_PATH}.br`, url), request));
    if (!compressed.ok) return env.ASSETS.fetch(request);
    const headers = new Headers(compressed.headers);
    headers.set('Content-Type', 'application/wasm');
    headers.set('Content-Encoding', 'br');
    headers.set('Vary', 'Accept-Encoding');
    headers.delete('Content-Length');
    return new Response(compressed.body, { status: compressed.status, headers, encodeBody: 'manual' });
  },
} satisfies ExportedHandler<Env>;

/** Whether the browser listed `br` in Accept-Encoding, with or without a quality value. */
function acceptsBrotli(request: Request): boolean {
  const accepted = request.headers.get('Accept-Encoding') ?? '';
  return accepted.split(',').some((encoding) => encoding.trim().split(';')[0] === 'br');
}
