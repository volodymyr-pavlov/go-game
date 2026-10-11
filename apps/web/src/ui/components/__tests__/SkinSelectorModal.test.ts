// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { SkinListener, SkinSelection } from '@go-game/presentation/skins/SkinManager.ts';
import { DEFAULT_SKIN } from '@go-game/presentation/skins/SkinRegistry.ts';
import type { SkinConfig, SkinId } from '@go-game/presentation/skins/SkinTypes.ts';
import { SkinSelectorModal } from '../SkinSelectorModal.ts';

// A second skin for the tests. The registry has only one, so this id is not a SkinId.
const SLATE_ID = 'slate' as SkinId;
const slate: SkinConfig = { ...DEFAULT_SKIN, id: SLATE_ID, name: 'Slate', description: 'A grey stone board.' };
const LIST: readonly SkinConfig[] = [DEFAULT_SKIN, slate];

class FakeSkins implements SkinSelection {
  public current = DEFAULT_SKIN;
  public selected: SkinId[] = [];
  private readonly _listeners = new Set<SkinListener>();

  select(id: SkinId): void {
    this.selected.push(id);
    this.current = LIST.find((skin) => skin.id === id) ?? DEFAULT_SKIN;
    for (const listener of this._listeners) listener(this.current);
  }
  onChange(listener: SkinListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }
}

function card(host: HTMLElement, id: SkinId): HTMLButtonElement {
  return host.querySelector(`[data-skin="${id}"]`) as HTMLButtonElement;
}

test('the cards show every skin with the current one marked', () => {
  const host = document.createElement('div');
  new SkinSelectorModal(host, new FakeSkins(), LIST);
  assert.equal(host.querySelectorAll('button').length, 2);
  assert.equal(card(host, 'classic').getAttribute('aria-pressed'), 'true');
  assert.equal(card(host, SLATE_ID).getAttribute('aria-pressed'), 'false');
  assert.ok(card(host, 'classic').textContent?.includes('Classic Wood'));
  assert.ok(card(host, SLATE_ID).textContent?.includes('Slate'));
});

test('clicking a card selects the skin and marks it as selected', () => {
  const host = document.createElement('div');
  const skins = new FakeSkins();
  new SkinSelectorModal(host, skins, LIST);
  card(host, SLATE_ID).click();
  assert.deepEqual(skins.selected, [SLATE_ID]);
  assert.equal(card(host, SLATE_ID).getAttribute('aria-pressed'), 'true');
  assert.equal(card(host, 'classic').getAttribute('aria-pressed'), 'false');
  assert.equal(card(host, SLATE_ID).querySelector<HTMLElement>('[data-ref="badge"]')?.hidden, false);
  assert.equal(card(host, 'classic').querySelector<HTMLElement>('[data-ref="badge"]')?.hidden, true);
});

test('disposing stops following the selection', () => {
  const host = document.createElement('div');
  const skins = new FakeSkins();
  const modal = new SkinSelectorModal(host, skins, LIST);
  modal.dispose();
  skins.select(SLATE_ID);
  assert.equal(card(host, SLATE_ID).getAttribute('aria-pressed'), 'false');
});
