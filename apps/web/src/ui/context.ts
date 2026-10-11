import type { User } from '../firebase/auth.ts';
import type { Firebase } from '../firebase/services.ts';
import type { Skins } from '@go-game/presentation/skins/SkinManager.ts';

export interface AppContext {
  firebase: Firebase | null;
  user: User | null;
  skins: Skins;
  navigate(path: string): void;
}
