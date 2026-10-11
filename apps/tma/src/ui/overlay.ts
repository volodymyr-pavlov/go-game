import type { StatusModel } from '@go-game/core/ports.ts';
import { colourName } from '@go-game/core/notation.ts';

/** The text around the board, under the thumb: whose turn it is, and the last message. */
export function showStatus(status: StatusModel, thinking: boolean): void {
  const line = document.getElementById('status');
  if (line !== null) line.textContent = thinking ? 'Thinking…' : `${colourName(status.toPlay)} to play`;
}

export function showMessage(message: string): void {
  const line = document.getElementById('message');
  if (line !== null) line.textContent = message;
}

/** Wires a button of index.html to an action. */
export function onTap(id: string, action: () => void): void {
  const button = document.getElementById(id);
  if (button !== null) button.onclick = action;
}
