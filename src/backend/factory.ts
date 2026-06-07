import type { GameBackend } from "./types";
import { localBackend } from "./local";

/**
 * Select the backend via VITE_BACKEND ("local" | "supabase"). The Supabase
 * module is imported lazily so a missing key never breaks local play.
 */
export async function getBackend(): Promise<{
  backend: GameBackend;
  name: string;
}> {
  const which = (import.meta.env.VITE_BACKEND as string | undefined) ?? "local";
  if (which === "supabase") {
    const { supabaseBackend } = await import("./supabase");
    return { backend: supabaseBackend, name: "supabase" };
  }
  return { backend: localBackend, name: "local" };
}
