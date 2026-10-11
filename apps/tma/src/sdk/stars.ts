import { webApp } from './telegram.ts';

export type StarsResult = 'paid' | 'cancelled' | 'failed' | 'pending';

/**
 * Opens the payment sheet of Telegram Stars for an invoice link that the game server made with the bot. Nothing is for
 * sale yet, and the server answers 501 for the invoice, so nothing calls this. It is here for the day something is.
 */
export function payWithStars(invoiceUrl: string): Promise<StarsResult> {
  return new Promise((resolve) => {
    const app = webApp();
    if (app === null) return resolve('failed');
    app.openInvoice(invoiceUrl, resolve);
  });
}
