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
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/8 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Equipo A</p>
          <p className="mt-2 text-4xl font-semibold text-white">{teamA}</p>
        </div>
        <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/8 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Equipo B</p>
          <p className="mt-2 text-4xl font-semibold text-white">{teamB}</p>
        </div>
      </div>
    </section>
  );
}
