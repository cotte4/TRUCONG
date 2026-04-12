import { LobbyClient } from "@/components/lobby-client";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="min-h-screen px-6 py-10 md:py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <LobbyClient code={code} />
      </div>
    </main>
  );
}
