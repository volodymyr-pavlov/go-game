import { describe, expect, test } from 'vitest';
import { turnstileChallenge } from './turnstile.ts';

function challenge(answer: unknown, calls: { url: string; body: string }[] = []) {
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer));
  }) as typeof fetch;
  return turnstileChallenge('secret', fetcher);
}

function request(headers: Record<string, string>): Request {
  return new Request('https://game.test/api/rooms', { method: 'POST', headers });
}

describe('turnstileChallenge', () => {
  test('passes a token that Cloudflare accepts, and sends the secret, the token and the address', async () => {
    const calls: { url: string; body: string }[] = [];
    const passed = await challenge(
      { success: true },
      calls,
    )(request({ 'X-Turnstile-Token': 'tok', 'CF-Connecting-IP': '1.2.3.4' }));
    expect(passed).toBe(true);
    expect(calls[0]!.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(new URLSearchParams(calls[0]!.body).get('secret')).toBe('secret');
    expect(new URLSearchParams(calls[0]!.body).get('response')).toBe('tok');
    expect(new URLSearchParams(calls[0]!.body).get('remoteip')).toBe('1.2.3.4');
  });

  test('refuses a token that Cloudflare refuses', async () => {
    expect(await challenge({ success: false })(request({ 'X-Turnstile-Token': 'tok' }))).toBe(false);
  });

  test('refuses a request with no token, without asking Cloudflare', async () => {
    const calls: { url: string; body: string }[] = [];
    expect(await challenge({ success: true }, calls)(request({}))).toBe(false);
    expect(calls).toEqual([]);
  });

  test('refuses when Cloudflare cannot be reached', async () => {
    expect(await challenge(new Error('down'))(request({ 'X-Turnstile-Token': 'tok' }))).toBe(false);
  });
});
