import { expect, type Page } from '@playwright/test';
import { Mode } from '@go-game/core/game.ts';
import { PADDING_RATIO } from '@go-game/presentation/views/Geometry.ts';

const BOARD_SIZE = 9;

// Getting to the board works with or without a Firebase project. Without one the board is shown right away. With one the
// guest button is shown first, and claiming a guest lands on the nickname page, so the test goes on to the board itself.
export async function reachBoard(page: Page): Promise<void> {
  const canvas = page.locator('#board canvas');
  const guest = page.getByRole('button', { name: 'Play as anonymous guest' });
  await expect(canvas.or(guest)).toBeVisible();
  if (await guest.isVisible()) {
    await guest.click();
    await expect(page).toHaveURL(/#\/nickname$/);
    await page.goto('/#/play');
  }
  await expectBoardReady(page);
}

/** The board has a canvas before it has a game behind it. A click in between reaches nothing. */
export async function expectBoardReady(page: Page): Promise<void> {
  await expect(page.locator('#board[data-ready="true"] canvas')).toBeVisible();
}

export async function claimNickname(page: Page, name: string): Promise<void> {
  await page.getByLabel('Nickname').fill(name);
  await page.getByRole('button', { name: 'Claim' }).click();
  await expect(page.locator('[data-ref="nicknameHint"]')).toHaveText('Saved.');
}

/** Clicks the intersection (x, y) of the board. Both count from the top left, from 0. */
export async function clickPoint(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator('#board canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('No canvas');
  const padding = box.width * PADDING_RATIO;
  const cell = (box.width - padding * 2) / (BOARD_SIZE - 1);
  await canvas.click({ position: { x: padding + x * cell, y: padding + y * cell } });
}

/**
 * Switches the game to two people at one keyboard. The colour names on the side panel prove that this game loop took
 * the change. Without them, a click that lands while the game still is against the engine is ignored, and the test
 * fails later with a message that does not say why.
 */
export async function playTwoAtOneKeyboard(page: Page): Promise<void> {
  await page.selectOption('#game-mode-select', String(Mode.HUMAN_VS_HUMAN));
  await expect(page.locator('#black-label')).toHaveText('Black');
  await expect(page.locator('#white-label')).toHaveText('White');
}
