import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateGameId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, gameId } = body as { action: string; gameId?: string };

  const supabase = await createClient();
  const userRes = await supabase.auth.getUser();

  if (userRes.error || !userRes.data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userRes.data.user.id;

  if (action === "create") {
    let attempt = 0;
    let newGameId = generateGameId();
    let insertError = null;

    while (attempt < 5) {
      const { error } = await supabase.from("games").insert([
        {
          game_id: newGameId,
          host_id: userId,
          status: "waiting",
          players: [userId],
          created_at: new Date().toISOString(),
        },
      ]);

      if (!error) {
        return NextResponse.json({ gameId: newGameId });
      }

      insertError = error;
      if (error.code === "23505") {
        newGameId = generateGameId();
        attempt += 1;
        continue;
      }

      break;
    }

    return NextResponse.json(
      { error: insertError?.message ?? "Unable to create game session." },
      { status: 500 },
    );
  }

  if (action === "join") {
    if (!gameId) {
      return NextResponse.json({ error: "Missing game code." }, { status: 400 });
    }

    const { data, error: fetchError } = await supabase
      .from("games")
      .select("game_id, status, players")
      .eq("game_id", gameId)
      .single();

    if (fetchError || !data) {
      return NextResponse.json({ error: "Invalid game code." }, { status: 404 });
    }

    if (data.status !== "waiting") {
      return NextResponse.json({ error: "Game session is not open." }, { status: 400 });
    }

    if (data.players.length >= 2) {
      return NextResponse.json({ error: "Game session is full." }, { status: 400 });
    }

    const updatedPlayers = [...data.players, userId];
    const { error: updateError } = await supabase
      .from("games")
      .update({ players: updatedPlayers, status: "playing" })
      .eq("game_id", gameId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ gameId });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
