"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LobbyPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleStartGame() {
    setError(null);
    setLoading(true);

    const response = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create" }),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error || "Unable to create game session.");
      return;
    }

    router.push(`/lobby/${result.gameId}`);
  }

  async function handleJoinGame(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError("Please enter a valid 6-character game code.");
      return;
    }

    setError(null);
    setLoading(true);

    const response = await fetch(`/api/game/${code}`);
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error || "Invalid game code.");
      return;
    }

    if (result.status === "closed" || result.status === "playing") {
      setError("That game session is not available to join.");
      return;
    }

    router.push(`/lobby/${code}`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white/5 p-8 backdrop-blur ring-1 ring-white/10">
        <h1 className="text-4xl font-bold">Lobby</h1>
        <p className="mt-2 text-white/70">
          Start a new game session or join an existing one with a game code.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <button
            type="button"
            onClick={handleStartGame}
            disabled={loading}
            className="rounded-2xl bg-white px-6 py-4 text-lg font-semibold text-green-900 shadow-lg transition hover:scale-[1.01] active:scale-95 disabled:opacity-50"
          >
            {loading ? "Starting…" : "Start Game"}
          </button>

          <form onSubmit={handleJoinGame} className="grid gap-3">
            <label className="text-sm font-medium text-white/80" htmlFor="joinCode">
              Join Game
            </label>
            <input
              id="joinCode"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="Enter game code"
              className="rounded-2xl bg-white/10 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-white/20"
            />
            {error && <p className="text-sm text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-green-500 px-6 py-3 text-white transition hover:bg-green-400 disabled:opacity-50"
            >
              {loading ? "Checking…" : "Join Game"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
