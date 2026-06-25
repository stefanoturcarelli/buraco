import type { GameState, PlayerId, RoundScoreLine } from "./types";
import { cardValue, isBuraco, validateMeld } from "./rules";

export function scoreRound(state: GameState): Record<PlayerId, RoundScoreLine> {
  const out: Record<PlayerId, RoundScoreLine> = {};
  const wentOutId = state.wentOut != null ? state.players[state.wentOut] : null;

  for (const player of state.players) {
    let meldPoints = 0;
    let buracoBonus = 0;

    for (const meld of state.melds[player] ?? []) {
      for (const card of meld.cards) meldPoints += cardValue(card);
      if (isBuraco(meld)) {
        const kind = validateMeld(meld.cards, state.config);
        buracoBonus += kind.dirty ? 100 : 200;
      }
    }

    let handPenalty = 0;
    for (const card of state.hands[player] ?? []) {
      handPenalty -= cardValue(card);
    }

    const mortoPenalty = state.mortoTaken[player] ? 0 : -100;
    const goOutBonus = player === wentOutId ? 100 : 0;

    out[player] = {
      meldPoints,
      buracoBonus,
      goOutBonus,
      mortoPenalty,
      handPenalty,
      total: meldPoints + buracoBonus + goOutBonus + mortoPenalty + handPenalty,
    };
  }
  return out;
}
