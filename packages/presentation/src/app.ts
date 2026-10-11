// Makes Pixi work on a page whose security policy does not allow 'unsafe-eval'.
import 'pixi.js/unsafe-eval';
import { Application, type Container, type Ticker } from 'pixi.js';

export interface SurfaceOptions {
  width: number;
  height: number;
  /** The colour behind the drawing, or null for a see-through canvas. */
  background: number | null;
}

/** A canvas in the page with a Pixi application behind it. The scenes get the few operations they need and never reach into the application. */
export class Surface {
  private readonly _app: Application;

  constructor(app: Application) {
    this._app = app;
  }

  public get canvas(): HTMLCanvasElement {
    return this._app.canvas;
  }

  /** Drives the animations. A view adds a step function and removes it when the animation is done. */
  public get ticker(): Ticker {
    return this._app.ticker;
  }

  public get width(): number {
    return this._app.screen.width;
  }

  public get height(): number {
    return this._app.screen.height;
  }

  public add(...children: Container[]): void {
    this._app.stage.addChild(...children);
  }

  public resize(width: number, height: number): void {
    this._app.renderer.resize(width, height);
  }

  public setBackground(color: number): void {
    this._app.renderer.background.color = color;
  }

  public destroy(): void {
    this._app.destroy(true, { children: true });
  }
}

export async function createSurface(host: HTMLElement, options: SurfaceOptions): Promise<Surface> {
  const app = new Application();
  await app.init({
    width: options.width,
    height: options.height,
    ...(options.background === null ? { backgroundAlpha: 0 } : { backgroundColor: options.background }),
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  host.appendChild(app.canvas);
  return new Surface(app);
}
