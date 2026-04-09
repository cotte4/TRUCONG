"use client";

import { useEffect, useState } from "react";

const emotes = [
  { label: "Alien flex", hint: "Presión liberada" },
  { label: "Mano caliente", hint: "Reacción rápida" },
  { label: "Buena jugada", hint: "Aplauso de mesa" },
  { label: "Señal", hint: "Aviso de reconexión" },
];

const reactions = [
  { label: "Buena mano", hint: "Aplauso rápido" },
  { label: "GG", hint: "Fin de baza" },
  { label: "BONG", hint: "Meta social" },
  { label: "Comodín", hint: "Vibra alien" },
];

export function SocialPanels() {
  const [desktopOpen, setDesktopOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const syncState = () => {
      setDesktopOpen(mediaQuery.matches);
    };

    syncState();
    mediaQuery.addEventListener("change", syncState);

    return () => {
      mediaQuery.removeEventListener("change", syncState);
    };
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Mesa social</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Chat, emotes y reacciones</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            El lado social de la mesa. Se pliega en mobile para que la mesa quede siempre visible; en desktop se abre como panel lateral.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50">
            Plegado en mobile
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <details
          open={desktopOpen}
          className="group rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Chat</p>
              <p className="mt-1 text-sm text-slate-400">Abierto en desktop, plegado en mobile.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Próximamente
            </span>
          </summary>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sistema</p>
              <p className="mt-2 text-sm text-slate-200/82">
                El chat de sala va a vivir acá.
              </p>
            </div>
            <textarea
              disabled
              rows={3}
              placeholder="Escribí un mensaje para la mesa..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-400 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200/70"
            >
              Enviar mensaje
            </button>
          </div>
        </details>

        <div className="grid gap-4">
          <details
            open={desktopOpen}
            className="group rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Emotes</p>
                <p className="mt-1 text-sm text-slate-400">Reacciones de un toque con sabor alien.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Vista previa
              </span>
            </summary>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {emotes.map((emote) => (
                <button
                  key={emote.label}
                  type="button"
                  disabled
                  className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="text-sm font-semibold text-white">{emote.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{emote.hint}</p>
                </button>
              ))}
            </div>
          </details>

          <details
            open={desktopOpen}
            className="group rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Reacciones</p>
                <p className="mt-1 text-sm text-slate-400">Etiquetas rápidas para momentos de mesa.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Lista
              </span>
            </summary>

            <div className="mt-4 flex flex-wrap gap-2">
              {reactions.map((reaction) => (
                <button
                  key={reaction.label}
                  type="button"
                  disabled
                  className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block">{reaction.label}</span>
                  <span className="mt-1 block text-[10px] font-normal uppercase tracking-[0.18em] text-slate-500">
                    {reaction.hint}
                  </span>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
