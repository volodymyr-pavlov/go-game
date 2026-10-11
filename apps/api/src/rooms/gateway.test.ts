import { beforeEach, describe, expect, test } from 'vitest';
import { DurableRooms, MAX_OPEN_ROOMS } from './gateway.ts';
import { HttpError } from '../http.ts';
import type { Outcome } from './roomDo.ts';
import { RoomDb } from '../services/d1.ts';
import { createTestDb } from '../testing/d1.ts';

/** The Durable Object namespace, with rooms that answer as told. The real rooms are tried on a real Worker. */
function namespace(answer: Outcome, opened: string[]): DurableObjectNamespace {
  return {
    idFromName: (name: string) => name,
    get: (name: string) => ({ open: async () => (opened.push(name), answer) }),
  } as unknown as DurableObjectNamespace;
}

let db: RoomDb;
let opened: string[];

beforeEach(() => {
  db = new RoomDb(createTestDb());
  opened = [];
});

function gateway(answer: Outcome = { ok: true }): DurableRooms {
  return new DurableRooms(namespace(answer, opened) as never, db, () => 1000);
}

describe('DurableRooms.create', () => {
  test('opens the room and lists it', async () => {
    const id = await gateway().create('hana', 'Hana');
    expect(opened).toEqual([id]);
    expect(await gateway().listOpen()).toMatchObject([{ id, hostUid: 'hana' }]);
  });

  test('a player who already has an open room is refused, and no second room is opened', async () => {
    await gateway().create('hana', 'Hana');
    await expect(gateway().create('hana', 'Hana')).rejects.toMatchObject({ status: 409 });
    expect(opened).toHaveLength(1);
  });

  test('a room that its Durable Object refuses is taken back off the list', async () => {
    await expect(
      gateway({ ok: false, message: 'That room already exists' }).create('hana', 'Hana'),
    ).rejects.toBeInstanceOf(HttpError);
    expect(await gateway().listOpen()).toEqual([]);
  });

  test('no more than the most rooms are open at once', async () => {
    for (let i = 0; i < MAX_OPEN_ROOMS; i++) await db.add(`r${i}`, `host${i}`, 'H', 1000);
    await expect(gateway().create('late', 'Late')).rejects.toMatchObject({ status: 503 });
    expect(opened).toEqual([]);
  });
});
