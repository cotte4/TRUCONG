import Link from "next/link";
import { ManualScorekeeper } from "@/components/manual-scorekeeper";
import { EventFeed } from "@/components/surfaces/event-feed";
import { SummaryCard } from "@/components/surfaces/summary-card";

const manualHighlights = [
  "DIMADONG es una variante de Truco multijugador por salas privadas, con aliens, DIMADONGS y BONGS.",
  "El servidor manda: el cliente propone acciones, pero el servidor decide legalidad y estado.",
  "Las salas se organizan por asiento y no por cuenta, asi que reconectar o reemplazar es mas simple.",
  "Los DIMADONGS tienen que respetar la regla de cartas ya jugadas y la fijacion del envido.",
  "Los BONGS son metadata social, no puntaje, y como mucho cuenta uno efectivo por mano.",
];

const eventExamples = [
  "El host creo la sala ABC123.",
  "Un invitado entro al asiento 2.",
  "El equipo A gano la baza 1.",
  "El host arranco la partida cuando todos quedaron listos.",
];

export default function ManualPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <nav className="flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/10 bg-slate-950/72 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-xl ufo-pulse inline-block">UFO</span>
            <p className="font-brand-display text-xs text-slate-300">Dimadong</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Crear sala
            </Link>
            <Link
              href="/"
              className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Inicio
            </Link>
          </div>
        </nav>

        <header>
          <p className="font-brand-display text-xs text-cyan-100/80">Manual y anotador de DIMADONG</p>
          <h1 className="font-brand-display mt-3 text-4xl text-white sm:text-5xl">
            Las reglas, las rarezas y un anotador manual para salir jugando.
          </h1>
        </header>

        <SummaryCard
          eyebrow="Que es DIMADONG"
          title="Una mesa web privada de Truco con estado en vivo por asiento."
          description="Este manual es la version para jugadores del PRD tecnico. Explica la forma visible del producto, el comportamiento raro de los DIMADONGS y los BONGS, y que garantiza la interfaz durante una partida."
          footer={
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                Salas privadas
              </span>
              <span className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                Autoridad del servidor
              </span>
              <span className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                Tematica alien
              </span>
            </div>
          }
        />

        <SummaryCard
          eyebrow="Reconexion"
          title="Si se corta la sala, guardate el codigo y volve a abrirla."
          description="DIMADONG usa sesiones por asiento, asi que la recuperacion mas rapida es simple: abri la sala otra vez, deja que el navegador restaure el token guardado y reintenta la conexion si hace falta. Si perdiste la URL, volve al inicio y pone de nuevo el codigo."
          accent="amber"
          footer={
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200/80">
                1. Tene el codigo de la sala a mano.
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200/80">
                2. Volve a abrir la sala desde inicio.
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200/80">
                3. Usa reintentar si el socket sigue acomodandose.
              </div>
            </div>
          }
        />

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <SummaryCard
              eyebrow="Como se juega"
              title="Entra a una sala, marcate listo, deja que arranque el host y juga carta por carta."
              description="La sala sirve para asignar asientos y balancear equipos. Cuando arranca el host, la partida pasa a turnos activos. La interfaz muestra solamente lo que tu asiento puede hacer en ese momento."
              accent="emerald"
            />

            <SummaryCard
              eyebrow="DIMADONG"
              title="Los DIMADONGS son potentes, pero tienen limites."
              description="Un DIMADONG puede representar muchas cartas, pero no una que ya se haya jugado antes en esa misma mano. Si queda fijado para el envido, esa lectura se mantiene hasta el final de la mano. Si chocan dos DIMADONGS en la misma baza, empatan."
              accent="amber"
            />

            <SummaryCard
              eyebrow="BONGS"
              title="Los BONGS son sociales y no cambian el puntaje."
              description="La app registra BONGS, los muestra en los resumenes y conserva su historial. Aunque haya varios cantos marcados con BONG en una mano, como mucho cuenta uno efectivo."
            />
          </div>

          <div className="space-y-6">
            <ManualScorekeeper />

            <EventFeed
              title="Ejemplo de eventos"
              events={eventExamples}
              emptyLabel="La sala esta tranquila."
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {manualHighlights.map((item) => (
            <article
              key={item}
              className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur"
            >
              <p className="text-sm leading-7 text-slate-200/85">{item}</p>
            </article>
          ))}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Volver al inicio
          </Link>
          <Link
            href="/rooms/demo"
            className="rounded-2xl border border-white/12 bg-slate-950/72 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-900"
          >
            Probar URL de sala
          </Link>
        </div>
      </div>
    </main>
  );
}
