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
  stateLabel = "Resumen listo",
  phaseLabel = "Resumen de partida",
  reason,
}: MatchSummaryPanelProps) {
  const isSummaryReady = stateLabel !== "Resumen pendiente";
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
            {hasFinalSummary && hasWinnerTeam
              ? `Equipo ${resolvedWinnerTeamSide} cierra la sala ${roomCode}.`
              : `Sala ${roomCode} cerrada.`}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/88">
            {hasFinalSummary
              ? `Puntaje final ${resolvedFinalScore.A} - ${resolvedFinalScore.B}. Se alcanzó el objetivo de ${targetScore} puntos.`
              : "La sala está cerrada. El resumen definitivo va a aparecer cuando el servidor lo confirme."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-emerald-300/25 bg-emerald-300/12 px-4 py-2 text-sm font-semibold text-emerald-50">
            {hasFinalSummary && hasWinnerTeam ? "Ganador" : "Cerrada"}
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-100">
            {stateLabel}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Marcador</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">Equipo A</p>
            <p className="mt-2 text-4xl font-semibold text-white">{hasFinalSummary ? resolvedFinalScore.A : "-"}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Objetivo</p>
            <p className="mt-2 text-4xl font-semibold text-white">{targetScore}</p>
          </div>
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">Equipo B</p>
            <p className="mt-2 text-4xl font-semibold text-white">{hasFinalSummary ? resolvedFinalScore.B : "-"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Ganador", value: hasFinalSummary ? `Equipo ${resolvedWinnerTeamSide}` : "Pendiente" },
            { label: "Diferencia", value: hasFinalSummary ? `${margin}` : "-" },
            { label: "Objetivo alcanzado", value: hasFinalSummary ? "Sí" : "Pendiente" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
              <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Resumen de sala</p>
        <div className="mt-4 space-y-3 text-sm text-slate-200/82">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
            Código de sala <span className="font-semibold text-white">{roomCode}</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
            Diferencia <span className="font-semibold text-white">{hasFinalSummary ? margin : "n/a"}</span>
          </div>
          {reason ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              Motivo <span className="font-semibold text-white">{reason}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Volver al inicio
        </Link>
        <Link
          href="/manual"
          className="rounded-2xl border border-white/12 bg-slate-950/72 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
        >
          Ver el manual
        </Link>
      </div>
    </section>
  );
}
