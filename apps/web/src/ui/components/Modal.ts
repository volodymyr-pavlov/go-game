import { byIdIn, hide, show } from '../dom.ts';

function openModal(modal: HTMLElement): void {
  show(modal);
}

function closeModal(modal: HTMLElement): void {
  hide(modal);
}

/** Wires the button `openId` and the buttons `closeIds`, all inside `root`, to the dialog `modalId`. */
export function bindModal(root: ParentNode, openId: string, modalId: string, closeIds: string[]): void {
  const modal = byIdIn(root, modalId);
  byIdIn(root, openId).onclick = () => openModal(modal);
  for (const id of closeIds) byIdIn(root, id).onclick = () => closeModal(modal);
}
