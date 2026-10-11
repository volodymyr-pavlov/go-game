import { messageOf } from '@go-game/core/errors.ts';

const SHIM_FILE = 'wasm_exec.js';

export interface GoEngine {
  suggestMove(positionJson: string, playouts: number): string;
}

export async function loadGoEngine(wasmUrl: string): Promise<GoEngine> {
  await loadShim(new URL(SHIM_FILE, wasmUrl).href);
  const go = new Go();
  const instance = await instantiate(wasmUrl, go.importObject);

  // If the Go program stops, later calls must fail with a clear error. They must not call a function that is gone.
  let exit: Error | null = null;
  go.run(instance).then(
    () => (exit = new Error('The Go engine has stopped')),
    (error: unknown) => (exit = new Error(messageOf(error))),
  );

  return {
    suggestMove: (positionJson, playouts) => {
      if (exit !== null) throw exit;
      return suggestMove(positionJson, playouts);
    },
  };
}

async function instantiate(wasmUrl: string, imports: WebAssembly.Imports): Promise<WebAssembly.Instance> {
  const response = await fetch(wasmUrl);
  if (!response.ok) throw new Error(`Could not download the engine (${response.status} ${response.statusText})`);
  if ('instantiateStreaming' in WebAssembly && response.headers.get('content-type') === 'application/wasm') {
    return (await WebAssembly.instantiateStreaming(response, imports)).instance;
  }
  return (await WebAssembly.instantiate(await response.arrayBuffer(), imports)).instance;
}

async function loadShim(url: string): Promise<void> {
  if (typeof Go === 'function') return;
  await import(/* @vite-ignore */ url);
  if (typeof Go !== 'function') throw new Error(`${SHIM_FILE} did not define Go`);
}
