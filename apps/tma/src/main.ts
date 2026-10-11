import { BLACK } from '@go-game/core/board.ts';
import { colourName } from '@go-game/core/notation.ts';
import { mountEngineGame } from '@go-game/presentation/engineGame.ts';
import { backButton, buzz, startMiniApp, tap } from './sdk/telegram.ts';
import { onTap, showMessage, showStatus } from './ui/overlay.ts';

// The Telegram Mini App: the same game against the engine, with Telegram's own feel. It has no leaderboard yet, and it
// does not call the game server, but `gameServer()` in sdk/telegram.ts is ready for the day it does.

startMiniApp();

let thinking = false;
const game = await mountEngineGame(document.getElementById('board')!, {
  onStatus: (status) => showStatus(status, thinking),
  onThinking: (opponent) => {
    thinking = opponent !== null;
    const line = document.getElementById('status');
    if (line !== null && thinking) line.textContent = 'Thinking…';
  },
  onMessage: showMessage,
  onStone: tap,
  onResult: (result) => {
    showMessage(`${colourName(result.winner)} wins`);
    buzz(result.winner === BLACK);
  },
  onResultClosed: () => showMessage(''),
});

onTap('pass', () => game.pass());
onTap('resign', () => game.resign());
onTap('new', () => game.newGame());
backButton(false, () => undefined);
