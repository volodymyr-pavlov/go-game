import { Container, Graphics } from 'pixi.js';
import { BLACK, cellAt, type Board, type Point, type Stone } from '@go-game/core/board.ts';
import type { SkinColors } from '../skins/SkinTypes.ts';
import type { Geometry } from './Geometry.ts';

const HOVER_RADIUS = 0.42; // of a cell
const HOVER_ALPHA = 0.35;
const LAST_MOVE_RADIUS = 0.2;
const LAST_MOVE_LINE_WIDTH = 2;
const LAST_MOVE_ALPHA = 0.9;

/** The marks over the stones: the ghost stone under the pointer and the ring on the last move. */
export class OverlayView {
  public readonly overlay = new Container();
  private readonly _hover = new Graphics();
  private readonly _lastMove = new Graphics();
  private _geometry: Geometry;
  private _colors: SkinColors;

  constructor(geometry: Geometry, colors: SkinColors) {
    this._geometry = geometry;
    this._colors = colors;
    this.overlay.addChild(this._hover, this._lastMove);
  }

  /** The board was resized or the skin changed. The marks are drawn with the new values from the next show on. */
  public relayout(geometry: Geometry, colors: SkinColors): void {
    this._geometry = geometry;
    this._colors = colors;
  }

  public showHover(point: Point | null, stone: Stone): void {
    this._hover.clear();
    if (point === null) return;
    const { x, y } = this._geometry.pixelOf(point);
    const color = stone === BLACK ? this._colors.hoverBlack : this._colors.hoverWhite;
    this._hover.circle(x, y, this._geometry.cellSize * HOVER_RADIUS).fill({ color, alpha: HOVER_ALPHA });
  }

  public showLastMove(board: Board, point: Point | null): void {
    this._lastMove.clear();
    if (point === null) return;
    const { x, y } = this._geometry.pixelOf(point);
    const color = cellAt(board, point) === BLACK ? this._colors.markerOnBlack : this._colors.markerOnWhite;
    this._lastMove
      .circle(x, y, this._geometry.cellSize * LAST_MOVE_RADIUS)
      .stroke({ width: LAST_MOVE_LINE_WIDTH, color, alpha: LAST_MOVE_ALPHA });
  }
}
