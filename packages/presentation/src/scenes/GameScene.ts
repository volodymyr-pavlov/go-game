import { Container } from 'pixi.js';
import { EMPTY, allPoints, cellAt, type Board, type Point, type Stone } from '@go-game/core/board.ts';
import type { ScenePort } from '@go-game/core/ports.ts';
import { OverlayView } from '../views/OverlayView.ts';
import { StoneView, type StoneLook } from '../views/StoneView.ts';
import { BoardView } from '../views/BoardView.ts';
import { Geometry } from '../views/Geometry.ts';
import { createSurface, type Surface } from '../app.ts';
import type { Skins } from '../skins/SkinManager.ts';
import type { SkinConfig } from '../skins/SkinTypes.ts';

const PRIMARY_BUTTON = 0;

export interface PointerEvents {
  onHover(point: Point | null): void;
  onSelect(point: Point): void;
}

export class GameScene implements ScenePort {
  private readonly _surface: Surface;
  private _resizeObserver: ResizeObserver | null = null;
  private readonly _skins: Skins;
  private _stopFollowingSkin: (() => void) | null = null;
  /** Counts skin changes. Textures that arrive for a skin that is no longer selected are ignored. */
  private _skinRequest = 0;
  private _look: StoneLook;
  private readonly _boardView = new BoardView();
  private readonly _stones = new Container();
  private readonly _highlights: OverlayView;
  private readonly _sprites = new Map<number, StoneView>();
  private _geometry: Geometry;
  /** The board as it was last rendered, so a resize or a new skin can draw it again. */
  private _shownBoard: Board | null = null;
  private _lastMove: Point | null = null;

  private constructor(surface: Surface, size: number, skins: Skins, look: StoneLook) {
    this._surface = surface;
    this._geometry = new Geometry(size, 0);
    this._skins = skins;
    this._look = look;
    this._highlights = new OverlayView(this._geometry, look.colors);
    this._surface.add(this._boardView.container, this._stones, this._highlights.overlay);
  }

  /** `host` must be in the document: the board takes its size from it. */
  public static async mount(host: HTMLElement, size: number, events: PointerEvents, skins: Skins): Promise<GameScene> {
    const { colors } = skins.current;
    const side = sideOf(host);
    const surface = await createSurface(host, { width: side, height: side, background: colors.wood });
    const scene = new GameScene(surface, size, skins, { colors, textures: await skins.textures() });
    scene._listenToPointer(events);
    scene._followHostWidth(host);
    scene._followSkin();
    return scene;
  }

  public render(board: Board, lastMove: Point | null): void {
    this._shownBoard = board;
    this._lastMove = lastMove;
    for (const point of allPoints(board)) {
      const key = this._keyOf(point);
      const cell = cellAt(board, point);
      const shown = this._sprites.get(key);
      if (shown !== undefined && shown.stone !== cell) this._removeStone(key, shown);
      if (cell !== EMPTY && shown?.stone !== cell) this._addStone(point, cell);
    }
    this._highlights.showLastMove(board, lastMove);
  }

  public showHover(point: Point | null, stone: Stone): void {
    this._highlights.showHover(point, stone);
  }

  public destroy(): void {
    this._stopFollowingSkin?.();
    this._resizeObserver?.disconnect();
    this._surface.destroy();
  }

  private _followSkin(): void {
    this._stopFollowingSkin = this._skins.onChange((skin) => void this._applySkin(skin));
  }

  private async _applySkin(skin: SkinConfig): Promise<void> {
    const request = ++this._skinRequest;
    const textures = await this._skins.textures();
    if (request !== this._skinRequest) return;
    this._look = { colors: skin.colors, textures };
    this._surface.setBackground(skin.colors.wood);
    this._redraw();
  }

  private _listenToPointer(events: PointerEvents): void {
    const canvas = this._surface.canvas;
    canvas.addEventListener('pointermove', (e) => events.onHover(this._pointAt(e)));
    canvas.addEventListener('pointerleave', () => events.onHover(null));
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== PRIMARY_BUTTON) return;
      const point = this._pointAt(e);
      if (point !== null) events.onSelect(point);
    });
  }

  private _followHostWidth(host: HTMLElement): void {
    this._fitTo(host);
    this._resizeObserver = new ResizeObserver(() => this._fitTo(host));
    this._resizeObserver.observe(host);
  }

  /** The board is a square that fits the host on both axes, so a short window cannot cut off its bottom rows. */
  private _fitTo(host: HTMLElement): void {
    const side = sideOf(host);
    if (side === 0) return;
    this._surface.resize(side, side);
    this._geometry = new Geometry(this._geometry.size, side);
    this._redraw();
  }

  /** Draws the board, the stones and the overlays again after the size or the skin has changed. */
  private _redraw(): void {
    const { colors, textures } = this._look;
    this._boardView.layout(this._geometry, colors, textures?.board ?? null);
    this._highlights.relayout(this._geometry, colors);
    for (const [key, sprite] of this._sprites) this._place(sprite, this._pointOf(key));
    if (this._shownBoard !== null) this._highlights.showLastMove(this._shownBoard, this._lastMove);
  }

  private _addStone(point: Point, stone: Stone): void {
    const key = this._keyOf(point);
    const sprite = new StoneView(stone, this._surface.ticker);
    this._place(sprite, point);
    this._stones.addChild(sprite.display);
    this._sprites.set(key, sprite);
    sprite.popIn();
  }

  private _removeStone(key: number, sprite: StoneView): void {
    this._sprites.delete(key);
    sprite.popOut();
  }

  private _place(sprite: StoneView, point: Point): void {
    sprite.layout(this._geometry.pixelOf(point), this._geometry.cellSize, this._look);
  }

  private _keyOf({ x, y }: Point): number {
    return x * this._geometry.size + y;
  }

  private _pointOf(key: number): Point {
    const { size } = this._geometry;
    return { x: Math.floor(key / size), y: key % size };
  }

  private _pointAt(event: PointerEvent): Point | null {
    const rect = this._surface.canvas.getBoundingClientRect();
    return this._geometry.pointAt(event.clientX - rect.left, event.clientY - rect.top);
  }
}

/** The board is a square that fits the host on both axes. */
function sideOf(host: HTMLElement): number {
  return Math.min(host.clientWidth, host.clientHeight || host.clientWidth);
}
