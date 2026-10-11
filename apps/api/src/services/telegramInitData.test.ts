import { describe, expect, test } from 'vitest';
import { INIT_DATA_MAX_AGE_S, telegramVerifier } from './telegramInitData.ts';

const BOT_TOKEN = '123456:test-bot-token';
const NOW_MS = 1_800_000_000_000;
const encoder = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', imported, encoder.encode(message));
}

/** initData the way Telegram makes it, signed with the bot token. */
async function initData(fields: Record<string, string>, token = BOT_TOKEN): Promise<string> {
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = await hmac(encoder.encode('WebAppData'), token);
  const hash = [...new Uint8Array(await hmac(secret, check))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const fresh = {
  auth_date: String(NOW_MS / 1000 - 60),
  query_id: 'AAH',
  user: JSON.stringify({ id: 42, first_name: 'Ann' }),
};
const verify = telegramVerifier(BOT_TOKEN, () => NOW_MS);

describe('telegramVerifier', () => {
  test('gives the uid of the user in initData that the bot signed', async () => {
    expect(await verify(await initData(fresh))).toBe('tg:42');
  });

  test('refuses initData that another bot signed, or that was changed after it was signed', async () => {
    await expect(verify(await initData(fresh, '999:other-bot'))).rejects.toThrow('not genuine');
    const changed = (await initData(fresh)).replace('%22id%22%3A42', '%22id%22%3A43');
    await expect(verify(changed)).rejects.toThrow('not genuine');
  });

  test('refuses initData with no hash, no user, or that is too old', async () => {
    await expect(verify('auth_date=1&user=%7B%7D')).rejects.toThrow('no hash');
    await expect(verify(await initData({ auth_date: fresh.auth_date }))).rejects.toThrow('no user');
    const old = { ...fresh, auth_date: String(NOW_MS / 1000 - INIT_DATA_MAX_AGE_S - 1) };
    await expect(verify(await initData(old))).rejects.toThrow('too old');
  });
});
