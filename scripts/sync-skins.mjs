// The skins (the board, the stones and the manifest that lists them) live in the public folder of the web app. The other
// apps that draw the board need the same files. `node scripts/sync-skins.mjs <app>` copies them into that app. It runs
// before the dev server and the build of the app, and only touches the folder of the app it is given, so two builds can
// run at the same time.
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = process.argv[2];
if (!app) throw new Error('Say which app: node scripts/sync-skins.mjs tma');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'apps', app, 'public/skins');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(join(root, 'apps/web/public/skins'), target, { recursive: true });
