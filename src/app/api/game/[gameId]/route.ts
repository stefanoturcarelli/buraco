import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EXPIRE_MS = 1000 * 120;

function hasExpired(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > EXPIRE_MS;
}

async function expireGameIfNeeded(supabase: any, game: any) {
  if (game.status !== "waiting" || !game.created_at) {
    return game;
  }

  if (!hasExpired(game.created_at)) {
    return game;
  }

  const { error } = await supabase
    .from("games")
    .update({ status: "closed" })
    .eq("game_id", game.game_id);

  if (error) {
    console.error("Failed to expire game", error.message);
  }

  return { ...game, status: "closed" };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const supabase = await createClient();
  const userRes = await supabase.auth.getUser();

  if (userRes.error || !userRes.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userRes.data.user.id;

  const { data, error } = await supabase
    .from("games")
    .select("game_id, host_id, status, players, created_at")
    .eq("game_id", gameId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Invalid game code." }, { status: 404 });
  }

  const game = await expireGameIfNeeded(supabase, data);

  return NextResponse.json({
    gameId: game.game_id,
    status: game.status,
    players: game.players ?? [],
    joined: Array.isArray(game.players) ? game.players.includes(userId) : false,
    isHost: game.host_id === userId,
    expiresAt:
      game.status === "waiting" && game.created_at
        ? new Date(new Date(game.created_at).getTime() + EXPIRE_MS).toISOString()
        : null,
  });
}
