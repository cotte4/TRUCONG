import Link from "next/link";
import { EventFeed } from "@/components/surfaces/event-feed";
import { ScorePanel } from "@/components/surfaces/score-panel";
import { SummaryCard } from "@/components/surfaces/summary-card";

const manualHighlights = [
  "DIMADONG is a private room-based multiplayer Truco variant with aliens, wildcards, and BONGS.",
  "The server is authoritative: the client proposes actions, but the server decides legality and state.",
  "Rooms are seat-based instead of account-based, which keeps reconnection and replacement simple.",
  "Wildcards must respect the already-played-card rule and the envido fixation rule.",
  "BONGS are social metadata, not score, and at most one effective BONG counts per hand.",
];

const eventExamples = [
  "Host created room ABC123.",
  "Guest joined Seat 2.",
  "Team A won trick 1.",
  "Host started the match after everyone marked ready.",
];

export default function ManualPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">DIMADONG manual</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              The rules, the weird parts, and the shape of the app.
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/12"
          >
            Back home
          </Link>
        </header>

        <SummaryCard
          eyebrow="What DIMADONG is"
          title="A private web Truco table with a live, seat-based state machine."
          description="This manual is the player-facing version of the technical PRD. It explains the visible product shape, the unusual wildcard and BONGS behavior, and what the interface guarantees during a match."
          footer={
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                Private rooms
              </span>
              <span className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                Server authority
              </span>
              <span className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/80">
                Alien theme
              </span>
            </div>
          }
        />

        <SummaryCard
          eyebrow="Reconnect flow"
          title="If the room drops, keep the code and reopen the room page."
          description="DIMADONG uses seat-based sessions, so the quickest recovery path is simple: open the room again, let the browser restore the stored session token, and retry the socket connection if needed. If you lost the URL entirely, go back home and re-enter the room code."
          accent="amber"
          footer={
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200/80">
                1. Keep the room code visible.
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200/80">
                2. Reopen the room page from home.
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200/80">
                3. Use the retry button if the socket is still catching up.
              </div>
            </div>
          }
        />

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <SummaryCard
              eyebrow="How to play"
              title="Join a room, mark ready, let the host start, and play card-by-card."
              description="The lobby is where seats are assigned and teams are balanced. Once the host starts, the match moves into active turns. The interface only shows what your seat is allowed to do right now."
              accent="emerald"
            />

            <SummaryCard
              eyebrow="Wildcards"
              title="Wildcards can be powerful, but they are constrained."
              description="A wildcard can represent many cards, but not one already played earlier in the same hand. If a wildcard is fixed for envido, that choice sticks for the rest of the hand. If two wildcards collide in the same trick, the result is a tie."
              accent="amber"
            />

            <SummaryCard
              eyebrow="BONGS"
              title="BONGS are social-only and do not change the match score."
              description="The app records BONGS, shows them in summaries, and preserves their log history. Even if several BONG-tagged calls happen in one hand, only one effective BONG counts for the hand."
            />
          </div>

          <div className="space-y-6">
            <ScorePanel
              label="Example score panel"
              subtitle="This is the reusable score surface the main thread can drop into room or summary views later."
              teamA={7}
              teamB={4}
            />

            <EventFeed
              title="Example event feed"
              events={eventExamples}
              emptyLabel="The room is quiet."
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
            Back to home
          </Link>
          <Link
            href="/rooms/demo"
            className="rounded-2xl border border-white/12 bg-slate-950/72 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-900"
          >
            Try a room URL
          </Link>
        </div>
      </div>
    </main>
  );
}
