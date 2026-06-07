import type { Card, PlayerId, RoundScoreLine } from "../game/types";

// ---- Event model -----------------------------------------------------------
// Events are immutable. State is derived by reducing the ordered log. The
// cursor for ordering/polling is the global bigint `id` (not a per-game seq).

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

/** A new event to append (no id/createdAt yet). */
export interface NewEvent<T extends EventType = EventType> {
  type: T;
  actor: string;
  payload: EventPayloads[T];
}

/** A persisted event as returned by the backend. */
export interface GameEvent<T extends EventType = EventType> {
  id: number;
  gameId: string;
  type: T;
  actor: string;
  payload: EventPayloads[T];
  createdAt: string;
}

// ---- Backend interface -----------------------------------------------------
// The app depends ONLY on this interface so the storage layer stays swappable.

export interface GameBackend {
  createGame(seed: string): Promise<{ gameId: string }>;
  appendEvent(gameId: string, e: NewEvent): Promise<GameEvent>;
  /** Ordered events for a game with id > sinceId. */
  getEvents(gameId: string, sinceId: number): Promise<GameEvent[]>;
  /** Optional realtime subscription; returns an unsubscribe function. */
  subscribe?(gameId: string, cb: (e: GameEvent) => void): () => void;
}
