// The selected skin. A saved choice wins. Otherwise the classic board is used. Textures are loaded through the PixiJS Assets manifest. The page has one manager, made in main.ts, because the manifest can be set up only once.

import { Assets, type Texture } from 'pixi.js';
import { DEFAULT_SKIN, parseSkinId, skinById } from './SkinRegistry.ts';
import type { SkinConfig, SkinId, SkinTextures } from './SkinTypes.ts';
import { storedValue } from '@go-game/client/storage.ts';

const STORAGE_KEY = 'go-game.skin';
const MANIFEST_URL = 'skins/manifest.json';

export type LoadedTextures = Record<keyof SkinTextures, Texture>;

export type SkinListener = (skin: SkinConfig) => void;

/** The part of the manager that the selector needs: the current skin, a way to select one, and a way to follow changes. */
export interface SkinSelection {
  readonly current: SkinConfig;
  select(id: SkinId): void;
  onChange(listener: SkinListener): () => void;
}

/** What the board needs on top of the selection: the textures of the current skin. */
export interface Skins extends SkinSelection {
  textures(): Promise<LoadedTextures | null>;
}

export class SkinManager implements Skins {
  public current: SkinConfig;
  private readonly _stored = storedValue(STORAGE_KEY, parseSkinId);
  private readonly _listeners = new Set<SkinListener>();
  private _manifest: Promise<void> | null = null;

  constructor() {
    this.current = skinById(this._stored.read() ?? DEFAULT_SKIN.id);
    this._apply();
  }

  public select(id: SkinId): void {
    if (id === this.current.id) return;
    this.current = skinById(id);
    this._stored.write(this.current.id);
    this._apply();
    for (const listener of this._listeners) listener(this.current);
  }

  public onChange(listener: SkinListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** The textures of the current skin. Null when the skin has none or they fail to load. Then the board is drawn from colors. */
  public async textures(): Promise<LoadedTextures | null> {
    const skin = this.current;
    if (skin.textures === undefined) return null;
    try {
      this._manifest ??= Assets.init({ manifest: MANIFEST_URL });
      await this._manifest;
      const bundle: Partial<Record<keyof SkinTextures, Texture>> = await Assets.loadBundle(skin.id);
      const { board, stoneBlack, stoneWhite } = bundle;
      if (board === undefined || stoneBlack === undefined || stoneWhite === undefined) return null;
      return { board, stoneBlack, stoneWhite };
    } catch {
      return null;
    }
  }

  /** Marks the page with the skin: `data-skin` for the stylesheet, and custom properties for the page background. */
  private _apply(): void {
    const root = document.documentElement;
    root.dataset.skin = this.current.id;
    const { background } = this.current;
    // The URL is made absolute: a relative url() inside a custom property resolves against the stylesheet's folder
    // (.dist/assets/ in production), not against the page.
    const url = background === undefined ? 'none' : `url("${new URL(background.url, document.baseURI).href}")`;
    root.style.setProperty('--skin-background', url);
    root.style.setProperty('--skin-background-repeat', background?.repeat ? 'repeat' : 'no-repeat');
    root.style.setProperty('--skin-background-size', background?.repeat ? 'auto' : 'cover');
  }
}
