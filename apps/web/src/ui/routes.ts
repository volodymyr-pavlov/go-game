// The hash paths of the pages. The router matches them, and the pages and the navbar link to them.

const GAME = '/game';

export const routes = {
  start: '/',
  play: '/play',
  lobby: '/lobby',
  /** The pattern of an online game's page. `gameRoute` fills in the room. */
  game: `${GAME}/:room`,
  nickname: '/nickname',
  leaderboard: '/leaderboard',
  profile: '/profile',
} as const;

export function gameRoute(roomId: string): string {
  return `${GAME}/${roomId}`;
}

export function isGameRoute(path: string): boolean {
  return path.startsWith(`${GAME}/`);
}

/** The href of a link to a page: the path behind the hash. */
export function hrefOf(path: string): string {
  return `#${path}`;
}
