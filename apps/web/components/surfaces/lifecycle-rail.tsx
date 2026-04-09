export type LifecycleItem = {
  label: string;
  detail: string;
  tone?: "cyan" | "amber" | "emerald" | "rose";
  active?: boolean;
  done?: boolean;
};

type LifecycleRailProps = {
  title: string;
  subtitle: string;
  statusLabel: string;
  items: LifecycleItem[];
  compact?: boolean;
};

const toneClasses: Record<NonNullable<LifecycleItem["tone"]>, string> = {
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-50",
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-50",
  emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-50",
  rose: "border-rose-300/25 bg-rose-300/10 text-rose-50",
};

export function LifecycleRail({ title, subtitle, statusLabel, items, compact = false }: LifecycleRailProps) {
  const doneCount = items.filter((item) => item.done).length;
  const activeLabel = items.find((item) => item.active)?.label ?? items.find((item) => !item.done)?.label ?? items[0]?.label ?? "Esperando";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/70">{title}</p>
          <p className={`mt-3 max-w-2xl text-sm leading-7 text-slate-300 ${compact ? "sm:text-sm" : "sm:text-base"}`}>
            {subtitle}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-100">
          {statusLabel}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
        <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
          {doneCount}/{items.length} listos
        </span>
        <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">Activo: {activeLabel}</span>
        <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">{compact ? "Compacto" : "Completo"}</span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full border border-white/10 bg-slate-900/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-300 to-emerald-300 transition-all"
          style={{ width: `${items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0}%` }}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/80 p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => {
            const tone = item.tone ?? "cyan";
            const toneClass = toneClasses[tone];
            const chipClass = item.active
              ? toneClass
              : item.done
                ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                : "border-white/10 bg-slate-950/80 text-slate-200";

            return (
              <div key={item.label} className={`rounded-2xl border px-3 py-2 text-xs ${chipClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold uppercase tracking-[0.18em]">{item.label}</span>
                  <span className="rounded-full border border-white/10 bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                    {item.done ? "Listo" : item.active ? "Ahora" : "Siguiente"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-5 opacity-90">{item.detail}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">Paso {index + 1}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const tone = item.tone ?? "cyan";
          const toneClass = toneClasses[tone];
          const activeClass = item.active
            ? toneClass
            : item.done
              ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-50"
              : "border-white/10 bg-slate-900/80 text-slate-200";

          return (
            <div key={item.label} className={`rounded-3xl border p-4 ${activeClass}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
                    {item.done ? "Listo" : item.active ? "Activo" : "En cola"}
                  </p>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em]">{item.label}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 opacity-90">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
