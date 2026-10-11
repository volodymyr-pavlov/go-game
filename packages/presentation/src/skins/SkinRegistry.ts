import type { SkinConfig, SkinId } from './SkinTypes.ts';

const classic: SkinConfig = {
  id: 'classic',
  name: 'Classic Wood',
  description: 'A warm wooden board with slate and shell stones, on a page with pale wood grain.',
  background: { url: 'skins/classic/wood.jpg', repeat: true },
  avatars: {
    Gopher: 'skins/classic/opponents/gopher.png',
    Bear: 'skins/classic/opponents/bear.png',
    Elephant: 'skins/classic/opponents/elephant.png',
  },
  colors: {
    wood: 0xf7e8d2,
    grain: 0xead6b8,
    line: 0x6b4f37,
    blackStone: 0x111827,
    blackShine: 0x4b5563,
    whiteStone: 0xf8fafc,
    whiteRim: 0xcbd5e1,
    whiteShine: 0xffffff,
    hoverBlack: 0x000000,
    hoverWhite: 0xffffff,
    markerOnBlack: 0xf59e0b,
    markerOnWhite: 0xd97706,
  },
};

/** The skins the player can pick. With only one skin the skin button is hidden. Add a second one and the picker comes back. */
export const SKINS: readonly SkinConfig[] = [classic];

export const DEFAULT_SKIN: SkinConfig = classic;

export function skinById(id: SkinId): SkinConfig {
  return SKINS.find((skin) => skin.id === id) ?? DEFAULT_SKIN;
}

export function parseSkinId(value: string | null): SkinId | null {
  return SKINS.find((skin) => skin.id === value)?.id ?? null;
}
