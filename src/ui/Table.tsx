import { useState } from "react";
import type { NewEvent } from "../backend/types";
import type { Card, GameState, PlayerId, RoundScoreLine } from "../game/types";
import { tryApply } from "../game/reducer";
import { isBuraco, validateMeld } from "../game/rules";
import { CardChip, CardRow } from "./cards";

export function Table({
  state,
  gameId,
  meId,
  isMyTurn,
  hotseat,
  onAppend,
  onError,
  onLeave,
}: {
  state: GameState;
  gameId: string;
  meId: PlayerId;
  isMyTurn: boolean;
  hotseat: boolean;
  onAppend: (e: NewEvent) => void;
  onError: (msg: string | null) => void;
  onLeave: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const myHand = state.hands[meId] ?? [];
  const meIdx = state.players.indexOf(meId);
  const oppId = state.players[meIdx === 0 ? 1 : 0];
  const canAct = isMyTurn && state.phase === "playing";

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectedCards(): Card[] {
    return myHand.filter((c) => selected.has(c.id));
  }

  function act(e: NewEvent) {
    const res = tryApply(state, e);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    onError(null);
    setSelected(new Set());
    onAppend(e);
  }

  const ev = (type: NewEvent["type"], payload: unknown): NewEvent =>
    ({ type, actor: meId, payload } as NewEvent);

  // --- lobby / match-over banners ---
  if (state.phase === "lobby") {
    return (
      <div>
        <ShareBar gameId={gameId} onLeave={onLeave} />
        <p>Waiting for the second player to join…</p>
        {state.players.length > 0 && <p>Players in: {state.players.join(", ")}</p>}
      </div>
    );
  }

  return (
    <div>
      <ShareBar gameId={gameId} onLeave={onLeave} />

      <ScoreHeader state={state} meId={meId} oppId={oppId} />

      {state.lastRoundScores && (
        <LastRound scores={state.lastRoundScores} players={state.players} />
      )}

      {state.phase === "matchOver" ? (
        <MatchOver state={state} />
      ) : (
        <>
          <TurnBanner state={state} hotseat={hotseat} isMyTurn={isMyTurn} />

          {/* Opponent */}
          <section style={panel}>
            <h3 style={h3}>Opponent ({oppId}) — {(state.hands[oppId] ?? []).length} cards</h3>
            <Melds melds={state.melds[oppId] ?? []} config={state.config} />
          </section>

          {/* Center: stock / discard / mortos */}
          <section style={panel}>
            <div>Stock: {state.stock.length} cards</div>
            <div>
              Discard ({state.discard.length}):{" "}
              {state.discard.length ? (
                <CardChip card={state.discard[state.discard.length - 1]} />
              ) : (
                "empty"
              )}
            </div>
            <div>
              Mortos left:{" "}
              {state.mortos.map((m, i) => (
                <span key={i} style={{ marginRight: 8 }}>
                  #{i}: {m.length}
                </span>
              ))}
            </div>
          </section>

          {/* My melds */}
          <section style={panel}>
            <h3 style={h3}>Your melds ({meId})</h3>
            <Melds
              melds={state.melds[meId] ?? []}
              config={state.config}
              onExtend={
                canAct && state.turnPhase === "meld"
                  ? (meldId) =>
                      act(ev("meld_extend", { meldId, cards: selectedCards() }))
                  : undefined
              }
            />
          </section>

          {/* My hand */}
          <section style={panel}>
            <h3 style={h3}>Your hand — {myHand.length} cards</h3>
            <div>
              {myHand.map((c) => (
                <CardChip
                  key={c.id}
                  card={c}
                  selected={selected.has(c.id)}
                  onClick={() => toggle(c.id)}
                />
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Tap cards to select them, then use a button below.
            </div>
          </section>

          {/* Actions */}
          <section style={panel}>
            {!canAct && <p>Not your turn — actions disabled.</p>}
            {canAct && state.turnPhase === "draw" && (
              <div>
                <button onClick={() => act(ev("draw_stock", {}))} style={btn}>
                  Draw from stock
                </button>
                <button
                  onClick={() => act(ev("take_discard_pile", {}))}
                  style={btn}
                  disabled={state.discard.length === 0}
                >
                  Take discard pile ({state.discard.length})
                </button>
              </div>
            )}
            {canAct && state.turnPhase === "meld" && (
              <div>
                <button
                  onClick={() => act(ev("meld_new", { meldId: newMeldId(), cards: selectedCards() }))}
                  style={btn}
                  disabled={selected.size < 3}
                >
                  Meld selected as new ({selected.size})
                </button>
                <button
                  onClick={() => {
                    const cards = selectedCards();
                    if (cards.length !== 1) {
                      onError("Select exactly one card to discard.");
                      return;
                    }
                    act(ev("discard", { card: cards[0] }));
                  }}
                  style={btn}
                  disabled={selected.size !== 1}
                >
                  Discard selected
                </button>
                {myHand.length === 0 &&
                  state.mortos.map((m, i) =>
                    m.length > 0 && !state.mortoTaken[meId] ? (
                      <button
                        key={i}
                        onClick={() => act(ev("take_morto", { mortoIndex: i }))}
                        style={btn}
                      >
                        Take morto #{i} ({m.length})
                      </button>
                    ) : null,
                  )}
                {myHand.length === 0 && (
                  <button onClick={() => act(ev("go_out", {}))} style={btn}>
                    Go out
                  </button>
                )}
              </div>
            )}
            {canAct && (
              <p style={{ fontSize: 12, color: "#666" }}>
                {state.turnPhase === "draw"
                  ? "Draw a card to begin your turn."
                  : "Meld/extend freely, then discard one card to end your turn."}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function newMeldId(): string {
  return "m" + Math.random().toString(36).slice(2, 8);
}

const panel: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: 10,
  margin: "8px 0",
};
const h3: React.CSSProperties = { margin: "0 0 6px", fontSize: 15 };
const btn: React.CSSProperties = {
  fontSize: 15,
  padding: "8px 12px",
  margin: 3,
};

function ShareBar({ gameId, onLeave }: { gameId: string; onLeave: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <div style={{ fontSize: 13 }}>
        Game code: <b>{gameId}</b>{" "}
        <button
          style={{ fontSize: 12 }}
          onClick={() => navigator.clipboard?.writeText(location.href)}
        >
          copy link
        </button>
      </div>
      <button style={{ fontSize: 12 }} onClick={onLeave}>
        leave
      </button>
    </div>
  );
}

function ScoreHeader({
  state,
  meId,
  oppId,
}: {
  state: GameState;
  meId: PlayerId;
  oppId: PlayerId;
}) {
  return (
    <div style={{ ...panel, display: "flex", gap: 16, fontSize: 14 }}>
      <div>Round {state.round + 1}</div>
      <div>Target {state.config.target}</div>
      <div>
        You ({meId}): <b>{state.scores[meId] ?? 0}</b>
      </div>
      <div>
        Opp ({oppId}): <b>{state.scores[oppId] ?? 0}</b>
      </div>
    </div>
  );
}

function TurnBanner({
  state,
  hotseat,
  isMyTurn,
}: {
  state: GameState;
  hotseat: boolean;
  isMyTurn: boolean;
}) {
  const active = state.players[state.turn];
  const text = hotseat
    ? `Hotseat — ${active} to act (${state.turnPhase}). Pass the device.`
    : isMyTurn
      ? `Your turn (${state.turnPhase}).`
      : `Waiting for ${active}…`;
  return (
    <div
      style={{
        ...panel,
        background: isMyTurn || hotseat ? "#e7f7e7" : "#f3f3f3",
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  );
}

function Melds({
  melds,
  config,
  onExtend,
}: {
  melds: GameState["melds"][string];
  config: GameState["config"];
  onExtend?: (meldId: string) => void;
}) {
  if (melds.length === 0) return <div style={{ color: "#888" }}>(none)</div>;
  return (
    <div>
      {melds.map((m) => {
        const kind = validateMeld(m.cards, config);
        const buraco = isBuraco(m);
        return (
          <div key={m.meldId} style={{ marginBottom: 4 }}>
            <CardRow cards={m.cards} />
            <span style={{ fontSize: 12, color: "#555", marginLeft: 6 }}>
              {buraco ? (kind.dirty ? "dirty buraco" : "clean buraco") : `${m.cards.length} cards`}
            </span>
            {onExtend && (
              <button style={{ fontSize: 12, marginLeft: 6 }} onClick={() => onExtend(m.meldId)}>
                add selected
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LastRound({
  scores,
  players,
}: {
  scores: Record<PlayerId, RoundScoreLine>;
  players: PlayerId[];
}) {
  return (
    <details style={panel}>
      <summary>Last round breakdown</summary>
      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={td}></th>
            <th style={td}>melds</th>
            <th style={td}>buraco</th>
            <th style={td}>go out</th>
            <th style={td}>morto</th>
            <th style={td}>hand</th>
            <th style={td}>total</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const s = scores[p];
            return (
              <tr key={p}>
                <td style={td}>{p}</td>
                <td style={td}>{s.meldPoints}</td>
                <td style={td}>{s.buracoBonus}</td>
                <td style={td}>{s.goOutBonus}</td>
                <td style={td}>{s.mortoPenalty}</td>
                <td style={td}>{s.handPenalty}</td>
                <td style={{ ...td, fontWeight: 700 }}>{s.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

const td: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "2px 8px",
  textAlign: "right",
};

function MatchOver({ state }: { state: GameState }) {
  const [a, b] = state.players;
  const winner = (state.scores[a] ?? 0) >= (state.scores[b] ?? 0) ? a : b;
  return (
    <div style={{ ...panel, background: "#fffbe6" }}>
      <h2>Match over</h2>
      <p>
        Winner: <b>{winner}</b>
      </p>
      <p>
        {a}: {state.scores[a] ?? 0} — {b}: {state.scores[b] ?? 0}
      </p>
    </div>
  );
}
