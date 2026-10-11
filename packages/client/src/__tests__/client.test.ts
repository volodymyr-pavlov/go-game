import assert from 'node:assert/strict';
import { test } from 'vitest';
import { ApiClient, ApiError } from '../client.ts';

type Call = { path: string; method: string; headers: Record<string, string>; body: string | undefined };

function client(answer: (call: Call) => Response | Promise<Response>, token: string | null = 'tok') {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init: RequestInit) => {
    const call = {
      path,
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: init.body as string,
    };
    calls.push(call);
    return answer(call);
  }) as typeof fetch;
  return { api: new ApiClient(async () => token, fetcher), calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test('a read sends the token when there is one, and a call needs it', async () => {
  const { api, calls } = client(() => json({ ok: 1 }));
  assert.deepEqual(await api.get('/api/leaderboard'), { ok: 1 });
  assert.equal(calls[0]!.headers.Authorization, 'Bearer tok');

  const signedOut = client(() => json({}), null);
  await signedOut.api.get('/api/leaderboard');
  assert.equal(signedOut.calls[0]!.headers.Authorization, undefined);
  await assert.rejects(signedOut.api.send('POST', '/api/rooms'), /Sign in first/);
  assert.equal(signedOut.calls.length, 1);
});

test('a body goes as JSON, and no content gives null', async () => {
  const { api, calls } = client(() => new Response(null, { status: 204 }));
  assert.equal(await api.send('PUT', '/api/me/nickname', { nickname: 'Ann' }), null);
  assert.equal(calls[0]!.method, 'PUT');
  assert.equal(calls[0]!.headers['Content-Type'], 'application/json');
  assert.equal(calls[0]!.body, '{"nickname":"Ann"}');
});

test('a refusal keeps the message of the server and the status', async () => {
  const { api } = client(() => json({ error: 'That nickname is taken' }, 409));
  await assert.rejects(api.send('PUT', '/api/me/nickname', {}), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.message, 'That nickname is taken');
    return true;
  });
});

test('an answer that is not the server’s JSON is reported by its status, and no network is said plainly', async () => {
  const { api } = client(() => new Response('<html>', { status: 502 }));
  await assert.rejects(api.get('/api/leaderboard'), /answered 502/);
  const offline = new ApiClient(async () => 'tok', (() =>
    Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch);
  await assert.rejects(offline.get('/api/leaderboard'), /Cannot reach the game server/);
});

test('a checked call carries a fresh Turnstile token, and an unchecked one does not', async () => {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init: RequestInit) => {
    calls.push({
      path,
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: undefined,
    });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  let issued = 0;
  const api = new ApiClient(
    async () => 'tok',
    fetcher,
    async () => `challenge-${++issued}`,
  );
  await api.send('POST', '/api/rooms', undefined, { checked: true });
  await api.send('POST', '/api/rooms', undefined, { checked: true });
  await api.send('DELETE', '/api/me');
  assert.deepEqual(
    calls.map((call) => call.headers['X-Turnstile-Token']),
    ['challenge-1', 'challenge-2', undefined],
  );
});

test('the word before the token is the scheme, so a Telegram Mini App sends its initData as tma', async () => {
  const calls: Call[] = [];
  const fetcher = (async (path: string, init: RequestInit) => {
    calls.push({
      path,
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: undefined,
    });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const api = new ApiClient(async () => 'query_id=AAH&hash=abc', fetcher, null, 'tma');
  await api.send('DELETE', '/api/me');
  assert.equal(calls[0]!.headers.Authorization, 'tma query_id=AAH&hash=abc');
});
