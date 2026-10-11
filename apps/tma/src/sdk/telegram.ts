// The part of the Telegram Mini App SDK that this app uses. The script is loaded by index.html, and it puts `Telegram` on the window.

import { ApiClient } from '@go-game/client/client.ts';

type HapticImpact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';

interface TelegramWebApp {
  /** The signed data that proves to the game server who the player is. The server checks it. */
  initData: string;
  ready(): void;
  expand(): void;
  close(): void;
  BackButton: { show(): void; hide(): void; onClick(listener: () => void): void; offClick(listener: () => void): void };
  HapticFeedback: { impactOccurred(style: HapticImpact): void; notificationOccurred(type: HapticNotification): void };
  openInvoice(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** The SDK, or null when the page is not open inside Telegram, for example in a browser during development. */
export function webApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/** Tells Telegram the app is ready to be shown, and asks for the whole height. */
export function startMiniApp(): void {
  const app = webApp();
  app?.ready();
  app?.expand();
}

/** A short tap of the phone, for a stone that was played. It does nothing outside Telegram. */
export function tap(): void {
  webApp()?.HapticFeedback.impactOccurred('light');
}

/** A longer buzz for the end of a game. */
export function buzz(won: boolean): void {
  webApp()?.HapticFeedback.notificationOccurred(won ? 'success' : 'warning');
}

/** The Back button of Telegram, in the top bar of the Mini App. It calls `onBack` and shows only while `visible`. */
export function backButton(visible: boolean, onBack: () => void): () => void {
  const button = webApp()?.BackButton;
  if (button === undefined) return () => undefined;
  if (visible) {
    button.onClick(onBack);
    button.show();
  } else {
    button.hide();
  }
  return () => button.offClick(onBack);
}

/** The client of the game server for this player. The server checks the initData, so no password is needed. */
export function gameServer(): ApiClient {
  return new ApiClient(async () => webApp()?.initData || null, undefined, null, 'tma');
}
