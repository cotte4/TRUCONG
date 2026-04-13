import Link from "next/link";
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
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">

        {/* Nav */}
        <nav className="trap-topbar flex flex-wrap items-center justify-between gap-4 rounded-[1.1rem] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.75rem] border border-fuchsia-300/25 bg-fuchsia-400/12 text-[9px] font-black uppercase tracking-[0.2em] text-fuchsia-100">
              UFO
            </span>
            <p className="font-brand-display text-xs text-slate-300">Dimadong</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/anotador" className="trap-ghost-button px-4 py-2 text-sm font-semibold text-slate-100 transition">
              Anotador
            </Link>
            <Link
              href="/"
              className="trap-ghost-button px-4 py-2 text-sm font-semibold text-slate-100 transition"
            >
              Inicio
            </Link>
          </div>
        </nav>

        {/* Header */}
        <header className="space-y-3">
          <p className="landing-copy-kicker">Manual de DIMADONG</p>
          <h1
            className="font-brand-display text-white leading-[1.05]"
            style={{ fontSize: "clamp(2rem, 3.5vw + 0.8rem, 3.8rem)" }}
          >
            Las reglas, las rarezas
            <br />
            <span className="landing-neon-cyan">y cómo no </span>
            <span className="landing-neon-slime">perder de vista</span>
            <br />
            el puntaje.
          </h1>
        </header>

        <SummaryCard
          eyebrow="Que es DIMADONG"
          title="Una mesa web privada de Truco con estado en vivo por asiento."
          description="Este manual es la version para jugadores del PRD tecnico. Explica la forma visible del producto, el comportamiento raro de los DIMADONGS y los BONGS, y que garantiza la interfaz durante una partida."
          footer={
            <div className="flex flex-wrap gap-2">
              {["Salas privadas", "Autoridad del servidor", "Tematica alien"].map((tag) => (
                <span
                  key={tag}
                  className="landing-info-chip text-[0.68rem] font-black uppercase tracking-[0.24em] text-white/75"
                >
                  {tag}
                </span>
              ))}
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
              {[
                "1. Tene el codigo de la sala a mano.",
                "2. Volve a abrir la sala desde inicio.",
                "3. Usa reintentar si el socket sigue acomodandose.",
              ].map((step) => (
                <div key={step} className="rounded-[1.25rem] border border-white/8 bg-slate-950/60 p-4 text-sm text-slate-200/80">
                  {step}
                </div>
              ))}
            </div>
          }
        />

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
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

          <div className="space-y-5">
            <div className="trap-panel rounded-[2rem] border-fuchsia-300/20 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fuchsia-200/72">
                Anotador
              </p>
              <p className="mt-3 text-lg font-semibold text-white">
                Lleva el puntaje sin armar una sala.
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Con UFOs animados, pizarra libre o marcador digital. El estado queda guardado en el navegador.
              </p>
              <Link
                href="/anotador"
                className="trap-ghost-button mt-5 inline-block rounded-full border-fuchsia-300/30 px-5 py-2.5 text-sm font-semibold text-fuchsia-50 transition"
              >
                Abrir anotador
              </Link>
            </div>

            <EventFeed
              title="Ejemplo de eventos"
              events={eventExamples}
              emptyLabel="La sala esta tranquila."
            />
          </div>
        </section>

        {/* Highlights */}
        <section className="grid gap-4 sm:grid-cols-2">
          {manualHighlights.map((item) => (
            <article key={item} className="trap-panel rounded-[1.75rem] p-5">
              <p className="text-sm leading-7 text-slate-300/90">{item}</p>
            </article>
          ))}
        </section>

        {/* Footer actions */}
        <div className="flex flex-wrap gap-3 pb-4">
          <Link href="/" className="trap-cta px-6 py-3 text-sm font-semibold text-slate-950">
            Volver al inicio
          </Link>
          <Link href="/rooms/demo" className="trap-ghost-button px-5 py-3 text-sm font-semibold text-slate-100 transition">
            Probar URL de sala
          </Link>
        </div>

      </div>
    </main>
  );
}
