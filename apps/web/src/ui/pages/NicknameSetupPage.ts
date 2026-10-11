import { NICKNAME_MAX, NICKNAME_MIN } from '@go-game/core/nickname.ts';
import type { AppContext } from '../context.ts';
import { classes, markup, ref, submitWith } from '../dom.ts';
import type { Page } from '../Router.ts';
import { hrefOf, routes } from '../routes.ts';

const PAGE = `
<section class="go:w-full go:max-w-xl go:mx-auto go:flex go:flex-col go:gap-4 go:py-6">
  <div class="${classes.card} go:space-y-3">
    <h1 class="go:text-xl go:font-bold go:text-fg">Your nickname</h1>
    <p data-ref="current" class="go:text-sm go:text-fg-soft"></p>
    <form data-ref="nicknameForm" class="go:flex go:gap-2" autocomplete="off">
      <input data-ref="nickname" name="nickname" type="text" required placeholder="Nickname" aria-label="Nickname" class="${classes.input}" />
      <button data-ref="claim" type="submit" class="${classes.primary} go:shrink-0">Claim</button>
    </form>
    <p class="go:text-xs go:text-fg-muted">${NICKNAME_MIN} to ${NICKNAME_MAX} characters. Nicknames are public. Each name belongs to one player, and case does not matter.</p>
    <p data-ref="nicknameHint" class="${classes.hint}" role="status"></p>
  </div>
  <div data-ref="linkCard" class="${classes.card} go:space-y-3">
    <h2 class="go:text-base go:font-bold go:text-fg">Keep it on another device</h2>
    <p data-ref="linkText" class="go:text-sm go:text-fg-soft">Your guest sign-in is kept in this browser. Link an email and a password to sign in with the same
      nickname on another device. No message is sent to that email.</p>
    <form data-ref="linkForm" class="go:flex go:flex-col go:gap-2" autocomplete="on">
      <input data-ref="email" name="email" type="email" required placeholder="Email" aria-label="Email" class="${classes.input}" />
      <input data-ref="password" name="password" type="password" required minlength="6" placeholder="Password (6+ characters)" aria-label="Password" class="${classes.input}" />
      <button data-ref="link" type="submit" class="${classes.secondary}">Link email and password</button>
    </form>
    <p data-ref="linkHint" class="${classes.hint}" role="status"></p>
  </div>
  <div class="go:flex go:gap-2 go:justify-between go:items-center">
    <a href="${hrefOf(routes.play)}" class="${classes.primary} go:no-underline">Play</a>
    <button data-ref="signOut" type="button" class="${classes.link} go:text-xs go:bg-transparent go:border-0">Sign out</button>
  </div>
</section>`;

export function NicknameSetupPage(context: AppContext): Page {
  const element = markup(PAGE);
  const session = context.firebase?.session;
  if (session === undefined) {
    element.replaceChildren(markup(`<p class="${classes.placeholder}">This site has no player accounts.</p>`));
    return { element };
  }
  const current = ref(element, 'current');
  const nickname = ref<HTMLInputElement>(element, 'nickname');
  nickname.minLength = NICKNAME_MIN;
  nickname.maxLength = NICKNAME_MAX;
  const nicknameHint = ref(element, 'nicknameHint');
  const linkCard = ref(element, 'linkCard');
  const linkHint = ref(element, 'linkHint');

  const render = (): void => {
    const user = context.user;
    current.textContent = user?.nickname
      ? `You play as ${user.nickname}. Type another name to change it.`
      : 'Pick the name the leaderboard will show.';
    if (user?.nickname && nickname.value === '') nickname.value = user.nickname;
    linkCard.hidden = user === null;
    if (user !== null && !user.isGuest) {
      ref(element, 'linkText').textContent =
        `Linked to ${user.email ?? 'an email'}. Sign in with it on another device.`;
      ref<HTMLFormElement>(element, 'linkForm').hidden = true;
    }
  };
  const stop = session.onUser(render);

  ref<HTMLFormElement>(element, 'nicknameForm').onsubmit = async (event) => {
    event.preventDefault();
    const saved = await submitWith(ref<HTMLButtonElement>(element, 'claim'), nicknameHint, async () => {
      await session.signInAsGuest();
      await session.claimNickname(nickname.value);
    });
    if (saved) nicknameHint.textContent = 'Saved.';
  };

  ref<HTMLFormElement>(element, 'linkForm').onsubmit = async (event) => {
    event.preventDefault();
    const linked = await submitWith(ref<HTMLButtonElement>(element, 'link'), linkHint, () =>
      session.linkEmail(
        ref<HTMLInputElement>(element, 'email').value,
        ref<HTMLInputElement>(element, 'password').value,
      ),
    );
    if (linked) linkHint.textContent = 'Linked. You can sign in with this email on another device.';
  };

  ref(element, 'signOut').onclick = async () => {
    await session.signOut();
    context.navigate(routes.start);
  };

  return { element, dispose: stop };
}
