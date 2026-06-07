import {
  type Card,
  type GameConfig,
  type GameState,
  type Meld,
  type PlayerId,
  GameError,
  DEFAULT_CONFIG,
} from "./types";
import { deal, roundSeed } from "./deck";
import { isBuraco, validateMeld } from "./rules";
import type { EventType, EventPayloads } from "../backend/types";

/** Minimal shape needed to apply an event (works for both new and stored events). */
export interface ApplicableEvent<T extends EventType = EventType> {
  type: T;
  actor: string;
  payload: EventPayloads[T];
}

function emptyState(config: GameConfig): GameState {
  return {
    seed: "",
    config,
    players: [],
    phase: "lobby",
    round: 0,
    turn: 0,
    turnPhase: "draw",
    hands: {},
    melds: {},
    mortoTaken: {},
    stock: [],
    discard: [],
    mortos: [],
    scores: {},
    wentOut: null,
    lastRoundScores: null,
  };
}

/** Reduce an ordered event log into game state. Pure: no side effects. */
export function reduce(
  events: ApplicableEvent[],
  config: GameConfig = DEFAULT_CONFIG,
): GameState {
  let state = emptyState(config);
  for (const e of events) state = applyEvent(state, e);
  return state;
}

/**
 * Reduce while tolerating illegal events: any event that fails to apply is
 * skipped. The skip set is deterministic from the ordered log, so every client
 * converges to the same state even if a conflicting event was appended.
 */
export function reduceSafe(
  events: ApplicableEvent[],
  config: GameConfig = DEFAULT_CONFIG,
): { state: GameState; skipped: number } {
  let state = emptyState(config);
  let skipped = 0;
  for (const e of events) {
    try {
      state = applyEvent(state, e);
    } catch (err) {
      if (err instanceof GameError) {
        skipped++;
        continue;
      }
      throw err;
    }
  }
  return { state, skipped };
}

/** Non-throwing validation helper for the UI. */
export function tryApply(
  state: GameState,
  e: ApplicableEvent,
): { ok: true } | { ok: false; error: string } {
  try {
    applyEvent(state, e);
    return { ok: true };
  } catch (err) {
    if (err instanceof GameError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Apply a single event, returning a new state. Throws GameError if illegal. */
export function applyEvent(prev: GameState, e: ApplicableEvent): GameState {
  const s: GameState = structuredClone(prev);

  switch (e.type) {
    case "game_created": {
      const p = e.payload as EventPayloads["game_created"];
      s.seed = p.seed;
      s.phase = "lobby";
      s.round = 0;
      if (p.players) {
        for (const player of p.players) addPlayer(s, player);
      }
      return s;
    }

    case "player_joined": {
      const p = e.payload as EventPayloads["player_joined"];
      addPlayer(s, p.player);
      if (s.players.length === 2 && s.phase === "lobby") startRound(s);
      return s;
    }

    case "draw_stock": {
      requireTurn(s, e.actor);
      requirePhase(s, "draw", "You must draw to start your turn.");
      if (s.stock.length === 0) {
        throw new GameError("The stock is empty — the round must end.");
      }
      const card = s.stock.pop()!;
      hand(s, e.actor).push(card);
      s.turnPhase = "meld";
      return s;
    }

    case "take_discard_pile": {
      requireTurn(s, e.actor);
      requirePhase(s, "draw", "You must draw to start your turn.");
      if (s.discard.length === 0) {
        throw new GameError("The discard pile is empty.");
      }
      hand(s, e.actor).push(...s.discard);
      s.discard = [];
      s.turnPhase = "meld";
      return s;
    }

    case "meld_new": {
      requireTurn(s, e.actor);
      requirePhase(s, "meld", "Draw before you meld.");
      const p = e.payload as EventPayloads["meld_new"];
      if (findMeld(s, e.actor, p.meldId)) {
        throw new GameError("A meld with that id already exists.");
      }
      const kind = validateMeld(p.cards, s.config);
      if (!kind.valid) throw new GameError(kind.reason ?? "Invalid meld.");
      const rest = removeFromHand(hand(s, e.actor), p.cards);
      const meld: Meld = { meldId: p.meldId, cards: [...p.cards] };
      s.hands[e.actor] = rest;
      s.melds[e.actor].push(meld);
      assertHandAfterMeld(s, e.actor);
      return s;
    }

    case "meld_extend": {
      requireTurn(s, e.actor);
      requirePhase(s, "meld", "Draw before you meld.");
      const p = e.payload as EventPayloads["meld_extend"];
      const meld = findMeld(s, e.actor, p.meldId);
      if (!meld) throw new GameError("No such meld to extend.");
      const combined = [...meld.cards, ...p.cards];
      const kind = validateMeld(combined, s.config);
      if (!kind.valid) {
        throw new GameError(kind.reason ?? "Those cards don't extend the meld.");
      }
      const rest = removeFromHand(hand(s, e.actor), p.cards);
      s.hands[e.actor] = rest;
      meld.cards = combined;
      assertHandAfterMeld(s, e.actor);
      return s;
    }

    case "take_morto": {
      requireTurn(s, e.actor);
      requirePhase(s, "meld", "You can only take the morto during your turn.");
      const p = e.payload as EventPayloads["take_morto"];
      if (hand(s, e.actor).length !== 0) {
        throw new GameError("You can only take the morto once your hand is empty.");
      }
      if (s.mortoTaken[e.actor]) {
        throw new GameError("You have already taken a morto this round.");
      }
      const pile = s.mortos[p.mortoIndex];
      if (!pile || pile.length === 0) {
        throw new GameError("That morto is not available.");
      }
      s.hands[e.actor] = pile;
      s.mortos[p.mortoIndex] = [];
      s.mortoTaken[e.actor] = true;
      return s;
    }

    case "discard": {
      requireTurn(s, e.actor);
      requirePhase(s, "meld", "Draw before you discard.");
      const p = e.payload as EventPayloads["discard"];
      const rest = removeFromHand(hand(s, e.actor), [p.card]);
      s.hands[e.actor] = rest;
      s.discard.push(p.card);

      if (rest.length > 0) {
        endTurn(s);
        return s;
      }
      // Hand is now empty.
      if (!s.mortoTaken[e.actor] && hasAvailableMorto(s)) {
        // Going down into the pot: keep the turn, the player must take a morto.
        return s;
      }
      if (s.mortoTaken[e.actor] && hasBuraco(s, e.actor)) {
        goOut(s);
        return s;
      }
      // Pathological: morto already taken, no buraco. Pass the turn with an
      // empty hand; the player refills by drawing next turn.
      endTurn(s);
      return s;
    }

    case "go_out": {
      requireTurn(s, e.actor);
      requirePhase(s, "meld", "You can only go out during your turn.");
      if (hand(s, e.actor).length !== 0) {
        throw new GameError("Meld or discard all your cards before going out.");
      }
      if (!s.mortoTaken[e.actor]) {
        throw new GameError("You must take a morto before going out.");
      }
      if (!hasBuraco(s, e.actor)) {
        throw new GameError("You need at least one buraco before going out.");
      }
      goOut(s);
      return s;
    }

    case "round_scored": {
      if (s.phase !== "roundOver") {
        throw new GameError("No round is waiting to be scored.");
      }
      const p = e.payload as EventPayloads["round_scored"];
      s.lastRoundScores = p.scores;
      for (const player of s.players) {
        s.scores[player] = (s.scores[player] ?? 0) + (p.scores[player]?.total ?? 0);
      }
      s.round += 1;
      const reachedTarget = s.players.some(
        (pl) => s.scores[pl] >= s.config.target,
      );
      if (reachedTarget) {
        s.phase = "matchOver";
      } else {
        startRound(s);
      }
      return s;
    }

    default: {
      throw new GameError(`Unknown event type: ${(e as ApplicableEvent).type}`);
    }
  }
}

// ---- helpers ---------------------------------------------------------------

function addPlayer(s: GameState, player: PlayerId): void {
  if (s.players.includes(player)) return;
  if (s.players.length >= 2) {
    throw new GameError("This game already has two players.");
  }
  s.players.push(player);
  s.scores[player] = s.scores[player] ?? 0;
}

function startRound(s: GameState): void {
  const [p0, p1] = s.players;
  const d = deal(roundSeed(s.seed, s.round));
  s.hands = { [p0]: d.hands[0], [p1]: d.hands[1] };
  s.melds = { [p0]: [], [p1]: [] };
  s.mortoTaken = { [p0]: false, [p1]: false };
  s.stock = d.stock;
  s.discard = d.discard;
  s.mortos = d.mortos;
  s.turn = s.round % 2; // alternate the starting player each round
  s.turnPhase = "draw";
  s.phase = "playing";
  s.wentOut = null;
}

function requireTurn(s: GameState, actor: string): void {
  if (s.phase !== "playing") {
    throw new GameError("The game is not in play.");
  }
  if (s.players[s.turn] !== actor) {
    throw new GameError("It's not your turn.");
  }
}

function requirePhase(
  s: GameState,
  phase: GameState["turnPhase"],
  msg: string,
): void {
  if (s.turnPhase !== phase) throw new GameError(msg);
}

function hand(s: GameState, actor: string): Card[] {
  return s.hands[actor] ?? (s.hands[actor] = []);
}

function findMeld(s: GameState, actor: string, meldId: string): Meld | undefined {
  return (s.melds[actor] ?? []).find((m) => m.meldId === meldId);
}

function hasBuraco(s: GameState, actor: string): boolean {
  return (s.melds[actor] ?? []).some(isBuraco);
}

function hasAvailableMorto(s: GameState): boolean {
  return s.mortos.some((m) => m.length > 0);
}

/** Remove the given cards (by id) from a hand, returning the remainder. */
function removeFromHand(handCards: Card[], cards: Card[]): Card[] {
  const rest = handCards.slice();
  for (const card of cards) {
    const idx = rest.findIndex((c) => c.id === card.id);
    if (idx === -1) {
      throw new GameError("You don't hold one of those cards.");
    }
    rest.splice(idx, 1);
  }
  return rest;
}

/**
 * A meld that empties the hand is only legal if it leads to a legal next move:
 * either the player can still take a morto, or they already hold a buraco and
 * can go out. Call AFTER the meld has been applied to state so the just-played
 * meld is counted. Throws if the play would strand the player.
 */
function assertHandAfterMeld(s: GameState, actor: string): void {
  if (hand(s, actor).length > 0) return;
  const canTakeMorto = !s.mortoTaken[actor] && hasAvailableMorto(s);
  if (canTakeMorto) return;
  if (s.mortoTaken[actor] && hasBuraco(s, actor)) return;
  throw new GameError(
    "You can't play your last card unless you take a morto or have a buraco — keep one to discard.",
  );
}

function endTurn(s: GameState): void {
  s.turn = (s.turn + 1) % s.players.length;
  s.turnPhase = "draw";
}

function goOut(s: GameState): void {
  s.phase = "roundOver";
  s.wentOut = s.turn;
}

// ---- selectors -------------------------------------------------------------

export function activePlayer(s: GameState): PlayerId | null {
  return s.players[s.turn] ?? null;
}

export function topOfDiscard(s: GameState): Card | null {
  return s.discard.length ? s.discard[s.discard.length - 1] : null;
}
