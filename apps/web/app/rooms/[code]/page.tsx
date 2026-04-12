import { LobbyClient } from "@/components/lobby-client";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6">
      <div className="game-shell mx-auto max-w-7xl">
        <div className="game-shell-content px-4 py-4 sm:px-6 sm:py-6">
          <LobbyClient code={code} />
        </div>
      </div>
    </main>
  );
}
