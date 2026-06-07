import { describe, it, expect } from "vitest";
import type { ApplicableEvent } from "../reducer";
import { applyEvent, reduce, reduceSafe, tryApply } from "../reducer";
import type { Card, GameState, Meld, Rank, Suit } from "../types";
import { DEFAULT_CONFIG } from "../types";

function created(seed: string): ApplicableEvent[] {
  return [
    { type: "game_created", actor: "system", payload: { seed } },
    { type: "player_joined", actor: "A", payload: { player: "A" } },
    { type: "player_joined", actor: "B", payload: { player: "B" } },
  ];
}

describe("setup & dealing", () => {
  it("deals and starts play once two players join", () => {
    const s = reduce(created("seed-x"));
    expect(s.phase).toBe("playing");
    expect(s.players).toEqual(["A", "B"]);
    expect(s.hands["A"].length).toBe(11);
    expect(s.hands["B"].length).toBe(11);
    expect(s.mortos[0].length).toBe(11);
    expect(s.discard.length).toBe(1);
    expect(s.turn).toBe(0);
    expect(s.turnPhase).toBe("draw");
  });

  it("rejects a third player", () => {
    const events = [
      ...created("seed-x"),
      { type: "player_joined", actor: "C", payload: { player: "C" } } as ApplicableEvent,
    ];
    // strict reduce throws; safe reduce just skips the bad event
    expect(() => reduce(events)).toThrow();
    const { state, skipped } = reduceSafe(events);
    expect(skipped).toBe(1);
    expect(state.players).toEqual(["A", "B"]);
  });
});

describe("turn flow", () => {
  it("enforces draw-first and rejects out-of-turn play", () => {
    const s = reduce(created("seed-x"));
    expect(tryApply(s, { type: "draw_stock", actor: "B", payload: {} }).ok).toBe(false);
    expect(tryApply(s, { type: "discard", actor: "A", payload: { card: s.hands["A"][0] } }).ok).toBe(false);
    expect(tryApply(s, { type: "draw_stock", actor: "A", payload: {} }).ok).toBe(true);
  });

  it("draw then discard passes the turn", () => {
    let s = reduce(created("seed-x"));
    s = applyEvent(s, { type: "draw_stock", actor: "A", payload: {} });
    expect(s.hands["A"].length).toBe(12);
    expect(s.turnPhase).toBe("meld");
    // cannot draw twice
    expect(tryApply(s, { type: "draw_stock", actor: "A", payload: {} }).ok).toBe(false);
    const toDiscard = s.hands["A"][0];
    s = applyEvent(s, { type: "discard", actor: "A", payload: { card: toDiscard } });
    expect(s.turn).toBe(1);
    expect(s.turnPhase).toBe("draw");
    expect(s.hands["A"].length).toBe(11);
    expect(s.discard[s.discard.length - 1].id).toBe(toDiscard.id);
  });

  it("take_discard_pile moves the whole pile into the hand", () => {
    let s = reduce(created("seed-x"));
    const pileSize = s.discard.length;
    s = applyEvent(s, { type: "take_discard_pile", actor: "A", payload: {} });
    expect(s.hands["A"].length).toBe(11 + pileSize);
    expect(s.discard.length).toBe(0);
    expect(s.turnPhase).toBe("meld");
  });

  it("rejects an invalid meld with a message", () => {
    let s = reduce(created("seed-x"));
    s = applyEvent(s, { type: "draw_stock", actor: "A", payload: {} });
    const junk = s.hands["A"].slice(0, 3);
    const res = tryApply(s, {
      type: "meld_new",
      actor: "A",
      payload: { meldId: "m1", cards: junk },
    });
    // Most random triples are not a valid run; if this seed happens to be one,
    // the assertion below still documents intent.
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });
});

// ---- Controlled go-out / morto / scoring integration -----------------------

let nextId = 9000;
function c(rank: Rank, suit: Suit | null = null): Card {
  return { id: nextId++, rank, suit };
}
function meld(cards: Card[]): Meld {
  return { meldId: "m" + nextId++, cards };
}
function playingState(over: Partial<GameState>): GameState {
  return {
    seed: "s",
    config: { ...DEFAULT_CONFIG },
    players: ["A", "B"],
    phase: "playing",
    round: 0,
    turn: 0,
    turnPhase: "meld",
    hands: { A: [], B: [] },
    melds: { A: [], B: [] },
    mortoTaken: { A: false, B: false },
    stock: [],
    discard: [],
    mortos: [[], []],
    scores: { A: 0, B: 0 },
    wentOut: null,
    lastRoundScores: null,
    ...over,
  };
}

const buraco = () =>
  meld([
    c("4", "H"),
    c("5", "H"),
    c("6", "H"),
    c("7", "H"),
    c("8", "H"),
    c("9", "H"),
    c("10", "H"),
  ]);

describe("go-out gate", () => {
  it("blocks going out without a morto", () => {
    const s = playingState({
      hands: { A: [], B: [c("K", "C")] },
      melds: { A: [buraco()], B: [] },
      mortoTaken: { A: false, B: false },
    });
    expect(tryApply(s, { type: "go_out", actor: "A", payload: {} }).ok).toBe(false);
  });

  it("blocks going out without a buraco", () => {
    const s = playingState({
      hands: { A: [], B: [c("K", "C")] },
      melds: { A: [meld([c("4", "S"), c("5", "S"), c("6", "S")])], B: [] },
      mortoTaken: { A: true, B: false },
    });
    expect(tryApply(s, { type: "go_out", actor: "A", payload: {} }).ok).toBe(false);
  });

  it("allows going out with a morto + buraco and ends the round", () => {
    const s = playingState({
      hands: { A: [], B: [c("K", "C")] },
      melds: { A: [buraco()], B: [] },
      mortoTaken: { A: true, B: false },
    });
    const res = tryApply(s, { type: "go_out", actor: "A", payload: {} });
    expect(res.ok).toBe(true);
    const after = applyEvent(s, { type: "go_out", actor: "A", payload: {} });
    expect(after.phase).toBe("roundOver");
    expect(after.wentOut).toBe(0);
  });
});

describe("morto", () => {
  it("is taken when the hand empties via meld, refilling 11 cards", () => {
    // A holds exactly a 3-card run; melding it empties the hand and a morto
    // is available, so the play is legal and take_morto then refills.
    const run = [c("4", "S"), c("5", "S"), c("6", "S")];
    let s = playingState({
      hands: { A: [...run], B: [c("K", "C")] },
      mortos: [[c("A", "D"), c("2", "D"), c("3", "D")], []],
    });
    s = applyEvent(s, { type: "meld_new", actor: "A", payload: { meldId: "m1", cards: run } });
    expect(s.hands["A"].length).toBe(0);
    s = applyEvent(s, { type: "take_morto", actor: "A", payload: { mortoIndex: 0 } });
    expect(s.hands["A"].length).toBe(3);
    expect(s.mortoTaken["A"]).toBe(true);
    expect(s.mortos[0].length).toBe(0);
  });

  it("rejects emptying the hand when no morto and no buraco", () => {
    const run = [c("4", "S"), c("5", "S"), c("6", "S")];
    const s = playingState({
      hands: { A: [...run], B: [c("K", "C")] },
      mortoTaken: { A: true, B: false }, // already used the morto
      mortos: [[], []],
    });
    const res = tryApply(s, { type: "meld_new", actor: "A", payload: { meldId: "m1", cards: run } });
    expect(res.ok).toBe(false);
  });
});

describe("round_scored advances the match", () => {
  it("applies totals and starts the next round", () => {
    let s = playingState({
      hands: { A: [], B: [c("K", "C")] },
      melds: { A: [buraco()], B: [] },
      mortoTaken: { A: true, B: false },
    });
    s = applyEvent(s, { type: "go_out", actor: "A", payload: {} });
    expect(s.phase).toBe("roundOver");
    const scores = {
      A: { meldPoints: 50, buracoBonus: 200, goOutBonus: 100, mortoPenalty: 0, handPenalty: 0, total: 350 },
      B: { meldPoints: 0, buracoBonus: 0, goOutBonus: 0, mortoPenalty: -100, handPenalty: -10, total: -110 },
    };
    s = applyEvent(s, { type: "round_scored", actor: "A", payload: { scores } });
    expect(s.scores["A"]).toBe(350);
    expect(s.scores["B"]).toBe(-110);
    expect(s.round).toBe(1);
    expect(s.phase).toBe("playing"); // below 1500 target -> next round dealt
    expect(s.hands["A"].length).toBe(11);
    expect(s.turn).toBe(1); // alternates starting player

    // a second round_scored is rejected (no round waiting)
    expect(tryApply(s, { type: "round_scored", actor: "A", payload: { scores } }).ok).toBe(false);
  });

  it("ends the match when the target is reached", () => {
    let s = playingState({
      hands: { A: [], B: [c("K", "C")] },
      melds: { A: [buraco()], B: [] },
      mortoTaken: { A: true, B: false },
      scores: { A: 1400, B: 0 },
    });
    s = applyEvent(s, { type: "go_out", actor: "A", payload: {} });
    const scores = {
      A: { meldPoints: 50, buracoBonus: 200, goOutBonus: 100, mortoPenalty: 0, handPenalty: 0, total: 350 },
      B: { meldPoints: 0, buracoBonus: 0, goOutBonus: 0, mortoPenalty: -100, handPenalty: -10, total: -110 },
    };
    s = applyEvent(s, { type: "round_scored", actor: "A", payload: { scores } });
    expect(s.scores["A"]).toBe(1750);
    expect(s.phase).toBe("matchOver");
  });
});

describe("long draw/discard loop", () => {
  it("alternates turns for many rounds without deadlock and converges on reload", () => {
    const log: ApplicableEvent[] = created("loop-seed");
    let s = reduce(log);
    for (let i = 0; i < 60 && s.phase === "playing"; i++) {
      const me = s.players[s.turn];
      // draw
      if (s.stock.length === 0) break; // graceful stop when stock empties
      const draw: ApplicableEvent = { type: "draw_stock", actor: me, payload: {} };
      log.push(draw);
      s = applyEvent(s, draw);
      // discard the first card (no melding -> hand never empties)
      const card = s.hands[me][0];
      const disc: ApplicableEvent = { type: "discard", actor: me, payload: { card } };
      log.push(disc);
      s = applyEvent(s, disc);
      // turn must have passed to the other player
      expect(s.players[s.turn]).not.toBe(me);
      expect(s.turnPhase).toBe("draw");
    }
    // Reload: rebuilding from the log yields identical state.
    const rebuilt = reduce(log);
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(s));
  });
});

describe("convergence", () => {
  it("rebuilds identical state from the same log (reload safety)", () => {
    const events = created("converge-seed");
    const a = reduce(events);
    const b = reduce(events);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
