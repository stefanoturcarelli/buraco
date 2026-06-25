"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    router.push("/lobby");
    router.refresh();
  }

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/10 p-6 backdrop-blur">
      <h1 className="mb-6 text-2xl font-bold">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl bg-white/10 px-4 py-3 placeholder-white/40 outline-none focus:ring-2 focus:ring-white/30"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl bg-white/10 px-4 py-3 placeholder-white/40 outline-none focus:ring-2 focus:ring-white/30"
        />

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-white py-3 font-bold text-green-900 disabled:opacity-50"
        >
          {loading
            ? "…"
            : mode === "signin"
            ? "Sign in"
            : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-white/60">
        {mode === "signin" ? "No account?" : "Already have one?"}{" "}
        <button
          type="button"
          onClick={toggleMode}
          className="text-white underline"
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
