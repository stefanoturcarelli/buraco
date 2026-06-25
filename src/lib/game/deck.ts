import type { Card, Rank, Suit } from "./types";
import { makeRng, shuffle } from "./prng";

const SUITS: Suit[] = ["C", "D", "H", "S"];
const RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7",
  "8", "9", "10", "J", "Q", "K",
];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: id++, rank, suit });
      }
    }
    cards.push({ id: id++, rank: "JOKER", suit: null });
    cards.push({ id: id++, rank: "JOKER", suit: null });
  }
  return cards;
}

export interface Deal {
  hands: Card[][];
  mortos: Card[][];
  stock: Card[];
  discard: Card[];
}

export function deal(seed: string): Deal {
  const deck = shuffle(buildDeck(), makeRng(seed));
  const hands = [deck.slice(0, 11), deck.slice(11, 22)];
  const mortos = [deck.slice(22, 33), deck.slice(33, 44)];
  const rest = deck.slice(44);
  const discard = [rest[0]];
  const stock = rest.slice(1);
  return { hands, mortos, stock, discard };
}

export function roundSeed(baseSeed: string, round: number): string {
  return `${baseSeed}#${round}`;
}
