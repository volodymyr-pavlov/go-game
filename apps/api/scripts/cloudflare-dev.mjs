// Runs the game server in development, from apps/api, with the values it needs from the .env in the repository root, next to the ones of the page.
// wrangler reads the Worker's variables from a file next to its config, not from this one, and this file also holds
// values that are only for the page. So this script passes on the few that are for the server.
import { spawn } from 'node:child_process';

const SERVER_VARIABLES = ['DEV_AUTH', 'TURNSTILE_SECRET', 'TURN_TIMEOUT_MS'];

try {
  process.loadEnvFile('../../.env');
} catch {
  // Without a .env the server starts with none of them, and only a token of Firebase works.
}

const args = ['wrangler', 'dev', '--config', 'wrangler.jsonc'];
for (const name of SERVER_VARIABLES) {
  const value = process.env[name];
  if (value) args.push('--var', `${name}:${value}`);
}
spawn('npx', args, { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 1));
