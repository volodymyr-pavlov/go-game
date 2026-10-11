/** Gives the uid of the Telegram user who holds this `initData`, or throws when it is not genuine. */
export type TelegramVerifier = (initData: string) => Promise<string>;

/** The uid of a Telegram user starts with this, so it never equals the uid of a Firebase user. */
export const TELEGRAM_UID_PREFIX = 'tg:';

/** A Mini App session older than this must start again, so a leaked initData does not work for ever. */
export const INIT_DATA_MAX_AGE_S = 24 * 60 * 60;

const encoder = new TextEncoder();

/**
 * Checks the initData that Telegram gives a Mini App, the way Telegram documents it: the `hash` is an HMAC-SHA256 of the
 * other fields, sorted, with a key made from the bot token. Only Telegram and the bot know that key.
 */
export function telegramVerifier(botToken: string, now: () => number = Date.now): TelegramVerifier {
  return async (initData) => {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');
    if (hash === null) throw new Error('The initData has no hash');

    const fields = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const dataCheckString = fields.map(([key, value]) => `${key}=${value}`).join('\n');
    const secret = await hmac(encoder.encode('WebAppData'), botToken);
    const expected = toHex(await hmac(secret, dataCheckString));
    if (!sameText(expected, hash)) throw new Error('The initData is not genuine');

    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || now() / 1000 - authDate > INIT_DATA_MAX_AGE_S)
      throw new Error('The initData is too old');

    const user = JSON.parse(params.get('user') ?? 'null') as { id?: unknown } | null;
    if (typeof user?.id !== 'number') throw new Error('The initData has no user');
    return `${TELEGRAM_UID_PREFIX}${user.id}`;
  };
}

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', imported, encoder.encode(message));
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Compares without stopping at the first difference, so the time it takes says nothing about the hash. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
