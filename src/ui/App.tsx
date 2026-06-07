import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameBackend, GameEvent, NewEvent } from "../backend/types";
import { getBackend } from "../backend/factory";
import { activePlayer, reduceSafe } from "../game/reducer";
import { scoreRound } from "../game/scoring";
import { DEFAULT_CONFIG } from "../game/types";
import { Lobby } from "./Lobby";
import { Table } from "./Table";

const HOTSEAT_IDS = ["P1", "P2"];

function readHashGame(): string | null {
  const m = location.hash.match(/[#&]g=([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

function stableMyId(): string {
  let id = localStorage.getItem("buraco:me");
  if (!id) {
    id = "u" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("buraco:me", id);
  }
  return id;
}

function mergeEvents(prev: GameEvent[], incoming: GameEvent[]): GameEvent[] {
  const byId = new Map(prev.map((e) => [e.id, e]));
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function App() {
  const [backend, setBackend] = useState<GameBackend | null>(null);
  const [backendName, setBackendName] = useState("local");
  const [gameId, setGameId] = useState<string | null>(readHashGame());
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const myStableId = useMemo(stableMyId, []);
  const isHotseat = backendName !== "supabase";

  // Load the configured backend once.
  useEffect(() => {
    getBackend().then(({ backend, name }) => {
      setBackend(backend);
      setBackendName(name);
    });
  }, []);

  // Keep gameId in sync with the URL hash (shareable links / back button).
  useEffect(() => {
    const onHash = () => setGameId(readHashGame());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const lastId = events.length ? events[events.length - 1].id : 0;
  const lastIdRef = useRef(0);
  lastIdRef.current = lastId;

  // Load + subscribe + safety poll for the current game.
  useEffect(() => {
    if (!backend || !gameId) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    backend.getEvents(gameId, 0).then((evs) => {
      if (!cancelled) setEvents((prev) => mergeEvents(prev, evs));
    });
    const unsub = backend.subscribe?.(gameId, (ev) => {
      setEvents((prev) => mergeEvents(prev, [ev]));
    });
    const intervalMs = backend.subscribe ? 5000 : 2000;
    const poll = setInterval(async () => {
      try {
        const evs = await backend.getEvents(gameId, lastIdRef.current);
        if (evs.length) setEvents((prev) => mergeEvents(prev, evs));
      } catch {
        /* transient; next tick retries */
      }
    }, intervalMs);
    return () => {
      cancelled = true;
      unsub?.();
      clearInterval(poll);
    };
  }, [backend, gameId]);

  const { state } = useMemo(
    () => reduceSafe(events, DEFAULT_CONFIG),
    [events],
  );

  // Identity: hotseat controls whoever is to act; online has a fixed seat.
  const meId = isHotseat ? activePlayer(state) ?? HOTSEAT_IDS[0] : myStableId;
  const isMyTurn = isHotseat
    ? true
    : state.phase === "playing" && state.players[state.turn] === meId;

  const append = useCallback(
    async (e: NewEvent) => {
      if (!backend || !gameId) return;
      try {
        const ev = await backend.appendEvent(gameId, e);
        setEvents((prev) => mergeEvents(prev, [ev]));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [backend, gameId],
  );

  // Online: join the game once if there's room and we're not already in.
  const joinedRef = useRef(false);
  useEffect(() => {
    if (isHotseat || !gameId || !backend) return;
    if (events.length === 0) return; // wait for initial load
    if (state.players.includes(myStableId)) {
      joinedRef.current = true;
      return;
    }
    if (state.players.length >= 2 || joinedRef.current) return;
    joinedRef.current = true;
    append({ type: "player_joined", actor: myStableId, payload: { player: myStableId } });
  }, [isHotseat, gameId, backend, events.length, state, myStableId, append]);

  // Auto-score a finished round once, by the player who went out.
  const scoredRef = useRef<string>("");
  useEffect(() => {
    if (state.phase !== "roundOver" || state.wentOut == null) return;
    const winner = state.players[state.wentOut];
    const key = `${gameId}:${state.round}`;
    if (scoredRef.current === key) return;
    const iAmWinner = isHotseat ? meId === winner : myStableId === winner;
    if (!iAmWinner) return;
    scoredRef.current = key;
    const scores = scoreRound(state);
    append({ type: "round_scored", actor: winner, payload: { scores } });
  }, [state, gameId, isHotseat, meId, myStableId, append]);

  async function handleCreate() {
    if (!backend) return;
    const seed = crypto.randomUUID();
    const { gameId: id } = await backend.createGame(seed);
    if (isHotseat) {
      await backend.appendEvent(id, {
        type: "player_joined",
        actor: HOTSEAT_IDS[0],
        payload: { player: HOTSEAT_IDS[0] },
      });
      await backend.appendEvent(id, {
        type: "player_joined",
        actor: HOTSEAT_IDS[1],
        payload: { player: HOTSEAT_IDS[1] },
      });
    } else {
      await backend.appendEvent(id, {
        type: "player_joined",
        actor: myStableId,
        payload: { player: myStableId },
      });
    }
    location.hash = `g=${id}`;
    setGameId(id);
  }

  function handleJoin(code: string) {
    location.hash = `g=${code}`;
    setGameId(code);
  }

  function leave() {
    location.hash = "";
    setGameId(null);
    setEvents([]);
    joinedRef.current = false;
    scoredRef.current = "";
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: "4px 0" }}>Buraco</h1>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
        backend: {backendName}
        {!isHotseat && <> · you: {myStableId}</>}
      </div>
      {error && (
        <div style={{ background: "#fdd", border: "1px solid #c00", padding: 8, marginBottom: 8 }}>
          {error}
        </div>
      )}
      {!gameId ? (
        <Lobby onCreate={handleCreate} onJoin={handleJoin} hotseat={isHotseat} />
      ) : (
        <Table
          state={state}
          gameId={gameId}
          meId={meId}
          isMyTurn={isMyTurn}
          hotseat={isHotseat}
          onAppend={append}
          onError={setError}
          onLeave={leave}
        />
      )}
    </div>
  );
}
