import Link from "next/link";
import { ManualScorekeeper } from "@/components/manual-scorekeeper";

export default function AnotadorPage() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">

        {/* Nav */}
        <nav className="trap-topbar flex flex-wrap items-center justify-between gap-4 rounded-[1.1rem] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.75rem] border border-fuchsia-300/25 bg-fuchsia-400/12 text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-100">
              UFO
            </span>
            <p className="font-brand-display text-xs text-slate-300">Dimadong</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/manual" className="trap-ghost-button px-4 py-2 text-sm font-semibold text-slate-100 transition">
              Manual
            </Link>
            <Link href="/" className="trap-ghost-button px-4 py-2 text-sm font-semibold text-slate-100 transition">
              Inicio
            </Link>
          </div>
        </nav>

        {/* Header */}
        <header className="space-y-3">
          <p className="landing-copy-kicker">Anotador de DIMADONG</p>
          <h1
            className="font-brand-display text-white leading-[1.05]"
            style={{ fontSize: "clamp(1.9rem, 3vw + 0.8rem, 3.2rem)" }}
          >
            Lleva el marcador
            <br />
            <span className="landing-neon-cyan">sin armar</span>{" "}
            <span className="landing-neon-slime">una sala.</span>
          </h1>
        </header>

        <ManualScorekeeper />

      </div>
    </main>
  );
}
