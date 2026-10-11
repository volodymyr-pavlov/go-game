import { beforeEach, describe, expect, test } from 'vitest';
import { HostHasRoomError, OPEN_ROOM_MAX_AGE_MS, RoomDb } from './d1.ts';
import { createTestDb } from '../testing/d1.ts';

let rooms: RoomDb;

beforeEach(() => {
  rooms = new RoomDb(createTestDb());
});

describe('RoomDb', () => {
  test('lists the newest rooms first, with the uid of the host', async () => {
    await rooms.add('a', 'hana', 'Hana', 100);
    await rooms.add('b', 'gus', 'Gus', 200);
    expect(await rooms.open(10, 300)).toEqual([
      { id: 'b', hostUid: 'gus', hostName: 'Gus', createdAt: 200 },
      { id: 'a', hostUid: 'hana', hostName: 'Hana', createdAt: 100 },
    ]);
    expect(await rooms.open(1, 300)).toHaveLength(1);
  });

  test('a player has one open room, and can open another after the first is gone', async () => {
    await rooms.add('a', 'hana', 'Hana', 100);
    await expect(rooms.add('b', 'hana', 'Hana', 101)).rejects.toThrow(HostHasRoomError);
    await rooms.remove('a');
    await rooms.add('b', 'hana', 'Hana', 102);
    expect(await rooms.countOpen(102)).toBe(1);
  });

  test('a room that nobody joined for too long is gone from the list, and its host can open a new one', async () => {
    await rooms.add('a', 'hana', 'Hana', 100);
    const later = 100 + OPEN_ROOM_MAX_AGE_MS + 1;
    expect(await rooms.open(10, later)).toEqual([]);
    await rooms.add('b', 'hana', 'Hana', later);
    expect(await rooms.countOpen(later)).toBe(1);
  });
});
