import { markup, ref } from '../dom.ts';
import { hrefOf, routes } from '../routes.ts';

const LINK =
  'go:flex-1 go:text-center go:px-2.5 go:py-1.5 go:rounded-lg go:text-xs go:font-medium go:text-fg-soft go:hover:text-fg go:hover:bg-control go:transition';
const ACTIVE_LINK = `${LINK} go:bg-control go:text-fg`;

export interface NavLink {
  path: string;
  label: string;
}

const NAVBAR = `
<div class="go:px-4 go:md:px-6 go:py-3 go:flex go:items-center go:gap-3">
  <nav data-ref="links" class="go:flex go:items-center go:gap-1 go:flex-wrap go:w-full" aria-label="Pages"></nav>
</div>`;

export class Navbar {
  private readonly _links: HTMLElement;
  private readonly _entries: NavLink[];

  constructor(host: HTMLElement, links: NavLink[]) {
    const bar = markup(NAVBAR);
    host.replaceChildren(bar);
    this._links = ref(bar, 'links');
    this._entries = links;
    this.highlight(routes.start);
  }

  public highlight(path: string): void {
    this._links.replaceChildren();
    for (const { path: target, label } of this._entries) {
      const link = document.createElement('a');
      link.href = hrefOf(target);
      link.textContent = label;
      link.className = path === target || (target !== routes.start && path.startsWith(target)) ? ACTIVE_LINK : LINK;
      this._links.append(link);
    }
  }
}
