import Link from "next/link";
import { LobbyClient } from "@/components/lobby-client";
import { ConnectionStateCard } from "@/components/surfaces/connection-state-card";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="min-h-screen px-6 py-12 pb-28 md:pb-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/12 bg-slate-950/72 px-5 py-4 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">DIMADONG room</p>
            <p className="mt-1 text-sm text-slate-300">
              If reconnect breaks, go back home, reopen the manual, and rejoin with the same room code.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-slate-100">
              {code.toUpperCase()}
            </span>
            <Link
              href="/manual"
              className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/12"
            >
              Manual
            </Link>
            <Link
              href="/"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Home
            </Link>
          </div>
        </nav>
        <ConnectionStateCard
          eyebrow="Room access"
          title={`Keep room ${code.toUpperCase()} open while the table reconnects.`}
          description="The room page restores your stored seat token, retries the socket, and keeps the manual only one click away if you need to recover the flow."
          status="Seat-based"
          tone="amber"
          details={[
            "If the room stalls, retry from this page.",
            "Manual access is always available from the top nav.",
            "The current table and summary live below.",
          ]}
          primaryAction={{ label: "Open manual", href: "/manual" }}
          secondaryAction={{ label: "Go home", href: "/" }}
          compact
        />
        <LobbyClient code={code} />
      </div>
    </main>
  );
}
