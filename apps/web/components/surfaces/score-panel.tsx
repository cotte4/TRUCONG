import { TrucoScoreboard } from "@/components/surfaces/truco-scoreboard";

type ScorePanelProps = {
  label: string;
  teamA: number;
  teamB: number;
  subtitle?: string;
};

export function ScorePanel({ label, teamA, teamB, subtitle }: ScorePanelProps) {
  return (
    <section className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{label}</p>
      {subtitle ? <p className="mt-2 text-sm text-slate-300">{subtitle}</p> : null}
      <div className="mt-6">
        <TrucoScoreboard teamA={teamA} teamB={teamB} targetScore={15} />
      </div>
    </section>
  );
}
