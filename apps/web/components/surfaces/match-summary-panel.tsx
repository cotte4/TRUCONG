import Link from "next/link";
import type { TeamSide } from "@dimadong/contracts";

type MatchSummaryPanelProps = {
  roomCode: string;
  targetScore: number;
  winnerTeamSide?: TeamSide | null;
  finalScore?: {
    A: number;
    B: number;
  } | null;
  stateLabel?: string;
  phaseLabel?: string;
  reason?: string | null;
};

export function MatchSummaryPanel({
  roomCode,
  targetScore,
  winnerTeamSide,
  finalScore,
  stateLabel = "Summary ready",
  phaseLabel = "Post-match summary",
  reason,
}: MatchSummaryPanelProps) {
  const isSummaryReady = stateLabel !== "Summary pending";
  const hasFinalSummary = isSummaryReady && Boolean(finalScore);
  const hasWinnerTeam = Boolean(winnerTeamSide);
  const resolvedWinnerTeamSide = winnerTeamSide ?? "A";
  const resolvedFinalScore = finalScore ?? { A: 0, B: 0 };
  const winningScore = hasFinalSummary && hasWinnerTeam ? resolvedFinalScore[resolvedWinnerTeamSide] : targetScore;
  const losingTeamSide: TeamSide = resolvedWinnerTeamSide === "A" ? "B" : "A";
  const losingScore = hasFinalSummary && hasWinnerTeam ? resolvedFinalScore[losingTeamSide] : Math.max(0, targetScore - 1);
  const margin = hasFinalSummary && hasWinnerTeam ? Math.abs(winningScore - losingScore) : 0;

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-300/12 via-slate-950/80 to-cyan-300/10 p-6 shadow-2xl shadow-emerald-950/20 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/50 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100/75">{phaseLabel}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {hasFinalSummary && hasWinnerTeam ? `Team ${resolvedWinnerTeamSide} closes room ${roomCode}.` : `Room ${roomCode} is settled.`}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/88">
            {isSummaryReady ? (
              <>
                {hasFinalSummary ? (
                  <>
                    Final score {resolvedFinalScore.A} - {resolvedFinalScore.B} reached the {targetScore}-point target.
                    {hasWinnerTeam
                      ? " This summary keeps the PRD shape visible: winner, scoreline, room context, and a clean exit path for the players."
                      : " The room is settled and the authoritative winner detail can slot in once the backend supplies it."}
                  </>
                ) : (
                  <>
                    The room is settled and the summary lane is ready. The backend can still provide the final score
                    and winner details independently, and this panel will keep the settled state readable in the
                    meantime.
                  </>
                )}
              </>
            ) : (
              <>
                The room has reached the settled phase and is ready to show the final recap as soon as the
                authoritative summary payload lands from the backend.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-emerald-300/25 bg-emerald-300/12 px-4 py-2 text-sm font-semibold text-emerald-50">
            {hasFinalSummary && hasWinnerTeam ? "Winner" : "Settled"}
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-100">
            {stateLabel}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100">
        <span className="rounded-full border border-emerald-300/25 bg-emerald-300/12 px-3 py-1 text-emerald-50">
          {isSummaryReady ? "Final state" : "Settled phase"}
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-slate-200">
          {isSummaryReady ? "Replay ready" : "Summary pending"}
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-slate-200">Reconnect safe</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Match", value: "Closed" },
          { label: "Reconnect", value: "Safe" },
          { label: "Review", value: "Ready" },
          { label: "Replay", value: "Optional" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
            <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Post-match lane</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">Winner</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {isSummaryReady ? (hasWinnerTeam ? `Team ${resolvedWinnerTeamSide}` : "Pending") : "Pending"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Margin</p>
            <p className="mt-2 text-sm font-semibold text-white">{isSummaryReady && hasFinalSummary ? margin : "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Target</p>
            <p className="mt-2 text-sm font-semibold text-white">{targetScore}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Scoreboard</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Team A</p>
              <p className="mt-2 text-4xl font-semibold text-white">{hasFinalSummary ? resolvedFinalScore.A : "-"}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Target</p>
              <p className="mt-2 text-4xl font-semibold text-white">{targetScore}</p>
            </div>
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">Team B</p>
              <p className="mt-2 text-4xl font-semibold text-white">{hasFinalSummary ? resolvedFinalScore.B : "-"}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Winner", value: hasFinalSummary ? `Team ${resolvedWinnerTeamSide}` : "Pending" },
              { label: "Margin", value: hasFinalSummary ? `${margin}` : "-" },
              { label: "Target reached", value: hasFinalSummary ? "Yes" : "Settled" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Room recap</p>
          <div className="mt-4 space-y-3 text-sm text-slate-200/82">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              Room code <span className="font-semibold text-white">{roomCode}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              Winning margin <span className="font-semibold text-white">{hasFinalSummary ? margin : "n/a"}</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              {isSummaryReady && hasFinalSummary && hasWinnerTeam
                ? "Outcome recorded as a server-side recap, ready for the next room decision."
                : isSummaryReady
                  ? "The room has settled and is waiting on the final score and winner details from the server."
                  : "The room has settled and is waiting on the final summary payload from the server."}
            </div>
            {reason ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
                Summary reason <span className="font-semibold text-white">{reason}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Back home
        </Link>
        <Link
          href="/manual"
          className="rounded-2xl border border-white/12 bg-slate-950/72 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
        >
          Read manual
        </Link>
      </div>
    </section>
  );
}
