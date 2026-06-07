// Core domain types for the Buraco rules engine.

export type Suit = "C" | "D" | "H" | "S"; // clubs, diamonds, hearts, spades
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "JOKER";

export interface Card {
  /** Unique within a deal (0..107). Two physical decks mean ranks repeat. */
  id: number;
  rank: Rank;
  /** null only for jokers. */
  suit: Suit | null;
}

export type PlayerId = string;

export interface Meld {
  meldId: string;
  /** Cards in the meld, owner's order is irrelevant; validation sorts them. */
  cards: Card[];
}

export type TurnPhase = "draw" | "meld";

export type GamePhase =
  | "lobby" // waiting for the second player
  | "playing"
  | "roundOver" // someone went out; waiting for round_scored
  | "matchOver";

export interface RoundScoreLine {
  meldPoints: number; // sum of melded card values
  buracoBonus: number; // +200 clean / +100 dirty per buraco
  goOutBonus: number; // +100 for the player who went out
  mortoPenalty: number; // -100 if they never took a morto
  handPenalty: number; // negative: value of cards left in hand
  total: number; // sum of the above
}

export interface GameState {
  seed: string; // base seed from game_created
  config: GameConfig;
  players: PlayerId[]; // join order; index === seat
  phase: GamePhase;
  round: number; // 0-based
  turn: number; // seat index whose turn it is
  turnPhase: TurnPhase;

  hands: Record<PlayerId, Card[]>;
  melds: Record<PlayerId, Meld[]>;
  mortoTaken: Record<PlayerId, boolean>;

  stock: Card[];
  discard: Card[]; // top of pile is the last element
  mortos: Card[][]; // two piles; emptied once taken

  scores: Record<PlayerId, number>; // running match totals
  /** The seat that went out this round, set when phase === "roundOver". */
  wentOut: number | null;
  /** Per-round breakdown for the most recently scored round. */
  lastRoundScores: Record<PlayerId, RoundScoreLine> | null;
}

export interface GameConfig {
  /** Allow same-rank sets in addition to same-suit runs. */
  allowSets: boolean;
  /** Match target; first to reach it ends the match. */
  target: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  allowSets: false,
  target: 1500,
};

/** Thrown for illegal moves; the message is shown to the player. */
export class GameError extends Error {}
