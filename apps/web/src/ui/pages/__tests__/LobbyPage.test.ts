// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { settled } from '@go-game/core/testing/timers.ts';
import { LobbyPage } from '../LobbyPage.ts';
import { button, fakeContext, openRoom, text } from './fakes.ts';

const alice = { uid: 'alice', nickname: 'Alice', isGuest: true, email: null };

test('a signed-out visitor is pointed at the start page and cannot open a room', () => {
  const { element } = LobbyPage(fakeContext());
  assert.ok(text(element, 'hint').includes('Sign in'));
  assert.equal(button(element, 'create').disabled, true);
});

test('other players’ rooms are listed and joining one goes to the game', async () => {
  const context = fakeContext();
  context.session.emit(alice);
  context.sync.rooms = [openRoom('mine', 'alice', 'Alice'), openRoom('bobs', 'bob', 'Bob')];
  const { element } = LobbyPage(context);
  const rows = element.querySelectorAll('[data-ref="rooms"] li');
  assert.equal(rows.length, 1);
  assert.ok(rows[0].textContent?.includes('Bob is waiting'));
  rows[0].querySelector('button')!.click();
  await settled();
  assert.deepEqual(context.sync.joined, ['bobs']);
  assert.deepEqual(context.visited, ['/game/bobs']);
});

test('opening a room shows the wait, and the game starts when a guest joins', async () => {
  const context = fakeContext();
  context.session.emit(alice);
  const { element } = LobbyPage(context);
  button(element, 'create').click();
  await settled();
  assert.equal((element.querySelector('[data-ref="waiting"]') as HTMLElement).hidden, false);
  context.sync.guestJoins('room-1');
  assert.deepEqual(context.visited, ['/game/room-1']);
});

test('cancelling closes the hosted room, and a failed close is shown', async () => {
  const context = fakeContext();
  context.session.emit(alice);
  const { element } = LobbyPage(context);
  button(element, 'create').click();
  await settled();
  context.sync.failWith = 'No network';
  button(element, 'cancel').click();
  await settled();
  assert.equal(text(element, 'hint'), 'No network');
  context.sync.failWith = null;
  button(element, 'create').click();
  await settled();
  button(element, 'cancel').click();
  await settled();
  assert.deepEqual(context.sync.closed, ['room-2']);
});

test('leaving the lobby with an open room deletes it', async () => {
  const context = fakeContext();
  context.session.emit(alice);
  const page = LobbyPage(context);
  button(page.element, 'create').click();
  await settled();
  page.dispose?.();
  await settled();
  assert.deepEqual(context.sync.closed, ['room-1']);
});
