import Link from "next/link";
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
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/10 bg-slate-950/72 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-xl ufo-pulse inline-block">🛸</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Dimadong</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100">
              {code.toUpperCase()}
            </span>
            <Link
              href="/manual"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Cómo se juega
            </Link>
            <Link
              href="/"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Inicio
            </Link>
          </div>
        </nav>
        <LobbyClient code={code} />
      </div>
    </main>
  );
}
