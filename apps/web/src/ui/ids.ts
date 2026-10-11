import { BLACK, type Stone } from '@go-game/core/board.ts';

export const ids = {
  app: 'app',
  loader: 'loader',
  navbar: 'navbar',
  gameTemplate: 'game-page',
  board: 'board',
  framedNotice: 'framed',
  unsupportedNotice: 'unsupported',
  modeField: 'game-mode-field',
  onlineNotice: 'online-notice',

  passButton: 'pass-btn',
  resignButton: 'resign-btn',
  resetButton: 'reset-btn',
  modalResetButton: 'modal-reset-btn',
  rulesButton: 'rules-btn',
  rulesModal: 'rules-modal',
  rulesModalClose: 'close-rules-modal',
  rulesModalCloseButton: 'close-rules-btn',
  skinRow: 'skin-row',
  skinButton: 'skin-btn',
  skinModal: 'skin-modal',
  skinModalClose: 'close-skin-modal',
  skinModalCloseButton: 'close-skin-btn',
  skinList: 'skin-list',
  modeSelect: 'game-mode-select',
  opponentSelect: 'opponent-select',
  opponentBadge: 'opponent-badge',
  opponentAvatar: 'opponent-avatar',
  opponentPlate: 'opponent-plate',

  currentTurn: 'current-turn-text',
  blackCard: 'black-card',
  whiteCard: 'white-card',
  blackLabel: 'black-label',
  whiteLabel: 'white-label',
  blackScore: 'black-score',
  whiteScore: 'white-score',
  thinkingOverlay: 'thinking-overlay',
  thinkingText: 'thinking-text',

  toast: 'toast',
  toastMessage: 'toast-msg',
  engineError: 'engine-error',
  engineErrorDetail: 'engine-error-detail',

  gameOverModal: 'gameover-modal',
  winnerTitle: 'winner-title',
  winnerReason: 'winner-reason',
} as const;

/** The ids of the score sheet cells of one colour. */
export function finalScoreIds(stone: Stone): { total: string; stones: string; territory: string } {
  const side = stone === BLACK ? 'black' : 'white';
  return { total: `${side}-final-score`, stones: `${side}-stones`, territory: `${side}-territory` };
}
