"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface GameStatusResponse {
  gameId: string;
  status: "waiting" | "playing" | "closed";
  players: string[];
  joined: boolean;
  isHost: boolean;
  expiresAt: string | null;
  error?: string;
}

export default function LobbyWaitingPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;
  const router = useRouter();
  const [status, setStatus] = useState<GameStatusResponse["status"] | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinAttempted, setJoinAttempted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;

    async function fetchStatus() {
      setLoading(true);
      const response = await fetch(`/api/game/${gameId}`);
      const result = (await response.json()) as GameStatusResponse;

      if (!isMounted) return;

      if (!response.ok) {
        setError(result.error || "Unable to load game status.");
        setLoading(false);
        return;
      }

      setStatus(result.status);
      setPlayers(result.players);
      setJoined(result.joined);
      setExpiresAt(result.expiresAt);
      setError(null);
      setLoading(false);

      if (result.status === "closed") {
        setError("This game session has been closed.");
        window.setTimeout(() => router.push("/lobby"), 3000);
        return;
      }

      if (result.status === "playing") {
        router.push(`/game/${gameId}`);
        return;
      }

      if (result.status === "waiting" && !result.joined && !joinAttempted) {
        setJoinAttempted(true);
        const joinResponse = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join", gameId }),
        });
        const joinResult = await joinResponse.json();

        if (!joinResponse.ok) {
          setError(joinResult.error || "Unable to join game.");
          return;
        }

        router.push(`/game/${gameId}`);
        return;
      }
    }

    fetchStatus();
    intervalId = window.setInterval(fetchStatus, 3000);

    return () => {
      isMounted = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [gameId, router, joinAttempted]);

  const playerCount = players.length;
  const expiresMessage = expiresAt
    ? `Session closes at ${new Date(expiresAt).toLocaleTimeString()}.`
    : "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="rounded-3xl bg-white/5 p-8 text-center ring-1 ring-white/10">
        <h1 className="text-4xl font-bold">Waiting for a player</h1>
        <p className="mt-4 text-white/80">Share this code with another player so they can join your session.</p>

        <div className="mt-6 rounded-2xl bg-white/10 px-8 py-5 text-2xl font-semibold text-white">
          {gameId}
        </div>

        <p className="mt-6 text-lg text-white/80">
          {loading ? "Checking game status…" : "Waiting for a new player to join…"}
        </p>
        <p className="mt-2 text-white/70">Players in session: {playerCount}/2</p>
        {expiresMessage && <p className="mt-1 text-sm text-white/60">{expiresMessage}</p>}
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        <button
          type="button"
          onClick={() => router.push("/lobby")}
          className="mt-8 inline-flex rounded-2xl border border-white/20 px-6 py-3 text-white transition hover:bg-white/10"
        >
          Back to Lobby
        </button>
      </div>
    </main>
  );
}
