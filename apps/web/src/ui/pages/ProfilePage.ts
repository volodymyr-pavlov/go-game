import type { PlayedGame, Player } from '@go-game/client/leaderboard.ts';
import { resultKindName } from '../components/format.ts';
import { messageOf } from '@go-game/core/errors.ts';
import type { AppContext } from '../context.ts';
import { classes, element, link, markup, ref } from '../dom.ts';
import type { Page } from '../Router.ts';
import { hrefOf, routes } from '../routes.ts';

const PAGE = `
<section class="go:w-full go:max-w-xl go:mx-auto go:flex go:flex-col go:gap-4 go:py-6">
  <div class="${classes.card} go:space-y-2">
    <div class="go:flex go:items-center go:justify-between go:gap-3">
      <h1 data-ref="name" class="go:text-xl go:font-bold go:text-fg go:truncate">Profile</h1>
      <a href="${hrefOf(routes.nickname)}" class="${classes.link} go:text-xs">Change nickname</a>
    </div>
    <p data-ref="record" class="go:text-sm go:text-fg-soft"></p>
    <p data-ref="hint" class="${classes.hint}" role="status"></p>
  </div>
  <div data-ref="chartCard" class="${classes.card} go:space-y-2" hidden>
    <span class="${classes.heading}">Rating, last games</span>
    <div data-ref="chart"></div>
  </div>
  <div class="${classes.card} go:space-y-2">
    <span class="${classes.heading}">Match history</span>
    <ol data-ref="games" class="go:space-y-1"></ol>
  </div>
  <div data-ref="dangerCard" class="${classes.card} go:space-y-2" hidden>
    <span class="${classes.heading}">Delete my entry</span>
    <p class="go:text-sm go:text-fg-soft">
      Removes your nickname, rating and game records from the leaderboard, and the sign-in with them. This cannot be
      undone.
    </p>
    <button data-ref="delete" type="button" class="${classes.secondary}">Delete my entry</button>
  </div>
</section>`;

const CONFIRM_DELETE = 'Delete your leaderboard entry and its game records? This cannot be undone.';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART = { width: 600, height: 160, padding: 24 };
const LINE_WIDTH = 2;
/** The highest rating is written above the line and the lowest below it, this far from the chart's padding edge. */
const LABEL = { fontSize: 11, gapAbove: 8, gapBelow: 16 };

export function ProfilePage(context: AppContext): Page {
  const page = markup(PAGE);
  const hint = ref(page, 'hint');
  const firebase = context.firebase;
  const user = context.user;
  if (firebase === null) {
    hint.textContent = 'This site has no player accounts.';
    return { element: page };
  }
  if (user === null) {
    hint.replaceChildren('Sign in from the ', link(hrefOf(routes.start), 'start page'), ' to see your profile.');
    return { element: page };
  }
  if (user.nickname === null) {
    hint.replaceChildren(
      'Pick a ',
      link(hrefOf(routes.nickname), 'nickname'),
      ' to get a rating and keep a game history.',
    );
    return { element: page };
  }

  const { leaderboard, session } = firebase;
  const stop = leaderboard.followPlayer(
    user.uid,
    (player) => renderPlayer(page, player),
    (message) => (hint.textContent = message),
  );
  leaderboard
    .history(user.uid)
    .then((games) => renderGames(page, games))
    .catch((error: unknown) => (hint.textContent = messageOf(error)));

  const remove = ref(page, 'delete') as HTMLButtonElement;
  ref(page, 'dangerCard').hidden = false;
  remove.onclick = async () => {
    if (!window.confirm(CONFIRM_DELETE)) return;
    remove.disabled = true;
    try {
      await session.deleteEntry();
      context.navigate(routes.start);
    } catch (error) {
      hint.textContent = messageOf(error);
      remove.disabled = false;
    }
  };
  return { element: page, dispose: stop };
}

export function renderPlayer(page: HTMLElement, player: Player | null): void {
  ref(page, 'name').textContent = player?.name ?? 'Profile';
  ref(page, 'record').textContent =
    player === null ? 'No games yet.' : `Rating ${player.rating} · ${player.wins} wins / ${player.losses} losses`;
}

export function renderGames(page: HTMLElement, games: readonly PlayedGame[]): void {
  const list = ref(page, 'games');
  list.replaceChildren();
  if (games.length === 0) {
    list.append(element('li', classes.placeholder, 'No games saved yet.'));
    return;
  }
  for (const game of games) {
    const row = element('li', classes.row);
    const change = game.ratingAfter - game.ratingBefore;
    row.append(
      element(
        'span',
        'go:truncate',
        `${game.won ? 'Won' : 'Lost'} vs ${game.opponentName} by ${resultKindName(game.kind)}`,
      ),
      element(
        'span',
        `go:shrink-0 go:font-mono go:text-xs ${change >= 0 ? 'go:text-good' : 'go:text-danger'}`,
        `${change >= 0 ? '+' : ''}${change} → ${game.ratingAfter}`,
      ),
    );
    row.title = game.finishedAt?.toLocaleString() ?? '';
    list.append(row);
  }
  const card = ref(page, 'chartCard');
  card.hidden = games.length < 2;
  if (games.length >= 2) ref(page, 'chart').replaceChildren(ratingChart([...games].reverse()));
}

export function ratingChart(games: readonly PlayedGame[]): SVGSVGElement {
  const { width, height, padding } = CHART;
  const ratings = games.map((game) => game.ratingAfter);
  const low = Math.min(...ratings);
  const high = Math.max(...ratings);
  const span = Math.max(high - low, 1);
  const x = (i: number) => padding + (i / (ratings.length - 1)) * (width - padding * 2);
  const y = (rating: number) => height - padding - ((rating - low) / span) * (height - padding * 2);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Rating from ${ratings[0]} to ${ratings.at(-1)}`);
  svg.classList.add('go:w-full', 'go:h-auto');
  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('points', ratings.map((rating, i) => `${x(i)},${y(rating)}`).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', String(LINE_WIDTH));
  line.classList.add('go:text-accent');
  svg.append(
    line,
    label(padding, padding - LABEL.gapAbove, String(high)),
    label(padding, height - padding + LABEL.gapBelow, String(low)),
  );
  return svg;
}

function label(x: number, y: number, text: string): SVGTextElement {
  const node = document.createElementNS(SVG_NS, 'text');
  node.setAttribute('x', String(x));
  node.setAttribute('y', String(y));
  node.setAttribute('font-size', String(LABEL.fontSize));
  node.setAttribute('fill', 'currentColor');
  node.classList.add('go:text-fg-muted');
  node.textContent = text;
  return node;
}
