// Cloudflare Turnstile tells a person from a script without a puzzle, most of the time. The server checks every token.

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TOKEN_TIMEOUT_MS = 20_000;

/** The part of the Turnstile script that this app uses. */
export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileOptions): string;
  execute(widget: string): void;
  reset(widget: string): void;
}

interface TurnstileOptions {
  sitekey: string;
  execution: 'execute';
  /** The widget is drawn only when the visitor has to do something. */
  appearance: 'interaction-only';
  callback(token: string): void;
  'error-callback'(): void;
  'expired-callback'(): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Gives a fresh token for one write. A token works once, so each write asks again. */
export type ChallengeToken = () => Promise<string>;

export class TurnstileChallenge {
  private readonly _siteKey: string;
  private readonly _api: () => Promise<TurnstileApi>;
  private readonly _mount: () => HTMLElement;
  private _widget: string | null = null;
  private _pending: { resolve(token: string): void; reject(error: Error): void } | null = null;

  /** `api` and `mount` are the script and the place for the widget. Tests give their own. */
  constructor(
    siteKey: string,
    api: () => Promise<TurnstileApi> = loadTurnstile,
    mount: () => HTMLElement = mountPoint,
  ) {
    this._siteKey = siteKey;
    this._api = api;
    this._mount = mount;
  }

  public readonly token: ChallengeToken = async () => {
    const api = await this._api();
    const widget = (this._widget ??= api.render(this._mount(), {
      sitekey: this._siteKey,
      execution: 'execute',
      appearance: 'interaction-only',
      callback: (token) => this._settle((pending) => pending.resolve(token)),
      'error-callback': () =>
        this._settle((pending) => pending.reject(new Error('The check could not run. Reload the page'))),
      'expired-callback': () => undefined,
    }));
    return new Promise<string>((resolve, reject) => {
      this._pending?.reject(new Error('Another check started'));
      const timer = setTimeout(
        () => this._settle((pending) => pending.reject(new Error('The check took too long'))),
        TOKEN_TIMEOUT_MS,
      );
      this._pending = {
        resolve: (token) => (clearTimeout(timer), resolve(token)),
        reject: (error) => (clearTimeout(timer), reject(error)),
      };
      api.reset(widget);
      api.execute(widget);
    });
  };

  private _settle(finish: (pending: NonNullable<TurnstileChallenge['_pending']>) => void): void {
    const pending = this._pending;
    this._pending = null;
    if (pending !== null) finish(pending);
  }
}

let script: Promise<TurnstileApi> | null = null;

/** Loads the Turnstile script once. */
function loadTurnstile(): Promise<TurnstileApi> {
  script ??= new Promise<TurnstileApi>((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = SCRIPT_URL;
    tag.async = true;
    tag.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('The check could not load')));
    tag.onerror = () => {
      script = null;
      reject(new Error('The check could not load. Are you offline?'));
    };
    document.head.append(tag);
  });
  return script;
}

/** A corner of the page. The widget shows there only when the visitor has to do something. */
function mountPoint(): HTMLElement {
  const corner = document.createElement('div');
  corner.className = 'go:fixed go:bottom-4 go:right-4 go:z-40';
  document.body.append(corner);
  return corner;
}
