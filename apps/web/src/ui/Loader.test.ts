// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { hideLoader } from './Loader.ts';
import { ids } from './ids.ts';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = `<div id="${ids.loader}"></div>`;
});

afterEach(() => vi.useRealTimers());

test('the loader fades out and is then removed', () => {
  hideLoader();
  const loader = document.getElementById(ids.loader);
  assert.ok(loader?.classList.contains('go-loader-done'));
  vi.runAllTimers();
  assert.equal(document.getElementById(ids.loader), null);
});

test('hiding twice, or without a loader, does nothing', () => {
  hideLoader();
  hideLoader();
  vi.runAllTimers();
  assert.equal(document.getElementById(ids.loader), null);
  hideLoader();
});
