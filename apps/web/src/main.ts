import './styles/main.css';
import { initConsent } from './analytics/consent.ts';
import type { User } from './firebase/auth.ts';
import { createFirebase, type Firebase } from './firebase/services.ts';
import { Navbar, type NavLink } from './ui/components/Navbar.ts';
import type { AppContext } from './ui/context.ts';
import { byId } from './ui/dom.ts';
import { ids } from './ui/ids.ts';
import { hideLoader } from './ui/Loader.ts';
import { GuestLoginPage } from './ui/pages/GuestLoginPage.ts';
import { LeaderboardPage } from './ui/pages/LeaderboardPage.ts';
import { LobbyPage } from './ui/pages/LobbyPage.ts';
import { NicknameSetupPage } from './ui/pages/NicknameSetupPage.ts';
import { PlayPage } from './ui/pages/PlayPage.ts';
import { ProfilePage } from './ui/pages/ProfilePage.ts';
import { SkinManager } from '@go-game/presentation/skins/SkinManager.ts';
import { Router, currentPath, type Page, type PageFactory, type Params } from './ui/Router.ts';
import { isGameRoute, routes } from './ui/routes.ts';

/** If sign-in or the board hangs, the loader goes away anyway so the visitor is not left with a blank page. */
const LOADER_TIMEOUT_MS = 10_000;
/** The loading screen stays at least this long, so the stones finish their animation instead of flashing by. */
const LOADER_MIN_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function browserIsSupported(): boolean {
  return typeof WebAssembly === 'object' && typeof Worker === 'function';
}

/** The page does not run inside an iframe of another site. This check exists because a meta tag cannot set frame-ancestors. */
function isFramedByAnotherOrigin(): boolean {
  try {
    return window.top !== window.self && window.top?.location.origin !== window.location.origin;
  } catch {
    return true; // reading window.top of another origin throws, and that means we are in a frame
  }
}

function showNotice(id: string): void {
  document.getElementById(id)?.removeAttribute('hidden');
}

/** The pages a signed-out visitor is sent away from, on a site with accounts. */
function needsUser(path: string): boolean {
  return [routes.play, routes.lobby, routes.profile].some((prefix) => path.startsWith(prefix)) || isGameRoute(path);
}

function firstUser(firebase: Firebase): Promise<User | null> {
  return new Promise((resolve) => {
    let stop: (() => void) | null = null;
    let reported = false;
    stop = firebase.session.onUser((user) => {
      if (reported) return;
      reported = true;
      resolve(user);
      // The listener can run before `stop` has a value, so the unsubscribe is done a moment later.
      queueMicrotask(() => stop?.());
    });
  });
}

/** Without accounts only the game is there; without a Realtime Database there is no online play to link to. */
function navLinksFor(firebase: Firebase | null): NavLink[] {
  return [
    { path: routes.play, label: 'Play' },
    ...(firebase?.sync ? [{ path: routes.lobby, label: 'Online' }] : []),
    ...(firebase
      ? [
          { path: routes.leaderboard, label: 'Leaderboard' },
          { path: routes.profile, label: 'Profile' },
        ]
      : []),
  ];
}

function registerRoutes(router: Router, context: AppContext): void {
  const { firebase } = context;
  const guarded =
    (build: (context: AppContext, params: Params) => Page | Promise<Page>): PageFactory =>
    (params) => {
      if (firebase !== null && context.user === null && needsUser(currentPath())) {
        router.navigate(routes.start);
        return { element: document.createElement('div') };
      }
      return build(context, params);
    };

  router
    .add(routes.start, () => (firebase === null ? PlayPage(context, {}) : GuestLoginPage(context)))
    .add(routes.play, guarded(PlayPage))
    .add(routes.game, guarded(PlayPage))
    .add(routes.lobby, guarded(LobbyPage))
    .add(routes.nickname, () => NicknameSetupPage(context))
    .add(routes.leaderboard, () => LeaderboardPage(context))
    .add(routes.profile, guarded(ProfilePage));
}

/** Waits for the first word on the visitor, then keeps the context up to date. A sign-out goes back to the start page. */
async function followSession(firebase: Firebase, context: AppContext, router: Router): Promise<void> {
  // The start page shows the same failure again when the visitor tries to sign in. Here it only goes to the console.
  firebase.session.reportErrorsTo((message) => console.error(message));
  context.user = await firstUser(firebase);
  firebase.session.onUser((user) => {
    const signedOut = context.user !== null && user === null;
    context.user = user;
    if (signedOut) router.navigate(routes.start);
  });
}

async function main(): Promise<void> {
  initConsent();
  if (isFramedByAnotherOrigin()) return showNotice(ids.framedNotice);
  if (!browserIsSupported()) return showNotice(ids.unsupportedNotice);

  const firebase = await createFirebase();
  const router = new Router(byId(ids.app));
  const context: AppContext = {
    firebase,
    user: null,
    skins: new SkinManager(),
    navigate: (path) => router.navigate(path),
  };

  const navbar = new Navbar(byId(ids.navbar), navLinksFor(firebase));
  // Without Firebase the game is the only page. A header with one link would be useless, so it stays hidden.
  byId(ids.navbar).hidden = firebase === null;
  window.addEventListener('hashchange', () => navbar.highlight(currentPath()));
  navbar.highlight(currentPath());

  registerRoutes(router, context);
  if (firebase !== null) await followSession(firebase, context, router);
  await router.start();
}

setTimeout(hideLoader, LOADER_TIMEOUT_MS);
void Promise.all([main(), sleep(LOADER_MIN_MS)]).finally(hideLoader);
