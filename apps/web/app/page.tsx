import { HomeClient } from "@/components/home-client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/10 bg-slate-950/72 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Dimadong</p>
            <p className="mt-1 text-sm text-slate-300">Sala privada para jugar al Truco online.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/manual"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Cómo se juega
            </Link>
            <Link
              href="#create-room"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Crear sala
            </Link>
          </div>
        </nav>

        <section className="space-y-6">
          <p className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
            Multijugador privado
          </p>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
              Creá una sala, pasá el código y jugá.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Dimadong está pensado para ir al grano: armás la sala, compartís el código, todos se ponen listos y arranca la mano.
            </p>
          </div>
        </section>

        <section id="create-room" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Entrada</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Crear o unirse a una sala</h2>
            </div>
            <Link href="/manual" className="text-sm text-slate-300 underline decoration-slate-500 underline-offset-4">
              Ver cómo se juega
            </Link>
          </div>
          <HomeClient />
        </section>
      </div>
    </main>
  );
}
