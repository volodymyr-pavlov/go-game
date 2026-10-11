// The part of the YouTube Playables SDK that this app uses. The script in index.html puts `ytgame` on the window. Outside
// YouTube, for example in a browser during development, every function here does nothing.

interface Ytgame {
  game: { firstFrameReady(): void; gameReady(): void };
  engagement: { sendScore(score: { value: number }): Promise<void> };
  system: {
    onPause(listener: () => void): () => void;
    onResume(listener: () => void): () => void;
    isAudioEnabled(): boolean;
  };
}

declare global {
  interface Window {
    ytgame?: Ytgame;
  }
}

/** Tells YouTube the first frame is drawn, and then that the game can be played. Both are required, in this order. */
export function markReady(): void {
  window.ytgame?.game.firstFrameReady();
  window.ytgame?.game.gameReady();
}

/** YouTube pauses the Playable when the viewer leaves it, and resumes it when they come back. */
export function onLifecycle(pause: () => void, resume: () => void): void {
  window.ytgame?.system.onPause(pause);
  window.ytgame?.system.onResume(resume);
}

/** Sends the score of a finished game to YouTube: the margin of a win, or 0 for a loss. */
export function sendScore(value: number): void {
  void window.ytgame?.engagement.sendScore({ value: Math.max(0, Math.round(value)) });
}

export function audioEnabled(): boolean {
  return window.ytgame?.system.isAudioEnabled() ?? true;
}
