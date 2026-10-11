import { BLACK } from '@go-game/core/board.ts';
import { INITIAL_RATING, ratingDelta } from '@go-game/core/elo.ts';
import type { OnlineGame } from './onlineGame.ts';
import type { ResultKind } from '@go-game/core/game.ts';
import type { PlayerDb } from '../services/d1.ts';

const ATTEMPTS = 3;

/**
 * Saves a finished online game for both players, with ratings the server works out from its own records. A player
 * without a nickname has no entry, so nothing is saved for them, and they count as a new player for the other one.
 */
export async function recordOnlineGame(players: PlayerDb, game: OnlineGame, now: number): Promise<void> {
  const result = game.result;
  if (result === null) return;
  const { host, hostName, guest, guestName } = game.record;
  if (guest === null) return;

  const [hostEntry, guestEntry] = await Promise.all([players.find(host), players.find(guest)]);
  const hostRating = hostEntry?.rating ?? INITIAL_RATING;
  const guestRating = guestEntry?.rating ?? INITIAL_RATING;
  const hostWon = result.winner === BLACK;

  const saves: Promise<void>[] = [];
  if (hostEntry !== null) {
    saves.push(
      saveFor(
        players,
        host,
        { opponent: guest, opponentName: guestName ?? 'Guest', opponentRating: guestRating },
        hostWon,
        result.kind,
        now,
      ),
    );
  }
  if (guestEntry !== null) {
    saves.push(
      saveFor(
        players,
        guest,
        { opponent: host, opponentName: hostName, opponentRating: hostRating },
        !hostWon,
        result.kind,
        now,
      ),
    );
  }
  await Promise.all(saves);
}

interface Opponent {
  opponent: string;
  opponentName: string;
  opponentRating: number;
}

/** Another result can land between the read and the write. Then the rating is read again. */
async function saveFor(
  players: PlayerDb,
  uid: string,
  { opponent, opponentName, opponentRating }: Opponent,
  won: boolean,
  kind: ResultKind,
  now: number,
): Promise<void> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const ratingBefore = (await players.find(uid))?.rating;
    if (ratingBefore === undefined) return;
    const ratingAfter = ratingBefore + ratingDelta(ratingBefore, opponentRating, won);
    if (await players.saveGame(uid, { opponent, opponentName, won, kind, ratingBefore, ratingAfter }, now)) return;
  }
  throw new Error(`The result of ${uid} could not be saved`);
}
