/** Says whether the request came with a Turnstile token that passed. */
export type Challenge = (request: Request) => Promise<boolean>;

/** The header a page puts its Turnstile token in. */
export const TURNSTILE_HEADER = 'X-Turnstile-Token';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Asks Cloudflare whether the token is good. A token works once, so a replayed one fails. */
export function turnstileChallenge(
  secret: string,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): Challenge {
  return async (request) => {
    const token = request.headers.get(TURNSTILE_HEADER);
    if (token === null || token === '') return false;
    const form = new URLSearchParams({ secret, response: token });
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip !== null) form.set('remoteip', ip);
    try {
      const response = await fetcher(VERIFY_URL, { method: 'POST', body: form });
      return ((await response.json()) as { success?: unknown }).success === true;
    } catch {
      return false;
    }
  };
}
