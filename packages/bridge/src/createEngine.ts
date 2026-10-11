import type { Engine } from '@go-game/core/ports.ts';
import { WorkerEngine } from './EngineBridge.ts';

/** The engine files live in public/. Their URLs are built from the page URL, not from the worker URL. */
export function createEngine(): Engine {
  const wasmUrl = new URL(`${import.meta.env.BASE_URL}engine.wasm`, window.location.href).href;
  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  return new WorkerEngine(worker, wasmUrl);
}
