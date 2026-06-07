import type { Card, Rank, Suit } from "./types";
import { makeRng, shuffle } from "./prng";

const SUITS: Suit[] = ["C", "D", "H", "S"];
const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

/**
 * Build the canonical 108-card deck (2 standard decks + 4 jokers), in a fixed
 * order. Each card gets a unique id so duplicate rank/suit pairs stay distinct.
 */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: id++, rank, suit });
      }
    }
    // two jokers per deck copy => 4 total
    cards.push({ id: id++, rank: "JOKER", suit: null });
    cards.push({ id: id++, rank: "JOKER", suit: null });
  }
  return cards;
}

export interface Deal {
  hands: Card[][]; // [player0, player1]
  mortos: Card[][]; // two piles of 11
  stock: Card[];
  discard: Card[]; // single flipped card to start the pile
}

/**
 * Deterministically shuffle and deal from a seed.
 *
 * TRUST-BASED: both clients compute the identical shuffled deck from the seed,
 * which means a client could in principle read the upcoming stock order. That
 * is acceptable for a private 2-player game; a server could hide the stock
 * later without changing this interface.
 */
export function deal(seed: string): Deal {
  const deck = shuffle(buildDeck(), makeRng(seed));
  const hands = [deck.slice(0, 11), deck.slice(11, 22)];
  const mortos = [deck.slice(22, 33), deck.slice(33, 44)];
  const rest = deck.slice(44);
  const discard = [rest[0]];
  const stock = rest.slice(1);
  return { hands, mortos, stock, discard };
}

/** Per-round seed derived from the base seed so rounds re-deal deterministically. */
export function roundSeed(baseSeed: string, round: number): string {
  return `${baseSeed}#${round}`;
}
