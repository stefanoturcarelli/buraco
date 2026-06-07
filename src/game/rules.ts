import type { Card, GameConfig, Meld, Rank } from "./types";

/** A wild is a joker or any natural 2 (a 2 may also be played in its own slot). */
export function isWild(card: Card): boolean {
  return card.rank === "JOKER" || card.rank === "2";
}

export function isJoker(card: Card): boolean {
  return card.rank === "JOKER";
}

/** Point value of a single card (used for both melded + and in-hand -). */
export function cardValue(card: Card): number {
  switch (card.rank) {
    case "JOKER":
      return 30;
    case "2":
      return 20;
    case "A":
      return 15;
    case "K":
    case "Q":
    case "J":
    case "10":
    case "9":
    case "8":
      return 10;
    default: // 3,4,5,6,7
      return 5;
  }
}

// Numeric rank for sequence math. Ace is handled specially (high or low).
const RANK_NUM: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  "10": 10,
  "9": 9,
  "8": 8,
  "7": 7,
  "6": 6,
  "5": 5,
  "4": 4,
  "3": 3,
  "2": 2,
  JOKER: 0,
};

export interface MeldKind {
  valid: boolean;
  /** Contains a wild card (joker, or a 2 used as a wild filler). */
  dirty: boolean;
  /** Human-readable reason when invalid. */
  reason?: string;
}

/** A meld of 7+ cards is a buraco. */
export function isBuraco(meld: Meld): boolean {
  return meld.cards.length >= 7;
}

/**
 * Validate a candidate meld (a run, or a set when enabled). At most ONE wild
 * per meld (standard Buraco). Returns whether it is valid and clean/dirty.
 */
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
    reason: config.allowSets
      ? "Not a valid run or set."
      : "Not a valid same-suit run.",
  };
}

/**
 * A run: consecutive same-suit cards. At most one wild, which fills a single
 * gap or extends an end. A natural 2 in its own slot is not counted as a wild.
 */
function validateRun(cards: Card[]): MeldKind {
  // Try with zero wilds: every card natural, same suit, consecutive.
  if (cards.every((c) => !isJoker(c))) {
    const clean = naturalRun(cards);
    if (clean) return { valid: true, dirty: false };
  }
  // Try with exactly one wild: pick each joker-or-2 to be the wild filler.
  for (let i = 0; i < cards.length; i++) {
    const candidate = cards[i];
    if (candidate.rank !== "JOKER" && candidate.rank !== "2") continue;
    const rest = cards.filter((_, idx) => idx !== i);
    if (rest.some(isJoker)) continue; // only one wild allowed
    if (runWithOneFiller(rest)) return { valid: true, dirty: true };
  }
  return { valid: false, dirty: false };
}

/** All natural, same suit, distinct, consecutive ranks (ace high or low). */
function naturalRun(cards: Card[]): boolean {
  const suit = cards[0].suit;
  if (!cards.every((c) => c.suit === suit)) return false;
  return consecutive(cards.map((c) => c.rank), 0);
}

/** The naturals plus exactly one wild form a run. */
function runWithOneFiller(rest: Card[]): boolean {
  if (rest.length === 0) return false; // need >=2 naturals + wild for length>=3
  const suit = rest[0].suit;
  if (!rest.every((c) => c.suit === suit && !isJoker(c))) return false;
  return consecutive(rest.map((c) => c.rank), 1);
}

/**
 * Do these (natural) ranks fit into a run that also has `wilds` filler cards?
 * Tries ace-high and ace-low. Ranks must be distinct; the natural span minus
 * the count of naturals is the number of internal holes, which the wilds must
 * cover (any leftover wild simply extends an end).
 */
function consecutive(ranks: Rank[], wilds: number): boolean {
  const hasAce = ranks.includes("A");
  const aceOptions = hasAce ? [14, 1] : [14];
  for (const aceVal of aceOptions) {
    const nums = ranks.map((r) => (r === "A" ? aceVal : RANK_NUM[r]));
    const sorted = [...nums].sort((a, b) => a - b);
    const distinct = new Set(sorted).size === sorted.length;
    if (!distinct) continue;
    if (sorted[0] < 1) continue;
    const span = sorted[sorted.length - 1] - sorted[0] + 1; // slots covered
    const holes = span - sorted.length;
    if (holes < 0) continue;
    if (holes <= wilds && sorted[sorted.length - 1] <= 14) return true;
  }
  return false;
}

/** A set: 3+ cards of the same rank, at most one wild. */
function validateSet(cards: Card[]): MeldKind {
  // zero wild: all same rank, no joker.
  if (cards.every((c) => !isJoker(c))) {
    const rank = cards[0].rank;
    if (cards.every((c) => c.rank === rank)) return { valid: true, dirty: false };
  }
  // one wild: pick a joker-or-2 as the wild; the rest share one rank.
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
