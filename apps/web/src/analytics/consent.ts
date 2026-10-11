// Nothing from Google is loaded before the visitor says yes.

import { button, element } from '../ui/dom.ts';
import { Choice, clearChoice, storeChoice, storedChoice } from './choice.ts';

const RESET_ATTRIBUTE = 'data-consent-reset';
const ANALYTICS_COOKIE_PREFIX = '_ga';
const PRIVACY_HREF = 'privacy.html';

const BAR_CLASS =
  'go:fixed go:bottom-0 go:inset-x-0 go:z-30 go:bg-surface go:border-t go:border-line go:shadow-2xl go:shadow-shade/25 go:px-4 go:py-3 go:flex go:flex-wrap go:items-center go:justify-center go:gap-3 go:text-xs go:text-fg-soft';
const DECLINE_CLASS =
  'go:py-1.5 go:px-3 go:bg-control go:hover:bg-control-hover go:active:scale-95 go:border go:border-line-strong go:rounded-lg go:text-xs go:font-semibold go:text-fg go:transition';
const ALLOW_CLASS =
  'go:py-1.5 go:px-3 go:bg-primary go:hover:bg-primary-hover go:active:scale-95 go:border go:border-primary-line go:rounded-lg go:text-xs go:font-semibold go:text-fg go:transition';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function initConsent(): void {
  const measurementId = import.meta.env.VITE_GA4_ID;
  if (!measurementId) return;
  const choice = storedChoice();
  if (choice === Choice.GRANTED) loadAnalytics(measurementId);
  if (choice === null) askForConsent(measurementId);
  for (const link of document.querySelectorAll(`[${RESET_ATTRIBUTE}]`)) {
    link.addEventListener('click', withdrawConsent);
    (link as HTMLElement).hidden = false;
    (link.closest(`[${RESET_ATTRIBUTE}-item]`) as HTMLElement | null)?.removeAttribute('hidden');
  }
}

function loadAnalytics(measurementId: string): void {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  // The visitor said yes to analytics only. Every advertising option stays off.
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(tag);
}

function askForConsent(measurementId: string): void {
  const bar = element('div', BAR_CLASS);
  bar.id = 'consent';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Analytics consent');
  const text = element('p', '', 'Can this site count your visit with Google Analytics? This sets cookies. ');
  const privacy = element('a', 'go:underline', 'Privacy') as HTMLAnchorElement;
  privacy.href = PRIVACY_HREF;
  text.append(privacy);
  const decide = (choice: Choice) => () => {
    storeChoice(choice);
    bar.remove();
    if (choice === Choice.GRANTED) loadAnalytics(measurementId);
  };
  bar.append(
    text,
    button(ALLOW_CLASS, 'Allow', decide(Choice.GRANTED)),
    button(DECLINE_CLASS, 'Decline', decide(Choice.DENIED)),
  );
  document.body.append(bar);
}

function withdrawConsent(event: Event): void {
  event.preventDefault();
  clearChoice();
  deleteAnalyticsCookies();
  location.reload();
}

function deleteAnalyticsCookies(): void {
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim() ?? '';
    if (!name.startsWith(ANALYTICS_COOKIE_PREFIX)) continue;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`;
  }
}
