import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Buraco</h1>
        <p className="mt-2 text-green-300">The Argentine card game</p>
      </div>
      <Link
        href="/lobby"
        className="rounded-2xl bg-white px-10 py-4 text-xl font-bold text-green-900 shadow-lg active:scale-95 transition-transform"
      >
        Play
      </Link>
    </main>
  );
}
