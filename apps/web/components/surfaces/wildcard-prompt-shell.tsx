type WildcardOption = {
  label: string;
  detail: string;
  recommended?: boolean;
};

type WildcardPromptShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  flowLabel?: string;
  flowSteps?: string[];
  activeFlowStep?: number;
  selectedLabel?: string | null;
  attentionLabel?: string;
  attentionDescription?: string;
  highlightSelected?: boolean;
  responsePending?: boolean;
  options?: WildcardOption[];
  footnote?: string;
};

export function WildcardPromptShell({
  eyebrow,
  title,
  description,
  statusLabel,
  flowLabel,
  flowSteps = [],
  activeFlowStep = 0,
  selectedLabel = null,
  attentionLabel,
  attentionDescription,
  highlightSelected = false,
  responsePending = false,
  options = [],
  footnote,
}: WildcardPromptShellProps) {
  return (
    <section
      className={`rounded-[2rem] border p-6 shadow-2xl backdrop-blur ${
        highlightSelected
          ? "border-amber-200/30 bg-amber-200/12 shadow-amber-950/20"
          : "border-amber-300/20 bg-amber-300/10 shadow-amber-950/20"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-100/80">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-50/88">{description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-full border border-amber-300/25 bg-amber-300/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-50">
            {statusLabel}
          </div>
          {flowLabel ? (
            <div
              className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                responsePending
                  ? "border-amber-200/25 bg-amber-200/12 text-amber-50"
                  : "border-white/10 bg-slate-950/80 text-slate-200"
              }`}
            >
              {flowLabel}
            </div>
          ) : null}
          {attentionLabel ? (
            <div
              className={`rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                responsePending || highlightSelected
                  ? "border-amber-100/25 bg-amber-100/12 text-white"
                  : "border-white/10 bg-slate-900/80 text-slate-200"
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
          {responsePending ? "Selección pendiente" : "Selección lista"}
        </span>
        <span
          className={`rounded-full border px-3 py-1 ${
            highlightSelected ? "border-emerald-200/25 bg-emerald-200/12 text-emerald-50" : "border-white/10 bg-slate-950/80 text-slate-200"
          }`}
        >
          {highlightSelected ? "Elección fijada" : "Comodín abierto"}
        </span>
      </div>

      {flowSteps.length > 0 ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pasos</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {flowSteps.map((step, index) => {
              const isActive = index === activeFlowStep;
              const isDone = index < activeFlowStep;
              return (
                <div
                  key={step}
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    isActive
                      ? "border-amber-200/30 bg-amber-200/10 text-white"
                      : isDone
                        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                        : "border-white/10 bg-slate-950/80 text-slate-300"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                    {isDone ? "Listo" : isActive ? "Activo" : "En cola"}
                  </p>
                  <p className="mt-2">{step}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className={`rounded-3xl border p-4 ${
            highlightSelected
              ? "border-amber-100/25 bg-amber-100/10"
              : "border-white/10 bg-slate-950/80"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Comodín elegido</p>
          <p className="mt-3 text-lg font-semibold text-white">{selectedLabel ?? "Sin comodín"}</p>
          {attentionDescription ? (
            <p className="mt-2 text-sm text-slate-300">{attentionDescription}</p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Elegir</p>
          <p className="mt-3 text-lg font-semibold text-white">
            {selectedLabel ? "Confirmá la lectura del comodín" : "Elegí cómo va a jugar el comodín"}
          </p>
          {responsePending ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-200/25 bg-amber-200/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-50">
                Elección pendiente
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {options.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              disabled
              className={`rounded-3xl border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-75 ${
                option.recommended
                  ? "border-amber-100/30 bg-amber-100/12 text-white"
                  : "border-white/10 bg-slate-950/80 text-slate-100"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">{option.label}</p>
                {option.recommended ? (
                  <span className="rounded-full border border-amber-200/25 bg-amber-200/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-50">
                    {responsePending ? "Elección pendiente" : "Recomendado"}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{option.detail}</p>
            </button>
          ))}
        </div>
      ) : null}

      {footnote ? <p className="mt-6 text-sm leading-7 text-amber-50/80">{footnote}</p> : null}
    </section>
  );
}
