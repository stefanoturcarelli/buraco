import type { Card, Suit } from "../game/types";

const SUIT_SYMBOL: Record<Suit, string> = {
  C: "♣", // ♣
  D: "♦", // ♦
  H: "♥", // ♥
  S: "♠", // ♠
};

export function isRed(suit: Suit | null): boolean {
  return suit === "D" || suit === "H";
}

export function cardLabel(card: Card): string {
  if (card.rank === "JOKER") return "🃏"; // 🃏
  return `${card.rank}${card.suit ? SUIT_SYMBOL[card.suit] : ""}`;
}

export function CardChip({
  card,
  selected,
  onClick,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
}) {
  const color =
    card.rank === "JOKER" ? "#7a3" : isRed(card.suit) ? "#c00" : "#000";
  return (
    <button
      onClick={onClick}
      style={{
        font: "inherit",
        fontSize: 18,
        minWidth: 40,
        padding: "6px 8px",
        margin: 2,
        color,
        background: selected ? "#ffe9a8" : "#fff",
        border: selected ? "2px solid #d8a400" : "1px solid #999",
        borderRadius: 6,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {cardLabel(card)}
    </button>
  );
}

export function CardRow({ cards }: { cards: Card[] }) {
  return (
    <span>
      {cards.map((c) => (
        <CardChip key={c.id} card={c} />
      ))}
    </span>
  );
}
