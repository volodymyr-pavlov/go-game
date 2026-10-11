import { messageOf } from '@go-game/core/errors.ts';

export const HIDDEN_CLASS = 'go-modal-hidden';

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing element #${id}`);
  return element as T;
}

export function show(element: HTMLElement): void {
  element.classList.remove(HIDDEN_CLASS);
}

export function hide(element: HTMLElement): void {
  element.classList.add(HIDDEN_CLASS);
}

export function element(tag: string, className: string, text?: string): HTMLElement {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) created.textContent = text;
  return created;
}

export function button(className: string, text: string, onClick?: () => void): HTMLButtonElement {
  const created = element('button', className, text) as HTMLButtonElement;
  created.type = 'button';
  if (onClick) created.onclick = onClick;
  return created;
}

/** Disables `button` while `action` runs. A failure goes to `hint`. Gives true when `action` worked. */
export async function submitWith(
  button: HTMLButtonElement,
  hint: HTMLElement,
  action: () => Promise<void>,
): Promise<boolean> {
  button.disabled = true;
  hint.textContent = '';
  try {
    await action();
    return true;
  } catch (error) {
    hint.textContent = messageOf(error);
    return false;
  } finally {
    button.disabled = false;
  }
}

/** Only for fixed HTML written in the code. Player data must be set with textContent. Never put it into the HTML string. */
export function markup(html: string): HTMLElement {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const first = template.content.firstElementChild;
  if (!(first instanceof HTMLElement)) throw new Error('Markup has no root element');
  return first;
}

export function ref<T extends HTMLElement = HTMLElement>(root: ParentNode, name: string): T {
  const found = root.querySelector(`[data-ref="${name}"]`);
  if (!(found instanceof HTMLElement)) throw new Error(`Missing element data-ref="${name}"`);
  return found as T;
}

/** Like `ref`, for markup that uses ids: the game page keeps them because the end-to-end tests click by id. `root` need not be in the document. */
export function byIdIn<T extends HTMLElement = HTMLElement>(root: ParentNode, id: string): T {
  const found = root.querySelector(`#${id}`);
  if (!(found instanceof HTMLElement)) throw new Error(`Missing element #${id}`);
  return found as T;
}

export function link(href: string, text: string): HTMLAnchorElement {
  const anchor = element('a', classes.link, text) as HTMLAnchorElement;
  anchor.href = href;
  return anchor;
}

export const classes = {
  card: 'go:bg-surface go:border go:border-line go:rounded-2xl go:p-4 go:card-shadow',
  heading: 'go:text-[11px] go:uppercase go:tracking-wider go:text-fg-muted go:font-bold',
  input:
    'go:min-w-0 go:w-full go:bg-input go:border go:border-line-strong go:rounded-lg go:px-3 go:py-2 go:text-sm go:text-fg go:focus:outline-none go:focus:border-highlight',
  primary:
    'go:py-2 go:px-4 go:bg-primary go:hover:bg-primary-hover go:active:scale-95 go:border go:border-primary-line go:rounded-xl go:text-sm go:font-bold go:text-fg go:shadow-md go:shadow-shade/12 go:transition',
  secondary:
    'go:py-2 go:px-4 go:bg-control go:hover:bg-control-hover go:active:scale-95 go:border go:border-line-strong go:rounded-xl go:text-sm go:font-semibold go:text-fg go:transition',
  link: 'go:text-accent go:underline go:hover:text-fg',
  hint: 'go:text-xs go:text-fg-muted go:min-h-[1em]',
  row: 'go:py-1.5 go:px-3 go:rounded-lg go:bg-inset go:border go:border-line go:text-fg-soft go:flex go:items-center go:justify-between go:gap-3 go:text-sm',
  placeholder: 'go:text-fg-muted go:italic go:text-center go:py-3 go:text-sm',
} as const;
