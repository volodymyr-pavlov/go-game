import { messageOf } from '@go-game/core/errors.ts';

/**
 * Loads now, and again `everyMs` after each load has finished, until the returned function is called.
 * A failed load goes to `onError` and the polling goes on. An answer that comes after the stop is dropped.
 */
export function poll<T>(
  load: () => Promise<T>,
  onData: (data: T) => void,
  onError: (message: string) => void,
  everyMs: number,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async (): Promise<void> => {
    try {
      const data = await load();
      if (!stopped) onData(data);
    } catch (error) {
      if (!stopped) onError(messageOf(error));
    }
    if (!stopped) timer = setTimeout(() => void run(), everyMs);
  };
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
