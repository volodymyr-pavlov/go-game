import assert from 'node:assert/strict';
import { test } from 'vitest';
import { initialPosition } from '@go-game/core/rules.ts';
import {
  WorkerEngine,
  WorkerRequestType,
  WorkerResponseType,
  type WorkerLike,
  type WorkerRequest,
  type WorkerResponse,
} from '../EngineBridge.ts';

class FakeWorker implements WorkerLike {
  public sent: WorkerRequest[] = [];
  public onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public terminated = 0;
  postMessage(message: WorkerRequest): void {
    this.sent.push(message);
  }
  reply(response: WorkerResponse): void {
    this.onmessage!({ data: response } as MessageEvent<WorkerResponse>);
  }
  crash(message: string): void {
    this.onerror!({ message } as ErrorEvent);
  }
  terminate(): void {
    this.terminated++;
  }
}

function searchId(request: WorkerRequest): number {
  assert.equal(request.type, WorkerRequestType.SEARCH);
  return request.type === WorkerRequestType.SEARCH ? request.id : -1;
}

test('the engine initialises the worker and resolves a search by id', async () => {
  const worker = new FakeWorker();
  const engine = new WorkerEngine(worker, 'engine.wasm');
  assert.deepEqual(worker.sent[0], { type: WorkerRequestType.INIT, wasmUrl: 'engine.wasm' });

  const pending = engine.suggestMove(initialPosition(), 50);
  const suggestion = { move: { x: 1, y: 2 }, winRate: 0.6, elapsedMs: 3 };
  worker.reply({ type: WorkerResponseType.SUGGESTION, id: searchId(worker.sent[1]), suggestion });
  assert.deepEqual(await pending, suggestion);
});

test('a failure response rejects that search', async () => {
  const worker = new FakeWorker();
  const engine = new WorkerEngine(worker, 'engine.wasm');
  const pending = engine.suggestMove(initialPosition(), 50);
  worker.reply({ type: WorkerResponseType.FAILURE, id: searchId(worker.sent[1]), message: 'bad position' });
  await assert.rejects(pending, { message: 'bad position' });
});

test('a worker crash rejects every pending search', async () => {
  const worker = new FakeWorker();
  const engine = new WorkerEngine(worker, 'engine.wasm');
  const first = engine.suggestMove(initialPosition(), 50);
  const second = engine.suggestMove(initialPosition(), 50);
  worker.crash('boom');
  await assert.rejects(first, { message: 'boom' });
  await assert.rejects(second, { message: 'boom' });
});

test('disposing the engine terminates the worker and rejects pending searches', async () => {
  const worker = new FakeWorker();
  const engine = new WorkerEngine(worker, 'engine.wasm');
  const pending = engine.suggestMove(initialPosition(), 50);
  engine.dispose();
  assert.equal(worker.terminated, 1);
  await assert.rejects(pending, { message: 'Engine stopped' });
});
