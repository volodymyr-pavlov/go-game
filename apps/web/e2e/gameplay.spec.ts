import { expect, test } from '@playwright/test';
import { clickPoint, playTwoAtOneKeyboard, reachBoard } from './helpers.ts';
import { Mode } from '@go-game/core/game.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await reachBoard(page);
});

test('a stone is placed by clicking the board and the turn passes', async ({ page }) => {
  await playTwoAtOneKeyboard(page);
  await clickPoint(page, 4, 4);
  await expect(page.locator('#current-turn-text')).toHaveText('White');
  await clickPoint(page, 4, 4);
  await expect(page.locator('#toast')).toContainText('That point is taken');
});

test('a capture removes the stone and counts it', async ({ page }) => {
  await playTwoAtOneKeyboard(page);
  // Black captures the white stone on D5 (3,4). Black plays C5, D4 and D6, White plays somewhere else, then Black plays E5.
  await clickPoint(page, 2, 4); // B
  await clickPoint(page, 3, 4); // W at D5
  await clickPoint(page, 3, 3); // B
  await clickPoint(page, 0, 0); // W
  await clickPoint(page, 3, 5); // B
  await clickPoint(page, 0, 1); // W
  await clickPoint(page, 4, 4); // B captures
  await expect(page.locator('#black-score')).toHaveText('1 captures');
});

test('two passes end the game with a score and the result dialog', async ({ page }) => {
  await playTwoAtOneKeyboard(page);
  await clickPoint(page, 4, 4);
  await page.click('#pass-btn');
  await page.click('#pass-btn');
  await expect(page.locator('#winner-title')).toHaveText('Black wins!');
  await expect(page.locator('#gameover-modal')).not.toHaveClass(/go-modal-hidden/);
  await page.click('#modal-reset-btn');
  await expect(page.locator('#gameover-modal')).toHaveClass(/go-modal-hidden/);
  await expect(page.locator('#current-turn-text')).toHaveText('Black');
  await expect(page.locator('#black-score')).toHaveText('0 captures');
});

test('the engine answers a move', async ({ page }) => {
  await page.selectOption('#game-mode-select', String(Mode.HUMAN_VS_ENGINE));
  await clickPoint(page, 4, 4);
  await expect(page.locator('#thinking-overlay')).not.toHaveClass(/go-modal-hidden/);
  await expect(page.locator('#thinking-overlay')).toHaveClass(/go-modal-hidden/, { timeout: 30_000 });
  await expect(page.locator('#current-turn-text')).toHaveText('Black');
  await expect(page.locator('#engine-error')).toBeHidden();
});

test('the rules dialog opens and closes', async ({ page }) => {
  await page.click('#rules-btn');
  await expect(page.locator('#rules-modal')).not.toHaveClass(/go-modal-hidden/);
  await page.click('#close-rules-btn');
  await expect(page.locator('#rules-modal')).toHaveClass(/go-modal-hidden/);
});
