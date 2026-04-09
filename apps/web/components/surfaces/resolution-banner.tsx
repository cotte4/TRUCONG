type ResolutionBannerProps = {
  kind: "trick" | "hand" | "canto";
  title: string;
  summary: string;
  outcome: string;
  tone?: "cyan" | "amber" | "emerald";
  stateLabel?: string;
  contextLabel?: string;
  progressLabel?: string;
  stateTone?: "cyan" | "amber" | "emerald";
  details?: string[];
};

const toneClasses: Record<NonNullable<ResolutionBannerProps["tone"]>, string> = {
  cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-50",
  amber: "border-amber-300/20 bg-amber-300/10 text-amber-50",
  emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-50",
};

const stateToneClasses: Record<NonNullable<ResolutionBannerProps["stateTone"]>, string> = {
  cyan: "border-cyan-300/25 bg-cyan-300/12 text-cyan-50",
  amber: "border-amber-300/25 bg-amber-300/12 text-amber-50",
  emerald: "border-emerald-300/25 bg-emerald-300/12 text-emerald-50",
};

export function ResolutionBanner({
  kind,
  title,
  summary,
  outcome,
  tone = "cyan",
  stateLabel,
  contextLabel,
  progressLabel,
  stateTone = tone,
  details = [],
}: ResolutionBannerProps) {
  const toneClass = toneClasses[tone];
  const stateClass = stateToneClasses[stateTone];
  const isResolved = Boolean(stateLabel && (stateLabel.toLowerCase().includes("resolved") || stateLabel.toLowerCase().includes("complete")));
  const isPending = Boolean(!stateLabel || stateLabel.toLowerCase().includes("waiting") || stateLabel.toLowerCase().includes("pending"));

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{kind} resolution</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{summary}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${toneClass}`}>
            {kind}
          </div>
          {stateLabel ? (
            <div className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${stateClass}`}>
              {stateLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Outcome</p>
        <p className="mt-3 text-lg font-semibold text-white">{outcome}</p>
        {contextLabel || progressLabel ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {contextLabel ? (
              <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                {contextLabel}
              </span>
            ) : null}
            {progressLabel ? (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-50">
                {progressLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100">
        <span
          className={`rounded-full border px-3 py-1 ${
            isPending ? "border-amber-200/25 bg-amber-200/12 text-amber-50" : "border-white/10 bg-slate-900/80 text-slate-200"
          }`}
        >
          {kind} lane
        </span>
        <span
          className={`rounded-full border px-3 py-1 ${
            isResolved ? "border-emerald-200/25 bg-emerald-200/12 text-emerald-50" : "border-white/10 bg-slate-900/80 text-slate-200"
          }`}
        >
          {stateLabel ?? "Pending state"}
        </span>
        <span
          className={`rounded-full border px-3 py-1 ${
            progressLabel ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-50" : "border-white/10 bg-slate-900/80 text-slate-200"
          }`}
        >
          {progressLabel ?? "Waiting for progression"}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Pending",
            detail: "Waiting for the room to resolve this lane.",
            active: !stateLabel || stateLabel.toLowerCase().includes("waiting") || stateLabel.toLowerCase().includes("pending"),
          },
          {
            label: "Resolved",
            detail: "A concrete result has been surfaced and can be scanned quickly.",
            active: isResolved,
          },
          {
            label: "Reversible",
            detail: "The room can still recover, reconnect, or reopen from here.",
            active: Boolean(stateLabel && stateLabel.toLowerCase().includes("complete")),
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-3xl border p-4 text-sm ${
              item.active
                ? item.label === "Resolved"
                  ? "border-emerald-300/25 bg-emerald-300/10 text-white"
                  : "border-cyan-300/25 bg-cyan-300/10 text-white"
                : "border-white/10 bg-slate-900/80 text-slate-300"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">{item.label}</p>
            <p className="mt-2 leading-6">{item.detail}</p>
          </div>
        ))}
      </div>

      {details.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {details.map((detail) => (
            <div key={detail} className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200/82">
              {detail}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
