import { beforeEach, describe, expect, test } from 'vitest';
import { ratingDelta } from '@go-game/core/elo.ts';
import { OnlineGame } from './onlineGame.ts';
import { PlayerDb } from '../services/d1.ts';
import { recordOnlineGame } from './results.ts';
import { createTestDb } from '../testing/d1.ts';
import { ResultKind } from '@go-game/core/game.ts';

let players: PlayerDb;

beforeEach(() => {
  players = new PlayerDb(createTestDb());
});

function resignedGame(): OnlineGame {
  const game = OnlineGame.open('host', 'Hana', 1);
  game.join('guest', 'Gus', 0);
  game.resign('guest');
  return game;
}

describe('recordOnlineGame', () => {
  test('both players get the result, with ratings the server worked out', async () => {
    await players.claimNickname('host', 'Hana', 'hana', 1);
    await players.claimNickname('guest', 'Gus', 'gus', 1);
    await recordOnlineGame(players, resignedGame(), 100);

    const gain = ratingDelta(1000, 1000, true);
    expect(await players.find('host')).toEqual({ name: 'Hana', rating: 1000 + gain, wins: 1, losses: 0 });
    expect(await players.find('guest')).toEqual({ name: 'Gus', rating: 1000 - gain, wins: 0, losses: 1 });
    expect(await players.history('host', 5)).toMatchObject([
      { opponent: 'guest', opponentName: 'Gus', won: true, kind: ResultKind.RESIGNATION, ratingBefore: 1000 },
    ]);
  });

  test('a game lost on time counts as a loss for the player to move, who did not move', async () => {
    await players.claimNickname('host', 'Hana', 'hana', 1);
    await players.claimNickname('guest', 'Gus', 'gus', 1);
    const game = OnlineGame.open('host', 'Hana', 0, 1000);
    game.join('guest', 'Gus', 0);
    game.expire(1000);
    await recordOnlineGame(players, game, 100);
    expect(await players.find('host')).toMatchObject({ wins: 0, losses: 1 });
    expect(await players.history('guest', 1)).toMatchObject([{ won: true, kind: ResultKind.TIMEOUT }]);
  });

  test('a player without a nickname is not saved, and counts as a new player for the other one', async () => {
    await players.claimNickname('host', 'Hana', 'hana', 1);
    await recordOnlineGame(players, resignedGame(), 100);
    expect(await players.find('guest')).toBeNull();
    expect(await players.find('host')).toMatchObject({ wins: 1 });
  });

  test('a game that is not finished saves nothing', async () => {
    await players.claimNickname('host', 'Hana', 'hana', 1);
    const game = OnlineGame.open('host', 'Hana', 1);
    game.join('guest', 'Gus', 0);
    await recordOnlineGame(players, game, 100);
    expect(await players.find('host')).toMatchObject({ wins: 0, losses: 0 });
  });
});
