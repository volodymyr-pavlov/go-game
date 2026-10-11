import type { GameSync, Room } from '@go-game/client/rooms.ts';
import { RoomStatus } from '@go-game/types/protocol.ts';
import type { User } from '@go-game/core/user.ts';
import { messageOf } from '@go-game/core/errors.ts';
import type { AppContext } from '../context.ts';
import { button, classes, element, link, markup, ref } from '../dom.ts';
import type { Page } from '../Router.ts';
import { gameRoute, hrefOf, routes } from '../routes.ts';

const PAGE = `
<section class="go:w-full go:max-w-xl go:mx-auto go:flex go:flex-col go:gap-4 go:py-6">
  <div class="${classes.card} go:space-y-3">
    <div class="go:flex go:items-center go:justify-between go:gap-3">
      <h1 class="go:text-xl go:font-bold go:text-fg">Play online</h1>
      <button data-ref="create" type="button" class="${classes.primary}">Open a room</button>
    </div>
    <p class="go:text-xs go:text-fg-muted">The host plays Black. Moves are sent as they are made. A game ends after two passes or when a player resigns.</p>
    <p data-ref="waiting" class="go:text-sm go:text-fg-soft go:flex go:items-center go:gap-2" hidden>
      <span class="go:w-2 go:h-2 go:rounded-full go:bg-highlight go:animate-ping"></span>
      <span>Waiting for an opponent…</span>
      <button data-ref="cancel" type="button" class="${classes.link} go:text-xs go:bg-transparent go:border-0">Cancel</button>
    </p>
    <p data-ref="hint" class="${classes.hint}" role="status"></p>
  </div>
  <div class="${classes.card} go:space-y-2">
    <span class="${classes.heading}">Open rooms</span>
    <ul data-ref="rooms" class="go:space-y-1"></ul>
  </div>
</section>`;

interface HostedRoom {
  id: string;
  stop: () => void;
}

export function LobbyPage(context: AppContext): Page {
  const page = markup(PAGE);
  const sync = context.firebase?.sync;
  const user = context.user;
  if (sync && user !== null) return openLobby(page, context, sync, user);

  ref<HTMLButtonElement>(page, 'create').disabled = true;
  const hint = ref(page, 'hint');
  if (!sync) hint.textContent = 'Online play is not set up on this site.';
  else hint.replaceChildren('Sign in from the ', link(hrefOf(routes.start), 'start page'), ' to play online.');
  return { element: page };
}

function openLobby(page: HTMLElement, context: AppContext, sync: GameSync, user: User): Page {
  const hint = ref(page, 'hint');
  const waiting = ref(page, 'waiting');
  const create = ref<HTMLButtonElement>(page, 'create');
  const showHint = (message: string): void => {
    hint.textContent = message;
  };
  let hosted: HostedRoom | null = null;

  const join = async (room: Room): Promise<void> => {
    showHint('');
    try {
      await sync.joinRoom(room.id, user);
      context.navigate(gameRoute(room.id));
    } catch (error) {
      showHint(messageOf(error));
    }
  };

  const stopRooms = sync.followOpenRooms((rooms) => renderRooms(ref(page, 'rooms'), rooms, user.uid, join), showHint);

  create.onclick = async () => {
    create.disabled = true;
    showHint('');
    try {
      const id = await sync.createRoom(user);
      const stop = sync.followRoom(
        id,
        (room) => {
          if (room?.status === RoomStatus.PLAYING) context.navigate(gameRoute(room.id));
        },
        showHint,
      );
      hosted = { id, stop };
      waiting.hidden = false;
    } catch (error) {
      showHint(messageOf(error));
      create.disabled = false;
    }
  };

  ref(page, 'cancel').onclick = () => void leaveHosted();

  async function leaveHosted(): Promise<void> {
    const room = hosted;
    room?.stop();
    waiting.hidden = true;
    create.disabled = false;
    // The room stays behind when the delete fails. The player sees why and can try Cancel again.
    if (room !== null) await sync.closeRoom(room.id, user).catch((error) => showHint(messageOf(error)));
    hosted = null;
  }

  return {
    element: page,
    dispose: () => {
      stopRooms();
      hosted?.stop();
      // When the host leaves, an open room would catch the next guest in a dead room. So delete it, unless the game has already started.
      // The page is gone by the time a failure comes back, so it can only go to the console.
      if (hosted !== null && !window.location.hash.startsWith(hrefOf(gameRoute(hosted.id))))
        void sync.closeRoom(hosted.id, user).catch((error) => console.error(messageOf(error)));
    },
  };
}

export function renderRooms(
  list: HTMLElement,
  rooms: readonly Room[],
  ownUid: string,
  join: (room: Room) => void,
): void {
  list.replaceChildren();
  const others = rooms.filter((room) => room.host !== ownUid);
  if (others.length === 0) {
    list.append(element('li', classes.placeholder, 'No open rooms. Open one and wait for a guest.'));
    return;
  }
  for (const room of others) {
    const row = element('li', classes.row);
    row.append(
      element('span', 'go:truncate', `${room.hostName} is waiting`),
      button(classes.secondary, 'Join', () => join(room)),
    );
    list.append(row);
  }
}
