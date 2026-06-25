export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  return (
    <main className="flex min-h-screen flex-col">
      {/* TODO: game table — hand, melds, discard pile, actions */}
      <p className="p-4 text-green-300">Game {gameId} coming soon.</p>
    </main>
  );
}
