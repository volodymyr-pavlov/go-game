/** A refusal from the server. `message` is written for the player, and `status` is the HTTP status. */
export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The header the server reads the Turnstile token from. */
export const TURNSTILE_HEADER = 'X-Turnstile-Token';

/** Gives the Firebase ID token of the signed-in player, or null when nobody is signed in. */
export type TokenSource = () => Promise<string | null>;

/** The calls to the game server at /api, which is on the same address as the page. */
export class ApiClient {
  private readonly _token: TokenSource;
  private readonly _fetch: typeof fetch;
  private readonly _challenge: (() => Promise<string>) | null;
  private readonly _scheme: string;

  /** `scheme` is the word before the token in the Authorization header: "Bearer" for a Firebase token, "tma" for Telegram's initData. `challenge` gives a Turnstile token. Without it, no call carries one, which only a server in development accepts. */
  constructor(
    token: TokenSource,
    fetcher: typeof fetch = (input, init) => fetch(input, init),
    challenge: (() => Promise<string>) | null = null,
    scheme = 'Bearer',
  ) {
    this._token = token;
    this._fetch = fetcher;
    this._challenge = challenge;
    this._scheme = scheme;
  }

  /** A read that needs no sign-in. The token is sent when there is one. */
  public get<T>(path: string): Promise<T> {
    return this._call<T>('GET', path, undefined, false);
  }

  /** A call for a signed-in player. Gives null when the server answers with no content. */
  public send<T = null>(method: string, path: string, body?: unknown, options: { checked?: boolean } = {}): Promise<T> {
    return this._call<T>(method, path, body, true, options.checked === true);
  }

  public async token(): Promise<string> {
    const token = await this._token();
    if (token === null) throw new Error('Sign in first');
    return token;
  }

  private async _call<T>(method: string, path: string, body: unknown, signedIn: boolean, checked = false): Promise<T> {
    const token = signedIn ? await this.token() : await this._token();
    const headers: Record<string, string> = {};
    if (token !== null) headers.Authorization = `${this._scheme} ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (checked && this._challenge !== null) headers[TURNSTILE_HEADER] = await this._challenge();
    let response: Response;
    try {
      response = await this._fetch(path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error('Cannot reach the game server');
    }
    if (!response.ok) throw new ApiError(response.status, await errorMessageOf(response));
    return response.status === 204 ? (null as T) : ((await response.json()) as T);
  }
}

async function errorMessageOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') return body.error;
  } catch {
    // The body is not the server's JSON. The status is all there is to say.
  }
  return `The game server answered ${response.status}`;
}
