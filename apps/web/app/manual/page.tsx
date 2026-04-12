import Link from "next/link";
import { EventFeed } from "@/components/surfaces/event-feed";
import { ScorePanel } from "@/components/surfaces/score-panel";
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

const missionChips = ["Sala privada", "Server-authoritative", "DIMADONG protocol", "BONG logs"];

export default function ManualPage() {
  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6">
      <div className="game-shell mx-auto max-w-7xl">
        <div className="game-shell-content flex flex-col gap-8 px-5 py-5 sm:px-8 sm:py-8 lg:px-10">
          <nav className="game-nav flex flex-wrap items-center justify-between gap-4 rounded-full px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100">
                UFO
              </span>
              <p className="font-brand-display text-xs text-slate-300">Dimadong Manual</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="game-chip rounded-full px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
              >
                Inicio
              </Link>
              <Link
                href="/"
                className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Entrar a la nave
              </Link>
            </div>
          </nav>

          <header className="game-panel game-panel-cyan rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-100/75">Mission Brief</p>
                <h1 className="game-screen-title font-brand-display mt-4 text-[clamp(2.9rem,7vw,5.8rem)] leading-[0.88] text-white">
                  COMO FUNCIONA
                  <br />
                  LA NAVE.
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                  Este manual ahora se siente como una sala de briefing: reglas, reconexion, eventos y protocolos
                  raros presentados como si estuvieras por entrar a una mesa alien real, no a una pagina de ayuda.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {missionChips.map((chip) => (
                    <span
                      key={chip}
                      className="game-chip rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-100"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="game-panel game-panel-amber rounded-[1.8rem] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">Status</p>
                <h2 className="font-brand-display mt-3 text-2xl text-white">Protocolo de mesa</h2>
                <div className="mt-5 space-y-3">
                  <div className="game-chip rounded-2xl px-4 py-3 text-sm text-slate-200">
                    1. Entra por codigo, no por cuenta.
                  </div>
                  <div className="game-chip rounded-2xl px-4 py-3 text-sm text-slate-200">
                    2. La sala asigna asientos y equipos antes de largar.
                  </div>
                  <div className="game-chip rounded-2xl px-4 py-3 text-sm text-slate-200">
                    3. Cuando el host activa la partida, el servidor manda.
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <SummaryCard
                eyebrow="Que es DIMADONG"
                title="Una mesa web privada de Truco con estado en vivo por asiento."
                description="Este manual es la version para jugadores del PRD tecnico. Explica la forma visible del producto, el comportamiento raro de los DIMADONGS y los BONGS, y que garantiza la interfaz durante una partida."
                footer={
                  <div className="flex flex-wrap gap-3">
                    <span className="game-chip rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                      Salas privadas
                    </span>
                    <span className="game-chip rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                      Autoridad del servidor
                    </span>
                    <span className="game-chip rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                      Tematica alien
                    </span>
                  </div>
                }
              />

              <SummaryCard
                eyebrow="Reconexcion"
                title="Si se corta la sala, guardate el codigo y volve a entrar."
                description="DIMADONG usa sesiones por asiento, asi que la recuperacion mas rapida es simple: abrir otra vez la sala, dejar que el navegador restaure el token guardado y reintentar la conexion si hace falta."
                accent="amber"
                footer={
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="game-chip rounded-3xl px-4 py-4 text-sm text-slate-200/80">
                      1. Tene el codigo de la sala a mano.
                    </div>
                    <div className="game-chip rounded-3xl px-4 py-4 text-sm text-slate-200/80">
                      2. Volve a abrir la sala desde inicio.
                    </div>
                    <div className="game-chip rounded-3xl px-4 py-4 text-sm text-slate-200/80">
                      3. Usa reintentar si el socket sigue acomodandose.
                    </div>
                  </div>
                }
              />

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
              <ScorePanel
                label="HUD de marcador"
                subtitle="Este es el marcador reutilizable que aparece en sala y resumen, presentado como tablero de partida."
                teamA={7}
                teamB={4}
              />

              <EventFeed
                title="Registro de eventos"
                events={eventExamples}
                emptyLabel="La sala esta tranquila."
              />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            {manualHighlights.map((item) => (
              <article
                key={item}
                className="game-panel game-briefing-lines rounded-[2rem] px-6 py-6"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/60">Intel</p>
                <p className="mt-3 text-sm leading-7 text-slate-200/85">{item}</p>
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
              className="game-chip rounded-2xl px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Probar URL de sala
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
