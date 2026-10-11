import { INITIAL_RATING } from '@go-game/core/elo.ts';
import { TOP_COUNT, type RankedPlayer } from '@go-game/client/leaderboard.ts';
import type { AppContext } from '../context.ts';
import { classes, element, markup, ref } from '../dom.ts';
import type { Page } from '../Router.ts';

const PAGE = `
<section class="go:w-full go:max-w-xl go:mx-auto go:flex go:flex-col go:gap-4 go:py-6">
  <div class="${classes.card} go:space-y-3">
    <div class="go:flex go:items-center go:justify-between">
      <h1 class="go:text-xl go:font-bold go:text-fg">Leaderboard</h1>
      <span class="${classes.heading}">Top ${TOP_COUNT} by rating</span>
    </div>
    <p class="go:text-xs go:text-fg-muted">Players who claimed a nickname. Ratings start at ${INITIAL_RATING} and change with every game against Gopher, Bear or Elephant, and with every online game.</p>
    <ol data-ref="list" class="go:space-y-1"></ol>
    <p data-ref="hint" class="${classes.hint}" role="status"></p>
  </div>
</section>`;

const HEADER_CLASS =
  'go:grid go:grid-cols-[2.5rem_1fr_4rem_6rem] go:gap-2 go:px-3 go:text-[11px] go:uppercase go:tracking-wider go:text-fg-muted go:font-bold';
const ROW_CLASS =
  'go:grid go:grid-cols-[2.5rem_1fr_4rem_6rem] go:gap-2 go:items-center go:py-1.5 go:px-3 go:rounded-lg go:bg-inset go:border go:border-line go:text-sm go:text-fg-soft';
const OWN_ROW_CLASS = `${ROW_CLASS} go:border-highlight/60`;

export function LeaderboardPage(context: AppContext): Page {
  const page = markup(PAGE);
  const list = ref(page, 'list');
  const hint = ref(page, 'hint');
  const leaderboard = context.firebase?.leaderboard;
  if (leaderboard === undefined) {
    hint.textContent = 'This site has no leaderboard.';
    return { element: page };
  }
  hint.textContent = 'Loading…';
  const stop = leaderboard.followTop(
    (players) => {
      hint.textContent = '';
      renderTable(list, players, context.user?.uid ?? null);
    },
    (message) => (hint.textContent = message),
  );
  return { element: page, dispose: stop };
}

export function renderTable(list: HTMLElement, players: readonly RankedPlayer[], ownUid: string | null): void {
  list.replaceChildren();
  if (players.length === 0) {
    list.append(element('li', classes.placeholder, 'No games saved yet.'));
    return;
  }
  const header = element('li', HEADER_CLASS);
  header.append(
    element('span', '', '#'),
    element('span', '', 'Player'),
    element('span', '', 'Rating'),
    element('span', '', 'W / L'),
  );
  list.append(header);
  players.forEach((player, index) => {
    const row = element('li', player.uid === ownUid ? OWN_ROW_CLASS : ROW_CLASS);
    row.append(
      element('span', 'go:text-fg-muted', String(index + 1)),
      element('span', 'go:truncate go:font-semibold go:text-fg', player.name),
      element('span', 'go:font-bold go:text-accent', String(player.rating)),
      element('span', 'go:text-fg-muted', `${player.wins} / ${player.losses}`),
    );
    list.append(row);
  });
}
