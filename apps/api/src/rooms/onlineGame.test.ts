import { describe, expect, test } from 'vitest';
import { BLACK, WHITE } from '@go-game/core/board.ts';
import { OnlineGame, RoomError, TURN_TIMEOUT_MS } from './onlineGame.ts';
import { ResultKind } from '@go-game/core/game.ts';
import { RoomStatus } from '@go-game/types/protocol.ts';

function startedGame(): OnlineGame {
  const game = OnlineGame.open('host', 'Hana', 1);
  game.join('guest', 'Gus', 0);
  return game;
}

describe('joining', () => {
  test('a room is open until a guest joins, then the game is played', () => {
    const game = OnlineGame.open('host', 'Hana', 1);
    expect(game.status).toBe(RoomStatus.OPEN);
    game.join('guest', 'Gus', 0);
    expect(game.status).toBe(RoomStatus.PLAYING);
    expect(game.view).toMatchObject({ host: 'host', guest: 'guest', guestName: 'Gus', status: RoomStatus.PLAYING });
  });

  test('the host cannot join their own room, and a second guest cannot join', () => {
    const game = OnlineGame.open('host', 'Hana', 1);
    expect(() => game.join('host', 'Hana', 0)).toThrow('You opened this room');
    game.join('guest', 'Gus', 0);
    expect(() => game.join('late', 'Lu', 0)).toThrow('That room is no longer open');
  });
});

describe('moves', () => {
  test('the host plays Black first, then the guest plays White', () => {
    const game = startedGame();
    game.play('host', 0, { x: 4, y: 4 }, 0);
    game.play('guest', 1, { x: 3, y: 3 }, 0);
    expect(game.record.moves.map((move) => move.by)).toEqual(['host', 'guest']);
    expect(game.stoneOf('host')).toBe(BLACK);
    expect(game.stoneOf('guest')).toBe(WHITE);
  });

  test('a player cannot move out of turn, twice, or on a taken point', () => {
    const game = startedGame();
    expect(() => game.play('guest', 0, { x: 0, y: 0 }, 0)).toThrow('It is not your turn');
    game.play('host', 0, { x: 4, y: 4 }, 0);
    expect(() => game.play('host', 1, { x: 0, y: 0 }, 0)).toThrow('It is not your turn');
    expect(() => game.play('guest', 0, { x: 0, y: 0 }, 0)).toThrow('The game has moved on');
    expect(() => game.play('guest', 1, { x: 4, y: 4 }, 0)).toThrow('That point is taken');
    expect(game.record.moves).toHaveLength(1);
  });

  test('a stranger cannot play, and nobody plays before a guest has joined', () => {
    const game = startedGame();
    expect(() => game.play('stranger', 0, { x: 0, y: 0 }, 0)).toThrow(RoomError);
    expect(() => OnlineGame.open('host', 'Hana', 1).play('host', 0, { x: 0, y: 0 }, 0)).toThrow('not being played');
  });

  test('two passes end the game by score', () => {
    const game = startedGame();
    game.play('host', 0, { x: 4, y: 4 }, 0);
    game.play('guest', 1, null, 0);
    game.play('host', 2, null, 0);
    expect(game.status).toBe(RoomStatus.FINISHED);
    expect(game.result).toMatchObject({ kind: ResultKind.SCORE, winner: BLACK });
    expect(() => game.play('guest', 3, { x: 0, y: 0 }, 0)).toThrow('not being played');
  });
});

describe('resigning', () => {
  test('a player can resign on the other player’s turn, and the other one wins', () => {
    const game = startedGame();
    game.resign('guest');
    expect(game.status).toBe(RoomStatus.FINISHED);
    expect(game.result).toMatchObject({ kind: ResultKind.RESIGNATION, winner: BLACK, resigned: WHITE });
    expect(game.view.resignedBy).toBe('guest');
  });

  test('nobody resigns a room that is still open', () => {
    expect(() => OnlineGame.open('host', 'Hana', 1).resign('host')).toThrow('not being played');
  });
});

describe('a saved game', () => {
  test('comes back the same from its record, moves and resignation included', () => {
    const game = startedGame();
    game.play('host', 0, { x: 4, y: 4 }, 0);
    game.play('guest', 1, null, 0);
    game.resign('host');
    const restored = new OnlineGame(game.record);
    expect(restored.view).toEqual(game.view);
    expect(restored.result).toMatchObject({ kind: ResultKind.RESIGNATION, winner: WHITE });
  });
});

describe('the time for a move', () => {
  test('is counted from the last move, and runs out for the player whose turn it is', () => {
    const game = startedGame();
    expect(game.deadline).toBe(TURN_TIMEOUT_MS);
    game.play('host', 0, { x: 4, y: 4 }, 1000);
    expect(game.deadline).toBe(1000 + TURN_TIMEOUT_MS);
    expect(game.expire(1000 + TURN_TIMEOUT_MS - 1)).toBe(false);
    expect(game.status).toBe(RoomStatus.PLAYING);

    expect(game.expire(1000 + TURN_TIMEOUT_MS)).toBe(true);
    expect(game.status).toBe(RoomStatus.FINISHED);
    expect(game.result).toMatchObject({ kind: ResultKind.TIMEOUT, winner: BLACK, timedOut: WHITE });
    expect(game.view.timedOutBy).toBe('guest');
    expect(game.deadline).toBeNull();
  });

  test('does not run in a room that is open or a game that is over', () => {
    expect(OnlineGame.open('host', 'Hana', 5).deadline).toBeNull();
    const game = startedGame();
    game.resign('host');
    expect(game.expire(TURN_TIMEOUT_MS * 10)).toBe(false);
    expect(game.result).toMatchObject({ kind: ResultKind.RESIGNATION });
  });

  test('is longer or shorter when the game is made so, and a game lost on time comes back the same', () => {
    const game = OnlineGame.open('host', 'Hana', 0, 2000);
    game.join('guest', 'Gus', 0);
    expect(game.deadline).toBe(2000);
    expect(game.expire(2000)).toBe(true);
    const restored = new OnlineGame(game.record, 2000);
    expect(restored.view).toEqual(game.view);
    expect(restored.result).toMatchObject({ kind: ResultKind.TIMEOUT, winner: WHITE, timedOut: BLACK });
  });
});
