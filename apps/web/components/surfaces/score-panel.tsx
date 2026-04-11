import type { RoomSnapshot } from "@dimadong/contracts";
import { TrucoScoreboard } from "@/components/surfaces/truco-scoreboard";

type ScorePanelProps = {
  label: string;
  teamA: number;
  teamB: number;
  subtitle?: string;
  snapshot?: RoomSnapshot;
};

export function ScorePanel({ label, teamA, teamB, subtitle, snapshot }: ScorePanelProps) {
  const is3v3 = snapshot?.maxPlayers === 6;

  return (
    <section className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{label}</p>
        {is3v3 ? (
          <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/80">
            3v3
          </span>
        ) : null}
      </div>
      {subtitle ? <p className="mt-2 text-sm text-slate-300">{subtitle}</p> : null}
      <div className="mt-6">
        <TrucoScoreboard teamA={teamA} teamB={teamB} targetScore={15} />
      </div>
    </section>
  );
}
