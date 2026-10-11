// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { GuestLoginPage } from '../GuestLoginPage.ts';
import { settled } from '@go-game/core/testing/timers.ts';
import { button, fakeContext, fakeContextWithoutFirebase, input, text } from './fakes.ts';

test('one click signs in as a guest and goes to the nickname page', async () => {
  const context = fakeContext();
  const { element } = GuestLoginPage(context);
  button(element, 'guest').click();
  await settled();
  assert.equal(context.session.guestSignIns, 1);
  assert.deepEqual(context.visited, ['/nickname']);
});

test('a guest who already has a nickname goes straight to the game', async () => {
  const context = fakeContext();
  context.session.emit({ uid: 'u1', nickname: 'Alice', isGuest: true, email: null });
  const { element } = GuestLoginPage(context);
  button(element, 'guest').click();
  await settled();
  assert.deepEqual(context.visited, ['/play']);
});

test('a failed sign-in is shown and the button released', async () => {
  const context = fakeContext();
  context.session.failWith = 'network down';
  const { element } = GuestLoginPage(context);
  button(element, 'guest').click();
  await settled();
  assert.equal(text(element, 'hint'), 'network down');
  assert.equal(button(element, 'guest').disabled, false);
  assert.deepEqual(context.visited, []);
});

test('a linked account signs in with email and password', async () => {
  const context = fakeContext();
  const { element } = GuestLoginPage(context);
  input(element, 'email').value = 'a@example.com';
  input(element, 'password').value = 'secret1';
  (element.querySelector('[data-ref="form"]') as HTMLFormElement).dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
  await settled();
  assert.deepEqual(context.session.signedInWith, [{ email: 'a@example.com', password: 'secret1' }]);
  assert.deepEqual(context.visited, ['/play']);
});

test('without Firebase the page offers offline play only', () => {
  const context = fakeContextWithoutFirebase();
  const { element } = GuestLoginPage(context);
  assert.equal(button(element, 'guest').hidden, true);
  assert.equal(button(element, 'offline').hidden, false);
  button(element, 'offline').click();
  assert.deepEqual(context.visited, ['/play']);
});
