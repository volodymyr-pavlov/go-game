// Run these tests with `npm run test:e2e:firebase`. They are skipped when VITE_FIREBASE_EMULATOR is not set.

import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { claimNickname, clickPoint, expectBoardReady } from './helpers.ts';

const EMULATED = Boolean(process.env.VITE_FIREBASE_EMULATOR);
test.skip(!EMULATED, 'needs the Firebase emulators (npm run test:e2e:firebase)');

const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

/** A player in a browser of their own, so the two players do not share a sign-in. */
async function signedInPlayer(context: BrowserContext, nickname: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Play as anonymous guest' }).click();
  await expect(page).toHaveURL(/#\/nickname$/);
  await claimNickname(page, nickname);
  return page;
}

test('two players open a room, join it, trade moves and one resigns', async ({ browser }) => {
  const hostName = unique('Hana');
  const guestName = unique('Gus');
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await signedInPlayer(hostContext, hostName);
  const guest = await signedInPlayer(guestContext, guestName);

  await host.goto('/#/lobby');
  await host.getByRole('button', { name: 'Open a room' }).click();
  await expect(host.getByText('Waiting for an opponent')).toBeVisible();

  await guest.goto('/#/lobby');
  const room = guest.getByRole('listitem').filter({ hasText: `${hostName} is waiting` });
  await expect(room).toBeVisible();
  await room.getByRole('button', { name: 'Join' }).click();

  for (const page of [host, guest]) {
    await expect(page).toHaveURL(/#\/game\/.+$/);
    await expectBoardReady(page);
  }
  await expect(host.locator('#online-notice')).toHaveText(`Online game against ${guestName}. You play Black.`);
  await expect(guest.locator('#online-notice')).toHaveText(`Online game against ${hostName}. You play White.`);

  await clickPoint(host, 4, 4);
  await expect(host.locator('#current-turn-text')).toHaveText('White');
  await expect(guest.locator('#current-turn-text')).toHaveText('White');

  await clickPoint(guest, 3, 3);
  await expect(host.locator('#current-turn-text')).toHaveText('Black');
  await expect(guest.locator('#current-turn-text')).toHaveText('Black');

  await guest.click('#resign-btn');
  for (const page of [host, guest]) {
    await expect(page.locator('#winner-title')).toHaveText('Black wins!');
    await expect(page.locator('#gameover-modal')).not.toHaveClass(/go-modal-hidden/);
  }

  await hostContext.close();
  await guestContext.close();
});
