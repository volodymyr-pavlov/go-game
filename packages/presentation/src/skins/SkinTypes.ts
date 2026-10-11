export type SkinId = 'classic';

/** The colors of the board, the stones and the overlays. A skin with no textures is drawn from these colors only. */
export interface SkinColors {
  wood: number;
  grain: number;
  line: number;
  blackStone: number;
  blackShine: number;
  whiteStone: number;
  whiteRim: number;
  whiteShine: number;
  hoverBlack: number;
  hoverWhite: number;
  markerOnBlack: number;
  markerOnWhite: number;
}

/** The URLs of the images, relative to the page, the same as in public/skins/manifest.json. */
export interface SkinTextures {
  board: string;
  stoneBlack: string;
  stoneWhite: string;
}

export interface SkinConfig {
  id: SkinId;
  name: string;
  description: string;
  colors: SkinColors;
  textures?: SkinTextures;
  /** The URL of the sound for placing a stone, relative to the page. Without one, a tone is made in code. */
  sound?: string;
  /** A picture behind the whole page while this skin is active. */
  background?: SkinBackground;
  /** Portraits of the engine opponents, by name (Gopher, Bear, Elephant). They are shown under the board. Without them no portrait is shown. */
  avatars?: Readonly<Record<string, string>>;
}

/** The page background: the URL of the picture, relative to the page. It is either repeated at its own size or stretched to fill the window. */
export interface SkinBackground {
  url: string;
  repeat: boolean;
}
