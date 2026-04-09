type CantoOption = {
  label: string;
  detail: string;
  tone?: "cyan" | "emerald" | "amber";
};

type CantoStateShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  stageLabel: string;
  callLabel: string;
  responseLabel: string;
  attentionLabel?: string;
  attentionDescription?: string;
  responsePending?: boolean;
  options?: CantoOption[];
  footnote?: string;
};

const optionToneClasses: Record<NonNullable<CantoOption["tone"]>, string> = {
  cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-50",
  emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-50",
  amber: "border-amber-300/20 bg-amber-300/10 text-amber-50",
};

export function CantoStateShell({
  eyebrow,
  title,
  description,
  stageLabel,
  callLabel,
  responseLabel,
  attentionLabel,
  attentionDescription,
  responsePending = false,
  options = [],
  footnote,
}: CantoStateShellProps) {
  return (
    <section className="rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50">
            {stageLabel}
          </div>
          {attentionLabel ? (
            <div
              className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                responsePending
                  ? "border-amber-200/25 bg-amber-200/12 text-amber-50"
                  : "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
              }`}
            >
              {attentionLabel}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100">
        <span
          className={`rounded-full border px-3 py-1 ${
            responsePending ? "border-amber-200/25 bg-amber-200/12 text-amber-50" : "border-white/10 bg-slate-950/80 text-slate-200"
          }`}
        >
          {responsePending ? "Respuesta pendiente" : "Respuesta lista"}
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-slate-200">{stageLabel}</span>
        <span
          className={`rounded-full border px-3 py-1 ${
            attentionLabel ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-50" : "border-white/10 bg-slate-950/80 text-slate-200"
          }`}
        >
          {attentionLabel ?? "Canto abierto"}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Canto activo</p>
          <p className="mt-3 text-lg font-semibold text-white">{callLabel}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Respuesta</p>
          <p className="mt-3 text-lg font-semibold text-white">{responseLabel}</p>
          {attentionDescription ? (
            <p className="mt-2 text-sm text-slate-300">{attentionDescription}</p>
          ) : null}
        </div>
      </div>

      {options.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {options.map((option) => {
            const tone = option.tone ?? "cyan";
            return (
              <div key={option.label} className={`rounded-3xl border p-4 ${optionToneClasses[tone]}`}>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">{option.label}</p>
                <p className="mt-2 text-sm leading-6 text-white/80">{option.detail}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {footnote ? (
        <p className="mt-6 text-sm leading-7 text-slate-400">{footnote}</p>
      ) : null}
    </section>
  );
}
