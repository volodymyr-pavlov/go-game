// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { NicknameSetupPage } from '../NicknameSetupPage.ts';
import { settled } from '@go-game/core/testing/timers.ts';
import { button, fakeContext, fakeContextWithoutFirebase, input, text } from './fakes.ts';

function submit(root: ParentNode, form: string): void {
  (root.querySelector(`[data-ref="${form}"]`) as HTMLFormElement).dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
}

test('claiming a nickname signs the visitor in first and reports success', async () => {
  const context = fakeContext();
  const { element } = NicknameSetupPage(context);
  input(element, 'nickname').value = 'Alice';
  submit(element, 'nicknameForm');
  await settled();
  assert.equal(context.session.guestSignIns, 1);
  assert.deepEqual(context.session.claimed, ['Alice']);
  assert.equal(text(element, 'nicknameHint'), 'Saved.');
  assert.ok(text(element, 'current').includes('Alice'));
});

test('a taken nickname is reported and the button released', async () => {
  const context = fakeContext();
  context.session.failWith = 'That nickname is taken';
  const { element } = NicknameSetupPage(context);
  input(element, 'nickname').value = 'Alice';
  submit(element, 'nicknameForm');
  await settled();
  assert.equal(text(element, 'nicknameHint'), 'That nickname is taken');
  assert.equal(button(element, 'claim').disabled, false);
});

test('the current nickname is prefilled and the link form shown for a guest', () => {
  const context = fakeContext();
  context.session.emit({ uid: 'u1', nickname: 'Alice', isGuest: true, email: null });
  const { element } = NicknameSetupPage(context);
  assert.equal(input(element, 'nickname').value, 'Alice');
  assert.equal((element.querySelector('[data-ref="linkCard"]') as HTMLElement).hidden, false);
});

test('linking an email hands it to the session and hides the form afterwards', async () => {
  const context = fakeContext();
  context.session.emit({ uid: 'u1', nickname: 'Alice', isGuest: true, email: null });
  const { element } = NicknameSetupPage(context);
  input(element, 'email').value = 'a@example.com';
  input(element, 'password').value = 'secret1';
  submit(element, 'linkForm');
  await settled();
  assert.deepEqual(context.session.linked, [{ email: 'a@example.com', password: 'secret1' }]);
  assert.ok(text(element, 'linkHint').startsWith('Linked'));
  assert.equal((element.querySelector('[data-ref="linkForm"]') as HTMLFormElement).hidden, true);
  assert.ok(text(element, 'linkText').includes('a@example.com'));
});

test('signing out returns to the start page and disposing stops listening', async () => {
  const context = fakeContext();
  context.session.emit({ uid: 'u1', nickname: 'Alice', isGuest: true, email: null });
  const page = NicknameSetupPage(context);
  button(page.element, 'signOut').click();
  await settled();
  assert.equal(context.session.signOuts, 1);
  assert.deepEqual(context.visited, ['/']);
  page.dispose?.();
  context.session.emit({ uid: 'u2', nickname: 'Bob', isGuest: true, email: null });
  assert.equal(input(page.element, 'nickname').value, 'Alice');
});

test('without Firebase the page says so', () => {
  const { element } = NicknameSetupPage(fakeContextWithoutFirebase());
  assert.ok(element.textContent?.includes('no player accounts'));
});
