import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Point } from '@go-game/core/board.ts';
import type { SkinColors } from '../skins/SkinTypes.ts';
import type { Geometry } from './Geometry.ts';

const STAR_RADIUS = 0.09;
const STAR_ALPHA = 0.9;
const GRAIN_STEP_PX = 8;
const GRAIN_SLANT_PX = 15;
const GRAIN_ALPHA = 0.25;
const LINE_WIDTH = 2;
const LINE_ALPHA = 0.85;

/** The star points (hoshi) for each board size. A size that is not in the list has no star points. */
const STAR_POINTS: Record<number, Point[]> = {
  9: [
    { x: 2, y: 2 },
    { x: 2, y: 6 },
    { x: 4, y: 4 },
    { x: 6, y: 2 },
    { x: 6, y: 6 },
  ],
};

/** The board background. It is a picture from the skin, scaled to the board, or wood drawn from the skin colors. The grid goes on top. */
export class BoardView {
  public readonly container = new Container();
  private readonly _picture = new Sprite();
  private readonly _graphics = new Graphics();

  constructor() {
    this.container.addChild(this._picture, this._graphics);
  }

  public layout(geometry: Geometry, colors: SkinColors, texture: Texture | null): void {
    this._picture.visible = texture !== null;
    if (texture !== null) {
      this._picture.texture = texture;
      this._picture.setSize(geometry.width, geometry.width);
    }
    if (texture === null) drawGoban(this._graphics, geometry, colors);
    else drawGrid(this._graphics, geometry, colors);
  }
}

/** A whole board drawn from colors: the wood, then the grid. */
export function drawGoban(graphics: Graphics, geometry: Geometry, colors: SkinColors): void {
  graphics.clear();
  drawWood(graphics, geometry, colors);
  drawLines(graphics, geometry, colors);
  drawStars(graphics, geometry, STAR_POINTS[geometry.size] ?? [], colors);
}

/** The lines and star points alone, for a board whose wood is a picture. */
export function drawGrid(graphics: Graphics, geometry: Geometry, colors: SkinColors): void {
  graphics.clear();
  drawLines(graphics, geometry, colors);
  drawStars(graphics, geometry, STAR_POINTS[geometry.size] ?? [], colors);
}

function drawWood(graphics: Graphics, { width }: Geometry, colors: SkinColors): void {
  graphics.rect(0, 0, width, width).fill(colors.wood);
  for (let i = 0; i < width; i += GRAIN_STEP_PX) {
    graphics.moveTo(i, 0).lineTo(i + GRAIN_SLANT_PX, width);
  }
  graphics.stroke({ width: 1, color: colors.grain, alpha: GRAIN_ALPHA });
}

function drawLines(graphics: Graphics, { size, width, padding, cellSize }: Geometry, colors: SkinColors): void {
  const first = padding;
  const last = width - padding;
  for (let i = 0; i < size; i++) {
    const at = first + i * cellSize;
    graphics.moveTo(at, first).lineTo(at, last);
    graphics.moveTo(first, at).lineTo(last, at);
  }
  graphics.stroke({ width: LINE_WIDTH, color: colors.line, alpha: LINE_ALPHA });
}

function drawStars(graphics: Graphics, geometry: Geometry, stars: Point[], colors: SkinColors): void {
  for (const star of stars) {
    const { x, y } = geometry.pixelOf(star);
    graphics.circle(x, y, geometry.cellSize * STAR_RADIUS).fill({ color: colors.line, alpha: STAR_ALPHA });
  }
}
