// Where the points of the board are on the canvas. This module has no PixiJS in it, so the end-to-end tests can use the same numbers to click the board.

import type { Point } from '@go-game/core/board.ts';

/** The space between the edge of the board and the first line, as a share of the board width. */
export const PADDING_RATIO = 0.08;

/** A place on the canvas, in CSS pixels from its top left corner. */
export interface Pixel {
  x: number;
  y: number;
}

export class Geometry {
  public readonly size: number;
  public readonly width: number;
  public readonly padding: number;
  public readonly cellSize: number;

  constructor(size: number, width: number) {
    this.size = size;
    this.width = width;
    this.padding = width * PADDING_RATIO;
    this.cellSize = (width - this.padding * 2) / (size - 1);
  }

  public pixelOf(point: Point): Pixel {
    return { x: this.padding + point.x * this.cellSize, y: this.padding + point.y * this.cellSize };
  }

  public pointAt(px: number, py: number): Point | null {
    const point = {
      x: Math.round((px - this.padding) / this.cellSize),
      y: Math.round((py - this.padding) / this.cellSize),
    };
    const inside = point.x >= 0 && point.x < this.size && point.y >= 0 && point.y < this.size;
    return inside ? point : null;
  }
}
