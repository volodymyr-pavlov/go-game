import {
  WorkerRequestType,
  WorkerResponseType,
  type EngineResult,
  type WorkerRequest,
  type WorkerResponse,
} from './EngineBridge.ts';
import type { Suggestion } from '@go-game/core/ports.ts';
import type { Position } from '@go-game/core/rules.ts';
import { messageOf } from '@go-game/core/errors.ts';
import { loadGoEngine, type GoEngine } from './WasmLoader.ts';

let engine: Promise<GoEngine> | null = null;

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === WorkerRequestType.INIT) {
    engine = loadGoEngine(data.wasmUrl);
    return;
  }
  try {
    const suggestion = await search(data.id, data.position, data.playouts);
    reply({ type: WorkerResponseType.SUGGESTION, id: data.id, suggestion });
  } catch (error) {
    reply({ type: WorkerResponseType.FAILURE, id: data.id, message: messageOf(error) });
  }
};

async function search(id: number, position: Position, playouts: number): Promise<Suggestion> {
  if (engine === null) throw new Error(`Search ${id} requested before the engine was initialised`);
  const started = performance.now();
  const raw = (await engine).suggestMove(JSON.stringify(position), playouts);
  const result = JSON.parse(raw) as EngineResult;
  if (result.error !== undefined) throw new Error(result.error);
  return {
    move: result.move ?? null,
    winRate: result.winRate ?? 0,
    elapsedMs: performance.now() - started,
  };
}

function reply(response: WorkerResponse): void {
  self.postMessage(response);
}
