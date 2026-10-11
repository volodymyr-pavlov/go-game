export interface Page {
  element: HTMLElement;
  /** Runs once `element` is in the document. For views that take their size from the page, such as a canvas. */
  mounted?(): void | Promise<void>;
  dispose?(): void;
}

export type Params = Record<string, string>;

export type PageFactory = (params: Params) => Page | Promise<Page>;

interface Route {
  segments: string[];
  build: PageFactory;
}

export class Router {
  private readonly _outlet: HTMLElement;
  private readonly _routes: Route[] = [];
  private _current: Page | null = null;
  /** Grows by one on every navigation. A slow page that finishes after the next navigation started is dropped. */
  private _navigation = 0;

  constructor(outlet: HTMLElement) {
    this._outlet = outlet;
  }

  /** `pattern` is a path like "/game/:room". A part that starts with ":" becomes a parameter. */
  public add(pattern: string, build: PageFactory): this {
    this._routes.push({ segments: split(pattern), build });
    return this;
  }

  /** Finishes when the first page is in the outlet and mounted. */
  public start(): Promise<void> {
    window.addEventListener('hashchange', () => void this._show());
    return this._show();
  }

  public navigate(path: string): void {
    const hash = `#${path}`;
    if (window.location.hash === hash) void this._show();
    else window.location.hash = hash;
  }

  private async _show(): Promise<void> {
    const navigation = ++this._navigation;
    const match = this._match(currentPath());
    if (match === null) return this.navigate('/');
    this._current?.dispose?.();
    this._current = null;
    this._outlet.replaceChildren();
    const page = await match.route.build(match.params);
    if (navigation !== this._navigation) return page.dispose?.();
    this._current = page;
    this._outlet.replaceChildren(page.element);
    window.scrollTo(0, 0);
    await page.mounted?.();
  }

  private _match(path: string): { route: Route; params: Params } | null {
    const segments = split(path);
    for (const route of this._routes) {
      const params = matchSegments(route.segments, segments);
      if (params !== null) return { route, params };
    }
    return null;
  }
}

export function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.startsWith('/') ? hash : '/';
}

function split(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

export function matchSegments(pattern: string[], segments: string[]): Params | null {
  if (pattern.length !== segments.length) return null;
  const params: Params = {};
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i].startsWith(':')) params[pattern[i].slice(1)] = decodeURIComponent(segments[i]);
    else if (pattern[i] !== segments[i]) return null;
  }
  return params;
}
