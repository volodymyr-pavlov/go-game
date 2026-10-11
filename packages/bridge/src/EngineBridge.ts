import type { Engine, Suggestion } from '@go-game/core/ports.ts';
import type { Position } from '@go-game/core/rules.ts';

export type { Engine, Suggestion } from '@go-game/core/ports.ts';

export interface EngineResult {
  move?: { x: number; y: number } | null;
  winRate?: number;
  error?: string;
}

/** What the page says to the engine worker. */
export const WorkerRequestType = { INIT: 1, SEARCH: 2 } as const;

export type WorkerRequest =
  | { type: typeof WorkerRequestType.INIT; wasmUrl: string }
  | { type: typeof WorkerRequestType.SEARCH; id: number; position: Position; playouts: number };

/** What the engine worker says to the page. */
export const WorkerResponseType = { SUGGESTION: 1, FAILURE: 2 } as const;

export type WorkerResponse =
  | { type: typeof WorkerResponseType.SUGGESTION; id: number; suggestion: Suggestion }
  | { type: typeof WorkerResponseType.FAILURE; id: number; message: string };

export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}

interface PendingSearch {
  resolve(suggestion: Suggestion): void;
  reject(error: Error): void;
}

export class WorkerEngine implements Engine {
  private readonly _worker: WorkerLike;
  private readonly _pending = new Map<number, PendingSearch>();
  private _nextId = 1;

  constructor(worker: WorkerLike, wasmUrl: string) {
    this._worker = worker;
    worker.onmessage = ({ data }) => this._settle(data);
    worker.onerror = (event) => this._failAll(new Error(event.message || 'Engine worker crashed'));
    worker.postMessage({ type: WorkerRequestType.INIT, wasmUrl });
  }

  public suggestMove(position: Position, playouts: number): Promise<Suggestion> {
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._worker.postMessage({ type: WorkerRequestType.SEARCH, id, position, playouts });
    });
  }

  public dispose(): void {
    this._worker.terminate();
    this._failAll(new Error('Engine stopped'));
  }

  private _settle(response: WorkerResponse): void {
    const pending = this._pending.get(response.id);
    if (pending === undefined) return;
    this._pending.delete(response.id);
    if (response.type === WorkerResponseType.SUGGESTION) pending.resolve(response.suggestion);
    else pending.reject(new Error(response.message));
  }

  private _failAll(error: Error): void {
    for (const pending of this._pending.values()) pending.reject(error);
    this._pending.clear();
  }
}
