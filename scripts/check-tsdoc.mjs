// typescript-eslint does not work with TypeScript 7 yet. So this script runs the TSDoc parser itself instead of using eslint-plugin-tsdoc.
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TSDocParser } from '@microsoft/tsdoc';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parser = new TSDocParser();
let errors = 0;

for await (const file of glob(
  ['apps/*/src/**/*.ts', 'packages/*/src/**/*.ts', 'apps/web/e2e/**/*.ts', 'apps/*/*.config.ts'],
  { cwd: root },
)) {
  const source = await readFile(join(root, file), 'utf8');
  for (const match of source.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
    const { log } = parser.parseString(match[0]);
    for (const message of log.messages) {
      const line = source.slice(0, match.index + message.textRange.pos).split('\n').length;
      console.error(`${file}:${line}: ${message.unformattedText} (${message.messageId})`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`${errors} TSDoc error${errors === 1 ? '' : 's'}`);
  process.exit(1);
}
