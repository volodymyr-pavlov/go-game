import { ids } from './ids.ts';

const DONE_CLASS = 'go-loader-done';
/** Matches the transition in the loader's style block in index.html. */
const FADE_MS = 300;

/** Fades out the loading screen from index.html and removes it. Calling it twice, or without a loader, does nothing. */
export function hideLoader(): void {
  const loader = document.getElementById(ids.loader);
  if (loader === null || loader.classList.contains(DONE_CLASS)) return;
  loader.classList.add(DONE_CLASS);
  setTimeout(() => loader.remove(), FADE_MS);
}
