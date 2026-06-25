import type { Card, GameConfig, Meld, Rank } from "./types";

export function isWild(card: Card): boolean {
  return card.rank === "JOKER" || card.rank === "2";
}

export function isJoker(card: Card): boolean {
  return card.rank === "JOKER";
}

export function cardValue(card: Card): number {
  switch (card.rank) {
    case "JOKER": return 30;
    case "2":     return 20;
    case "A":     return 15;
    case "K": case "Q": case "J": case "10": case "9": case "8": return 10;
    default:      return 5;
  }
}

const RANK_NUM: Record<Rank, number> = {
  A: 14, K: 13, Q: 12, J: 11,
  "10": 10, "9": 9, "8": 8, "7": 7,
  "6": 6, "5": 5, "4": 4, "3": 3,
  "2": 2, JOKER: 0,
};

export interface MeldKind {
  valid: boolean;
  dirty: boolean;
  reason?: string;
}

export function isBuraco(meld: Meld): boolean {
  return meld.cards.length >= 7;
}

export function validateMeld(cards: Card[], config: GameConfig): MeldKind {
  if (cards.length < 3) {
    return { valid: false, dirty: false, reason: "A meld needs at least 3 cards." };
  }
  const asRun = validateRun(cards);
  if (asRun.valid) return asRun;
  if (config.allowSets) {
    const asSet = validateSet(cards);
    if (asSet.valid) return asSet;
  }
  return {
    valid: false,
    dirty: false,
    reason: config.allowSets ? "Not a valid run or set." : "Not a valid same-suit run.",
  };
}

function validateRun(cards: Card[]): MeldKind {
  if (cards.every((c) => !isJoker(c))) {
    if (naturalRun(cards)) return { valid: true, dirty: false };
  }
  for (let i = 0; i < cards.length; i++) {
    const candidate = cards[i];
    if (candidate.rank !== "JOKER" && candidate.rank !== "2") continue;
    const rest = cards.filter((_, idx) => idx !== i);
    if (rest.some(isJoker)) continue;
    if (runWithOneFiller(rest)) return { valid: true, dirty: true };
  }
  return { valid: false, dirty: false };
}

function naturalRun(cards: Card[]): boolean {
  const suit = cards[0].suit;
  if (!cards.every((c) => c.suit === suit)) return false;
  return consecutive(cards.map((c) => c.rank), 0);
}

function runWithOneFiller(rest: Card[]): boolean {
  if (rest.length === 0) return false;
  const suit = rest[0].suit;
  if (!rest.every((c) => c.suit === suit && !isJoker(c))) return false;
  return consecutive(rest.map((c) => c.rank), 1);
}

function consecutive(ranks: Rank[], wilds: number): boolean {
  const hasAce = ranks.includes("A");
  const aceOptions = hasAce ? [14, 1] : [14];
  for (const aceVal of aceOptions) {
    const nums = ranks.map((r) => (r === "A" ? aceVal : RANK_NUM[r]));
    const sorted = [...nums].sort((a, b) => a - b);
    const distinct = new Set(sorted).size === sorted.length;
    if (!distinct) continue;
    if (sorted[0] < 1) continue;
    const span = sorted[sorted.length - 1] - sorted[0] + 1;
    const holes = span - sorted.length;
    if (holes < 0) continue;
    if (holes <= wilds && sorted[sorted.length - 1] <= 14) return true;
  }
  return false;
}

function validateSet(cards: Card[]): MeldKind {
  if (cards.every((c) => !isJoker(c))) {
    const rank = cards[0].rank;
    if (cards.every((c) => c.rank === rank)) return { valid: true, dirty: false };
  }
  for (let i = 0; i < cards.length; i++) {
    const candidate = cards[i];
    if (candidate.rank !== "JOKER" && candidate.rank !== "2") continue;
    const rest = cards.filter((_, idx) => idx !== i);
    if (rest.length < 2 || rest.some(isJoker)) continue;
    const rank = rest[0].rank;
    if (rest.every((c) => c.rank === rank)) return { valid: true, dirty: true };
  }
  return { valid: false, dirty: false };
}
