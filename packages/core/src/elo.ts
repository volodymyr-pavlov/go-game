// After each game the winner gains at most K points and the loser loses at most K points. firestore.rules checks the same limit.

export const INITIAL_RATING = 1000;
export const K = 32;

/** Stronger opponents have higher ratings: Gopher 900, Bear 1164, Elephant 1364. */
export function engineRating(playouts: number): number {
  return Math.round(500 + 200 * Math.log2(Math.max(playouts, 1) / 50));
}

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

export function ratingDelta(rating: number, opponent: number, won: boolean): number {
  const delta = Math.round(K * ((won ? 1 : 0) - expectedScore(rating, opponent)));
  return Math.max(-K, Math.min(K, delta));
}
