import confetti from 'canvas-confetti';
import { BLACK, WHITE, type Stone } from '@go-game/core/board.ts';
import type { Result } from '@go-game/core/game.ts';
import { colourName } from '@go-game/core/notation.ts';
import type { ResultPort } from '@go-game/core/ports.ts';
import { KOMI, type Score, type SideScore } from '@go-game/core/scoring.ts';
import { byIdIn, hide, show } from '../dom.ts';
import { finalScoreIds, ids } from '../ids.ts';
import { resultReason } from './format.ts';

const CONFETTI = { particleCount: 90, spread: 80, origin: { y: 0.6 } };

export class ResultModal implements ResultPort {
  private readonly _root: ParentNode;

  /** `root` is the game page. The komi is written into the markup here, so the rules text and the score sheet agree with the scoring module. */
  constructor(root: ParentNode) {
    this._root = root;
    for (const cell of root.querySelectorAll('[data-komi]')) cell.textContent = String(KOMI);
  }

  public show(result: Result, score: Score): void {
    byIdIn(this._root, ids.winnerTitle).textContent = `${colourName(result.winner)} wins!`;
    byIdIn(this._root, ids.winnerReason).textContent = resultReason(result, score);
    renderSide(this._root, BLACK, score.black);
    renderSide(this._root, WHITE, score.white);
    show(byIdIn(this._root, ids.gameOverModal));
    void confetti(CONFETTI);
  }

  public hide(): void {
    hide(byIdIn(this._root, ids.gameOverModal));
  }
}

function renderSide(root: ParentNode, stone: Stone, score: SideScore): void {
  const cells = finalScoreIds(stone);
  byIdIn(root, cells.total).textContent = `${score.total} pts`;
  byIdIn(root, cells.stones).textContent = String(score.stones);
  byIdIn(root, cells.territory).textContent = String(score.territory);
}
