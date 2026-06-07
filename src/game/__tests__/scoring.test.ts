import { describe, it, expect } from "vitest";
import type { Card, GameState, Meld, Rank, Suit } from "../types";
import { DEFAULT_CONFIG } from "../types";
import { scoreRound } from "../scoring";

let nextId = 5000;
function c(rank: Rank, suit: Suit | null = null): Card {
  return { id: nextId++, rank, suit };
}
function meld(cards: Card[]): Meld {
  return { meldId: "m" + nextId++, cards };
}

function baseState(over: Partial<GameState>): GameState {
  const players = ["A", "B"];
  return {
    seed: "s",
    config: { ...DEFAULT_CONFIG },
    players,
    phase: "roundOver",
    round: 0,
    turn: 0,
    turnPhase: "meld",
    hands: { A: [], B: [] },
    melds: { A: [], B: [] },
    mortoTaken: { A: false, B: false },
    stock: [],
    discard: [],
    mortos: [],
    scores: { A: 0, B: 0 },
    wentOut: 0,
    lastRoundScores: null,
    ...over,
  };
}

describe("scoreRound (hand-worked example)", () => {
  it("matches the manual calculation", () => {
    // Player A goes out: clean buraco 4-10 hearts (+200) + a 3-4-5 spades run.
    const cleanBuraco = meld([
      c("4", "H"),
      c("5", "H"),
      c("6", "H"),
      c("7", "H"),
      c("8", "H"),
      c("9", "H"),
      c("10", "H"),
    ]); // 4 cards @5 (20) + 3 cards @10 (30) = 50 melded
    const sideRun = meld([c("3", "S"), c("4", "S"), c("5", "S")]); // 15 melded

    // Player B: dirty buraco 5-10 diamonds + joker (+100), leftover hand K + 2.
    const dirtyBuraco = meld([
      c("5", "D"),
      c("6", "D"),
      c("7", "D"),
      c("8", "D"),
      c("9", "D"),
      c("10", "D"),
      c("JOKER"),
    ]); // 5,6,7 @5 (15) + 8,9,10 @10 (30) + joker 30 = 75 melded

    const state = baseState({
      melds: { A: [cleanBuraco, sideRun], B: [dirtyBuraco] },
      hands: { A: [], B: [c("K", "C"), c("2", "C")] },
      mortoTaken: { A: true, B: false },
      wentOut: 0, // A went out
    });

    const s = scoreRound(state);

    // A: melded 50+15=65, +200 clean buraco, +100 go out, morto 0, hand 0
    expect(s.A.meldPoints).toBe(65);
    expect(s.A.buracoBonus).toBe(200);
    expect(s.A.goOutBonus).toBe(100);
    expect(s.A.mortoPenalty).toBe(0);
    expect(s.A.handPenalty).toBe(0);
    expect(s.A.total).toBe(365);

    // B: melded 75, +100 dirty buraco, no go out, -100 no morto, hand -(10+20)=-30
    expect(s.B.meldPoints).toBe(75);
    expect(s.B.buracoBonus).toBe(100);
    expect(s.B.goOutBonus).toBe(0);
    expect(s.B.mortoPenalty).toBe(-100);
    expect(s.B.handPenalty).toBe(-30);
    expect(s.B.total).toBe(45);
  });

  it("applies the morto penalty and hand penalty with no melds", () => {
    const state = baseState({
      melds: { A: [], B: [] },
      hands: { A: [c("A", "H")], B: [c("JOKER")] },
      mortoTaken: { A: false, B: false },
      wentOut: null,
      phase: "roundOver",
    });
    const s = scoreRound(state);
    expect(s.A.total).toBe(-100 - 15);
    expect(s.B.total).toBe(-100 - 30);
  });
});
