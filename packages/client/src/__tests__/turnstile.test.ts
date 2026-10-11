import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { TOKEN_TIMEOUT_MS, TurnstileChallenge, type TurnstileApi } from '../turnstile.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type Options = Parameters<TurnstileApi['render']>[1];

/** A Turnstile that answers when the test says so. */
function fakeTurnstile() {
  const log: string[] = [];
  let options: Options | null = null;
  const api: TurnstileApi = {
    render: (_container, given) => {
      log.push('render');
      options = given;
      return 'widget-1';
    },
    execute: (widget) => log.push(`execute ${widget}`),
    reset: (widget) => log.push(`reset ${widget}`),
  };
  const challenge = new TurnstileChallenge(
    'site',
    async () => api,
    () => ({}) as HTMLElement,
  );
  return {
    challenge,
    log,
    answer: (token: string) => options!.callback(token),
    fail: () => options!['error-callback'](),
  };
}

test('a token is asked for, and the widget is drawn once and used again for the next one', async () => {
  const { challenge, log, answer } = fakeTurnstile();
  const first = challenge.token();
  await vi.advanceTimersByTimeAsync(0);
  answer('one');
  assert.equal(await first, 'one');

  const second = challenge.token();
  await vi.advanceTimersByTimeAsync(0);
  answer('two');
  assert.equal(await second, 'two');
  assert.deepEqual(log, ['render', 'reset widget-1', 'execute widget-1', 'reset widget-1', 'execute widget-1']);
});

test('a check that fails is an error the player can read', async () => {
  const { challenge, fail } = fakeTurnstile();
  const token = challenge.token();
  const outcome = assert.rejects(token, /could not run/);
  await vi.advanceTimersByTimeAsync(0);
  fail();
  await outcome;
});

test('a check that never answers gives up', async () => {
  const { challenge } = fakeTurnstile();
  const token = challenge.token();
  const outcome = assert.rejects(token, /took too long/);
  await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS);
  await outcome;
});
