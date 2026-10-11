import { messageOf } from '@go-game/core/errors.ts';
import type { AppContext } from '../context.ts';
import { classes, markup, ref } from '../dom.ts';
import type { Page } from '../Router.ts';
import { routes } from '../routes.ts';

const PAGE = `
<section class="go:w-full go:max-w-xl go:mx-auto go:flex go:flex-col go:gap-4 go:py-6">
  <div class="${classes.card} go:space-y-4 go:text-center">
    <h1 class="go:text-2xl go:font-bold go:text-fg">Play 9x9 Go</h1>
    <p class="go:text-sm go:text-fg-soft">Play against a Monte Carlo Tree Search engine in your browser, against a friend at the same keyboard, or
      against a player online. You do not need an account. A player here is only a nickname.</p>
    <div class="go:flex go:flex-col go:sm:flex-row go:gap-2 go:justify-center">
      <button data-ref="guest" type="button" class="${classes.primary}">Play as anonymous guest</button>
      <button data-ref="offline" type="button" class="${classes.secondary}" hidden>Play offline</button>
    </div>
    <p data-ref="hint" class="${classes.hint}" role="status"></p>
  </div>
  <div data-ref="account" class="${classes.card} go:text-sm go:text-fg-soft" hidden>
    <h2 class="go:font-semibold go:text-fg">I linked an email to my nickname</h2>
    <form data-ref="form" class="go:mt-3 go:flex go:flex-col go:gap-2" autocomplete="on">
      <input data-ref="email" name="email" type="email" required placeholder="Email" aria-label="Email" class="${classes.input}" />
      <input data-ref="password" name="password" type="password" required minlength="6" placeholder="Password" aria-label="Password" class="${classes.input}" />
      <button data-ref="submit" type="submit" class="${classes.secondary}">Sign in</button>
    </form>
  </div>
</section>`;

export function GuestLoginPage(context: AppContext): Page {
  const element = markup(PAGE);
  const firebase = context.firebase;
  const hint = ref(element, 'hint');
  const guest = ref<HTMLButtonElement>(element, 'guest');
  const offline = ref<HTMLButtonElement>(element, 'offline');
  const account = ref(element, 'account');

  if (firebase === null) {
    guest.hidden = true;
    offline.hidden = false;
    hint.textContent = 'This site has no player accounts. Games are not saved.';
  } else {
    account.hidden = false;
  }

  offline.onclick = () => context.navigate(routes.play);
  guest.onclick = async () => {
    guest.disabled = true;
    try {
      await firebase?.session.signInAsGuest();
      context.navigate(context.user?.nickname ? routes.play : routes.nickname);
    } catch (error) {
      hint.textContent = messageOf(error);
      guest.disabled = false;
    }
  };

  const form = ref<HTMLFormElement>(element, 'form');
  form.onsubmit = async (event) => {
    event.preventDefault();
    const submit = ref<HTMLButtonElement>(element, 'submit');
    submit.disabled = true;
    try {
      await firebase?.session.signInWithEmail(
        ref<HTMLInputElement>(element, 'email').value,
        ref<HTMLInputElement>(element, 'password').value,
      );
      context.navigate(routes.play);
    } catch (error) {
      hint.textContent = messageOf(error);
    } finally {
      submit.disabled = false;
    }
  };

  return { element };
}
