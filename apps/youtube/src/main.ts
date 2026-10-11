import { BLACK } from '@go-game/core/board.ts';
import { colourName } from '@go-game/core/notation.ts';
import type { StatusModel } from '@go-game/core/ports.ts';
import { ResultKind } from '@go-game/types/game.ts';
import { mountEngineGame } from '@go-game/presentation/engineGame.ts';
import { markReady, onLifecycle, sendScore } from './sdk/playables.ts';
import { onTap, showStatus } from './ui/overlay.ts';

// The YouTube Playable: the same game against the engine, in the frame YouTube gives it. It plays on a phone, a TV and
// a computer, so every control is a big button and the board takes what it can.

let status: StatusModel | null = null;
let thinking = false;
let ended = '';
let paused = false;

const game = await mountEngineGame(document.getElementById('board')!, {
  onStatus: (next) => {
    status = next;
    showStatus(status, thinking, ended);
  },
  onThinking: (opponent) => {
    thinking = opponent !== null;
    showStatus(status, thinking, ended);
  },
  onResult: (result, score) => {
    ended = `${colourName(result.winner)} wins`;
    showStatus(status, thinking, ended);
    // The player is Black. The score is how far ahead they finished, and a loss scores nothing.
    if (result.winner === BLACK)
      sendScore(result.kind === ResultKind.SCORE ? score.black.total - score.white.total : 1);
  },
  onResultClosed: () => {
    ended = '';
    showStatus(status, thinking, ended);
  },
});

onTap('pass', () => !paused && game.pass());
onTap('resign', () => !paused && game.resign());
onTap('new', () => !paused && game.newGame());
onLifecycle(
  () => (paused = true),
  () => (paused = false),
);
markReady();
