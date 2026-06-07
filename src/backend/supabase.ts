import { createClient } from "@supabase/supabase-js";
import type { GameBackend, GameEvent, NewEvent } from "./types";

// SupabaseBackend — the primary backend for real two-device play.
//
// Security relies on Row Level Security + an unguessable game_id, NOT on
// hiding the key. The frontend uses ONLY the publishable key. NEVER reference
// a secret/service_role key in client code.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const sb = createClient(url ?? "", key ?? "");

// Map a database row (snake_case) to our GameEvent (camelCase).
interface Row {
  id: number;
  game_id: string;
  type: GameEvent["type"];
  actor: string;
  payload: GameEvent["payload"];
  created_at: string;
}

function toEvent(row: Row): GameEvent {
  return {
    id: row.id,
    gameId: row.game_id,
    type: row.type,
    actor: row.actor,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

function randomGameId(): string {
  return crypto.randomUUID().slice(0, 6);
}

export const supabaseBackend: GameBackend = {
  async createGame(seed) {
    const gameId = randomGameId();
    const { error } = await sb.from("events").insert({
      game_id: gameId,
      type: "game_created",
      actor: "system",
      payload: { seed },
    });
    if (error) throw error;
    return { gameId };
  },

  async appendEvent(gameId, e: NewEvent) {
    const { data, error } = await sb
      .from("events")
      .insert({
        game_id: gameId,
        type: e.type,
        actor: e.actor,
        payload: e.payload,
      })
      .select()
      .single();
    if (error) throw error;
    return toEvent(data as Row);
  },

  async getEvents(gameId, sinceId) {
    const { data, error } = await sb
      .from("events")
      .select("*")
      .eq("game_id", gameId)
      .gt("id", sinceId)
      .order("id");
    if (error) throw error;
    return (data as Row[]).map(toEvent);
  },

  subscribe(gameId, cb) {
    const ch = sb
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          filter: `game_id=eq.${gameId}`,
        },
        (p) => cb(toEvent(p.new as Row)),
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  },
};
