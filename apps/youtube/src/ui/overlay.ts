import { colourName } from '@go-game/core/notation.ts';
import type { StatusModel } from '@go-game/core/ports.ts';

export function showStatus(status: StatusModel | null, thinking: boolean, ended: string): void {
  const line = document.getElementById('status');
  if (line === null) return;
  if (ended !== '') line.textContent = ended;
  else if (thinking) line.textContent = 'Thinking…';
  else if (status !== null) line.textContent = `${colourName(status.toPlay)} to play`;
}

/** Wires a button of index.html to an action. */
export function onTap(id: string, action: () => void): void {
  const button = document.getElementById(id);
  if (button !== null) button.onclick = action;
}
