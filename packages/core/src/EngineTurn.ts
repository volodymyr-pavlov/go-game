import type { Engine, Suggestion } from './ports.ts';
import type { Position } from './rules.ts';

export class EngineTurn {
  private readonly _startEngine: () => Engine;
  private _engine: Engine | null = null;
  private _thinking = false;
  /** Grows by one each time old answers must be ignored, for example when a new game starts. */
  private _requestId = 0;

  constructor(startEngine: () => Engine) {
    this._startEngine = startEngine;
  }

  public get thinking(): boolean {
    return this._thinking;
  }

  /** Returns `null` when the answer is not needed any more. When the engine fails, it is dropped, and the next call starts a new one. */
  public async ask(position: Position, playouts: number): Promise<Suggestion | null> {
    const id = ++this._requestId;
    this._thinking = true;
    try {
      const suggestion = await this._engineReady().suggestMove(position, playouts);
      return id === this._requestId ? suggestion : null;
    } catch (error) {
      if (id !== this._requestId) return null;
      this._dropEngine();
      throw error;
    } finally {
      if (id === this._requestId) this._thinking = false;
    }
  }

  public cancel(): void {
    this._requestId++;
    this._thinking = false;
  }

  public dispose(): void {
    this.cancel();
    this._dropEngine();
  }

  private _dropEngine(): void {
    this._engine?.dispose();
    this._engine = null;
  }

  /** The engine loads the first time it is needed. A game between two people never loads it. */
  private _engineReady(): Engine {
    this._engine ??= this._startEngine();
    return this._engine;
  }
}
