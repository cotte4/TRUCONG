import { HomeClient } from "@/components/home-client";
import Link from "next/link";
import { SummaryCard } from "@/components/surfaces/summary-card";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/12 bg-slate-950/72 px-5 py-4 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">DIMADONG</p>
            <p className="mt-1 text-sm text-slate-300">Private Truco for friends, with a stronger-than-usual rules engine.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/manual"
              className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/12"
            >
              Read manual
            </Link>
            <Link
              href="#create-room"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Create room
            </Link>
          </div>
        </nav>

        <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <p className="inline-flex rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100/80">
              DIMADONG v1 scaffold
            </p>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                Truco argentino con extraterrestres, comodines y caos controlado.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-200/78">
                The workspace is now bootstrapped with a Next.js frontend, a NestJS
                realtime service, shared domain packages, and a Prisma schema shaped
                around rooms, seats, reconnection, and authoritative match state.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {["Next.js 16", "React 19", "NestJS 11", "Socket.IO", "PostgreSQL", "Prisma"].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-cyan-300/20 bg-cyan-400/8 px-4 py-2 text-sm text-cyan-50"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>

          <SummaryCard
            eyebrow="Phase 1"
            title="Room creation, lobby readiness, and a first playable hand are already in place."
            description="What remains is the true DIMADONG rules layer and the production polish around it. The manual link below explains the product shape, while the live app remains focused on room flow."
            footer={
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/8 p-4 text-sm text-emerald-100/90">
                Start the apps with <code>npx pnpm dev:web</code> and <code>npx pnpm dev:realtime</code>.
              </div>
            }
          />
        </section>

        <section id="create-room" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/70">Entry point</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Create or join a room</h2>
            </div>
            <Link href="/manual" className="text-sm text-slate-300 underline decoration-slate-500 underline-offset-4">
              Open the manual first
            </Link>
          </div>
          <HomeClient />
        </section>
      </div>
    </main>
  );
}
