// Run these tests with `npm run test:e2e:firebase`. They are skipped when VITE_FIREBASE_EMULATOR is not set.

import { expect, test, type Page } from '@playwright/test';
import { claimNickname } from './helpers.ts';

const EMULATED = Boolean(process.env.VITE_FIREBASE_EMULATOR);
test.skip(!EMULATED, 'needs the Firebase emulators (npm run test:e2e:firebase)');

const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function playAsGuest(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play as anonymous guest' }).click();
  await expect(page).toHaveURL(/#\/nickname$/);
}

test('a guest picks a nickname and is shown as that player', async ({ page }) => {
  await playAsGuest(page);
  const name = unique('Ann');
  await claimNickname(page, name);
  await expect(page.locator('[data-ref="who"]')).toHaveText(name);
  await page.goto('/#/leaderboard');
  await expect(page.locator('[data-ref="list"]')).toContainText(name);
});

test('a taken nickname is refused, ignoring case', async ({ browser }) => {
  const name = unique('Bo');
  const first = await browser.newPage();
  await playAsGuest(first);
  await claimNickname(first, name);
  await first.close();

  const second = await browser.newPage();
  await playAsGuest(second);
  await second.getByLabel('Nickname').fill(name.toUpperCase());
  await second.getByRole('button', { name: 'Claim' }).click();
  await expect(second.locator('[data-ref="nicknameHint"]')).toHaveText('That nickname is taken');
  await second.close();
});

test('linking an email lets the nickname be signed into from a fresh browser', async ({ browser }) => {
  const name = unique('Cy');
  const email = `${name.toLowerCase()}@example.com`;
  const password = 'secret-pass';

  const first = await browser.newPage();
  await playAsGuest(first);
  await claimNickname(first, name);
  await first.getByLabel('Email').fill(email);
  await first.getByLabel('Password').fill(password);
  await first.getByRole('button', { name: 'Link email and password' }).click();
  await expect(first.locator('[data-ref="linkHint"]')).toContainText('Linked');
  await first.close();

  const second = await browser.newPage();
  await second.goto('/');
  await second.getByLabel('Email').fill(email);
  await second.getByLabel('Password').fill(password);
  await second.getByRole('button', { name: 'Sign in' }).click();
  await expect(second).toHaveURL(/#\/play$/);
  await expect(second.locator('[data-ref="who"]')).toHaveText(name);
  await second.close();
});
