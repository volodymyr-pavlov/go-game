// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DEFAULT_OPPONENT, OPPONENTS } from '@go-game/core/opponents.ts';
import { GameControls } from '../GameControls.ts';
import { markup } from '../../dom.ts';
import { ids } from '../../ids.ts';
import { Mode } from '@go-game/core/game.ts';

/** Only the dropdowns: the constructor needs them, and `bind` is not called here. */
function controls(): { root: HTMLElement; controls: GameControls } {
  const root = markup(
    `<div><select id="${ids.modeSelect}"><option value="2" selected></option></select><select id="${ids.opponentSelect}"></select></div>`,
  );
  return { root, controls: new GameControls(root, false) };
}

test('the opponent dropdown is filled from the table and starts on the default opponent', () => {
  const { root, controls: subject } = controls();
  const options = [...root.querySelectorAll(`#${ids.opponentSelect} option`)];
  assert.deepEqual(
    options.map((option) => option.textContent),
    OPPONENTS.map((opponent) => opponent.name),
  );
  assert.equal(subject.playouts(), DEFAULT_OPPONENT.playouts);
});

test('a playout count that is not in the table is an error, not NaN for the engine', () => {
  const { root, controls: subject } = controls();
  const select = root.querySelector<HTMLSelectElement>(`#${ids.opponentSelect}`)!;
  const bogus = document.createElement('option');
  bogus.value = 'fast';
  select.append(bogus);
  select.value = 'fast';
  assert.throws(() => subject.playouts(), /Unknown opponent "fast"/);
});

test('an online game reports the online mode whatever the dropdown says', () => {
  const { root } = controls();
  assert.equal(new GameControls(root, true).mode(), Mode.ONLINE);
  assert.equal(new GameControls(root, false).mode(), Mode.HUMAN_VS_ENGINE);
});
