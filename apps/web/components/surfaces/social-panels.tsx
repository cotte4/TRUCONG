"use client";

import { useEffect, useState } from "react";

const chatNotes = [
  "Private table thread",
  "Use for quick coordination",
  "Collapses on small screens",
];

const emotes = [
  { label: "Alien flex", hint: "Pressure release" },
  { label: "Hot hand", hint: "Fast reaction" },
  { label: "Nice play", hint: "Table applause" },
  { label: "Signal", hint: "Reconnect cue" },
];

const reactions = [
  { label: "Nice hand", hint: "Fast applause" },
  { label: "GG", hint: "End of trick" },
  { label: "BONG", hint: "Social meta" },
  { label: "Wild", hint: "Wildcard vibe" },
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
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">Table social</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Chat, emotes, and reactions</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            These are lightweight placeholders for the room's social layer. They stay tucked away on mobile, but on
            desktop they behave like a coordinated side panel that belongs to the table and its live turn flow.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50">
            Mobile collapsed
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-200">
            Fits the game surface
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100">
        <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-slate-200">Chat ready</span>
        <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-slate-200">
          Emotes preview
        </span>
        <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-slate-200">
          Reactions preview
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {["Table coordination", "Desktop-first side panel", "Collapsed on smaller screens"].map((item) => (
          <div key={item} className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {chatNotes.map((item) => (
          <div key={item} className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <details
          open={desktopOpen}
          className="group rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-slate-100"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Chat</p>
              <p className="mt-1 text-sm text-slate-400">Open by default on desktop, collapsed on mobile.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Soon
            </span>
          </summary>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">System</p>
              <p className="mt-2 text-sm text-slate-200/82">
                Room chat will live here once the socket contract is finalized.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                <p>Seat messages and lightweight table chatter.</p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <p>Kept below the fold on mobile so the table stays readable.</p>
              </div>
            </div>
            <textarea
              disabled
              rows={3}
              placeholder="Type a message for your table..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-400 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200/70"
            >
              Send message
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
                <p className="mt-1 text-sm text-slate-400">Single-tap reactions with room flavor.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Preview
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
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Reactions</p>
                <p className="mt-1 text-sm text-slate-400">Quick labels that can attach to table moments.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Ready
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
