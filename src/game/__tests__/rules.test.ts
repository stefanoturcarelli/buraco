import { describe, it, expect } from "vitest";
import type { Card, Rank, Suit } from "../types";
import { DEFAULT_CONFIG } from "../types";
import { cardValue, validateMeld, isBuraco } from "../rules";

let nextId = 1000;
function c(rank: Rank, suit: Suit | null = null): Card {
  return { id: nextId++, rank, suit };
}
const cfg = { ...DEFAULT_CONFIG, allowSets: false };
const cfgSets = { ...DEFAULT_CONFIG, allowSets: true };

describe("card values", () => {
  it("scores each rank correctly", () => {
    expect(cardValue(c("JOKER"))).toBe(30);
    expect(cardValue(c("2", "H"))).toBe(20);
    expect(cardValue(c("A", "H"))).toBe(15);
    expect(cardValue(c("K", "H"))).toBe(10);
    expect(cardValue(c("8", "H"))).toBe(10);
    expect(cardValue(c("7", "H"))).toBe(5);
    expect(cardValue(c("3", "H"))).toBe(5);
  });
});

describe("run validation", () => {
  it("accepts a clean same-suit run", () => {
    const r = validateMeld([c("4", "H"), c("5", "H"), c("6", "H")], cfg);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(false);
  });

  it("rejects mixed suits", () => {
    expect(validateMeld([c("4", "H"), c("5", "S"), c("6", "H")], cfg).valid).toBe(false);
  });

  it("rejects non-consecutive ranks", () => {
    expect(validateMeld([c("4", "H"), c("6", "H"), c("7", "H")], cfg).valid).toBe(false);
  });

  it("accepts a run with a joker filling a gap (dirty)", () => {
    const r = validateMeld([c("4", "H"), c("JOKER"), c("6", "H")], cfg);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(true);
  });

  it("accepts a run with a joker extending an end (dirty)", () => {
    const r = validateMeld([c("4", "H"), c("5", "H"), c("JOKER")], cfg);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(true);
  });

  it("accepts a 2 used as a wild filler (dirty)", () => {
    // 5-6-2(wild)-8 of hearts -> 5,6,_,8 with 2 filling rank 7
    const r = validateMeld([c("5", "H"), c("6", "H"), c("2", "H"), c("8", "H")], cfg);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(true);
  });

  it("accepts a natural 2 in its own slot (clean A-2-3)", () => {
    const r = validateMeld([c("A", "S"), c("2", "S"), c("3", "S")], cfg);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(false);
  });

  it("accepts ace-high Q-K-A", () => {
    const r = validateMeld([c("Q", "D"), c("K", "D"), c("A", "D")], cfg);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(false);
  });

  it("rejects a natural wrap-around (Q-K-A-2-3 cannot be one run)", () => {
    // A natural 2 cannot continue past the ace: K-A then a natural 3 is broken.
    expect(
      validateMeld([c("K", "C"), c("A", "C"), c("3", "C")], cfg).valid,
    ).toBe(false);
  });

  it("treats a 2 next to K-A as a wild (Q-K-A), which is legal & dirty", () => {
    const r = validateMeld([c("K", "C"), c("A", "C"), c("2", "C")], cfg);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(true);
  });

  it("rejects two wilds in one run (only one allowed)", () => {
    expect(validateMeld([c("4", "H"), c("JOKER"), c("JOKER"), c("7", "H")], cfg).valid).toBe(false);
  });

  it("rejects duplicate natural ranks in a run", () => {
    expect(validateMeld([c("5", "H"), c("5", "H"), c("6", "H")], cfg).valid).toBe(false);
  });

  it("detects a buraco at 7+ cards", () => {
    const cards = [
      c("4", "H"),
      c("5", "H"),
      c("6", "H"),
      c("7", "H"),
      c("8", "H"),
      c("9", "H"),
      c("10", "H"),
    ];
    const r = validateMeld(cards, cfg);
    expect(r.valid).toBe(true);
    expect(isBuraco({ meldId: "x", cards })).toBe(true);
  });
});

describe("set validation (flag)", () => {
  it("rejects sets when disabled", () => {
    expect(validateMeld([c("7", "H"), c("7", "S"), c("7", "D")], cfg).valid).toBe(false);
  });
  it("accepts a clean set when enabled", () => {
    const r = validateMeld([c("7", "H"), c("7", "S"), c("7", "D")], cfgSets);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(false);
  });
  it("accepts a set with one wild (dirty)", () => {
    const r = validateMeld([c("7", "H"), c("7", "S"), c("JOKER")], cfgSets);
    expect(r.valid).toBe(true);
    expect(r.dirty).toBe(true);
  });
});
