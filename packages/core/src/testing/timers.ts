/** Waits until the callbacks that are already queued, such as resolved promises and zero-delay timers, have run. */
export function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
