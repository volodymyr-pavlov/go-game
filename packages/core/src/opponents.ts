/** A computer opponent. It is a name for one strength of the engine, set by how many playouts the engine runs per move. */
export interface Opponent {
  readonly name: string;
  readonly playouts: number;
}

/** The three opponents, from weakest to strongest. Their playout counts are the values in the opponent dropdown. */
export const OPPONENTS: readonly Opponent[] = [
  { name: 'Gopher', playouts: 200 },
  { name: 'Bear', playouts: 500 },
  { name: 'Elephant', playouts: 1000 },
];

/** The opponent that is selected when the page opens. */
export const DEFAULT_OPPONENT = OPPONENTS[0];

/** The opponent that runs `playouts` per move, or null when no opponent has that count. */
export function opponentFor(playouts: number | null): Opponent | null {
  return OPPONENTS.find((opponent) => opponent.playouts === playouts) ?? null;
}

/** The name of the opponent that runs `playouts` per move. "Engine" when the count is null or unknown. */
export function opponentName(playouts: number | null): string {
  return opponentFor(playouts)?.name ?? 'Engine';
}
