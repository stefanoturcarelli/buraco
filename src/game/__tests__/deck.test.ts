import { describe, it, expect } from "vitest";
import { buildDeck, deal, roundSeed } from "../deck";

describe("deck", () => {
  it("builds 108 unique cards (2 decks + 4 jokers)", () => {
    const deck = buildDeck();
    expect(deck.length).toBe(108);
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(108);
    expect(deck.filter((c) => c.rank === "JOKER").length).toBe(4);
    // 8 of each rank/suit? no: 2 of each of 52 = 104 + 4 jokers
    expect(deck.filter((c) => c.rank === "A").length).toBe(8);
  });

  it("deals 11+11 hands, two mortos of 11, one discard, rest stock", () => {
    const d = deal("seed-1");
    expect(d.hands[0].length).toBe(11);
    expect(d.hands[1].length).toBe(11);
    expect(d.mortos[0].length).toBe(11);
    expect(d.mortos[1].length).toBe(11);
    expect(d.discard.length).toBe(1);
    expect(d.stock.length).toBe(108 - 44 - 1);
    const all = [
      ...d.hands[0],
      ...d.hands[1],
      ...d.mortos[0],
      ...d.mortos[1],
      ...d.stock,
      ...d.discard,
    ];
    expect(new Set(all.map((c) => c.id)).size).toBe(108);
  });

  it("is deterministic from the seed", () => {
    const a = deal("same");
    const b = deal("same");
    expect(a.hands[0].map((c) => c.id)).toEqual(b.hands[0].map((c) => c.id));
    const c = deal("different");
    expect(a.hands[0].map((x) => x.id)).not.toEqual(c.hands[0].map((x) => x.id));
  });

  it("derives distinct per-round seeds", () => {
    expect(roundSeed("base", 0)).not.toBe(roundSeed("base", 1));
  });
});
