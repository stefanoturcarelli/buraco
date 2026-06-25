export type Suit = "C" | "D" | "H" | "S";
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
  cards: Card[];
}

export type TurnPhase = "draw" | "meld";

export type GamePhase =
  | "lobby"
  | "playing"
  | "roundOver"
  | "matchOver";

export interface RoundScoreLine {
  meldPoints: number;
  buracoBonus: number;
  goOutBonus: number;
  mortoPenalty: number;
  handPenalty: number;
  total: number;
}

export interface GameState {
  seed: string;
  config: GameConfig;
  players: PlayerId[];
  phase: GamePhase;
  round: number;
  turn: number;
  turnPhase: TurnPhase;

  hands: Record<PlayerId, Card[]>;
  melds: Record<PlayerId, Meld[]>;
  mortoTaken: Record<PlayerId, boolean>;

  stock: Card[];
  discard: Card[];
  mortos: Card[][];

  scores: Record<PlayerId, number>;
  wentOut: number | null;
  lastRoundScores: Record<PlayerId, RoundScoreLine> | null;
}

export interface GameConfig {
  allowSets: boolean;
  target: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  allowSets: false,
  target: 1500,
};

export class GameError extends Error {}
