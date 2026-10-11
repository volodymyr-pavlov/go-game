// There is only one skin. Classic Wood must be applied and the skin picker must be hidden.

import { expect, test } from '@playwright/test';
import { reachBoard } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await reachBoard(page);
});

test('the classic wood skin is applied and, being the only one, has no picker button', async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.dataset.skin)).toBe('classic');
  await expect(page.locator('#skin-btn')).toBeHidden();
  await expect(page.locator('#skin-list [data-skin="classic"]')).toHaveAttribute('aria-pressed', 'true');
});
