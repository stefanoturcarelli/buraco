import type { Card, PlayerId, RoundScoreLine } from "../game/types";

export type EventType =
  | "game_created"
  | "player_joined"
  | "draw_stock"
  | "take_discard_pile"
  | "meld_new"
  | "meld_extend"
  | "discard"
  | "take_morto"
  | "go_out"
  | "round_scored";

export interface EventPayloads {
  game_created: { seed: string; players?: PlayerId[] };
  player_joined: { player: PlayerId };
  draw_stock: Record<string, never>;
  take_discard_pile: Record<string, never>;
  meld_new: { meldId: string; cards: Card[] };
  meld_extend: { meldId: string; cards: Card[] };
  discard: { card: Card };
  take_morto: { mortoIndex: number };
  go_out: Record<string, never>;
  round_scored: { scores: Record<PlayerId, RoundScoreLine> };
}

export interface NewEvent<T extends EventType = EventType> {
  type: T;
  actor: string;
  payload: EventPayloads[T];
}

export interface GameEvent<T extends EventType = EventType> {
  id: number;
  gameId: string;
  type: T;
  actor: string;
  payload: EventPayloads[T];
  createdAt: string;
}

export interface GameBackend {
  createGame(seed: string): Promise<{ gameId: string }>;
  appendEvent(gameId: string, e: NewEvent): Promise<GameEvent>;
  getEvents(gameId: string, sinceId: number): Promise<GameEvent[]>;
  subscribe?(gameId: string, cb: (e: GameEvent) => void): () => void;
}
