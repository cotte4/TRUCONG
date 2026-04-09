"use client";

import Link from "next/link";

type ActionSpec = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
};

type ConnectionStateCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  tone?: "cyan" | "amber" | "rose" | "emerald";
  compact?: boolean;
  details?: string[];
  steps?: string[];
  activeStepIndex?: number;
  primaryAction?: ActionSpec;
  secondaryAction?: ActionSpec;
};

const toneClasses: Record<NonNullable<ConnectionStateCardProps["tone"]>, string> = {
  cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-50",
  amber: "border-amber-300/20 bg-amber-300/10 text-amber-50",
  rose: "border-rose-300/20 bg-rose-300/10 text-rose-50",
  emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-50",
};

function ActionButton({
  action,
  className,
}: {
  action: ActionSpec;
  className: string;
}) {
  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export function ConnectionStateCard({
  eyebrow,
  title,
  description,
  status,
  tone = "cyan",
  compact = false,
  details = [],
  steps = [],
  activeStepIndex = 0,
  primaryAction,
  secondaryAction,
}: ConnectionStateCardProps) {
  const toneClass = toneClasses[tone];
  const doneCount = steps.filter((_, index) => index < activeStepIndex).length;
  const activeStepLabel = steps[activeStepIndex] ?? steps[steps.length - 1] ?? "Waiting";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className={`mt-3 max-w-2xl text-sm leading-7 text-slate-200/78 ${compact ? "sm:text-sm" : "sm:text-base"}`}>
            {description}
          </p>
        </div>
        <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${toneClass}`}>{status}</div>
      </div>

      {steps.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100">
          <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-slate-200">
            {doneCount}/{steps.length} settled
          </span>
          <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-slate-200">
            Active {activeStepLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-slate-200">
            {compact ? "Compact recovery" : "Full recovery"}
          </span>
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Recovery lane</p>
        <p className="mt-2 text-sm leading-6 text-slate-200/82">
          {steps.length > 0
            ? `The room is moving through ${activeStepLabel.toLowerCase()} and will continue to resolve the seat before the table becomes fully interactive.`
            : "The room is reconnecting and will keep the current seat readable while the socket and snapshot settle."}
        </p>
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

      {steps.length > 0 ? (
        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Transition</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => {
              const isActive = index === activeStepIndex;
              const isDone = index < activeStepIndex;
              return (
                <div
                  key={step}
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    isActive
                      ? "border-cyan-300/30 bg-cyan-300/10 text-white"
                      : isDone
                        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                        : "border-white/10 bg-slate-950/80 text-slate-300"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                    {isDone ? "Done" : isActive ? "Active" : "Queued"}
                  </p>
                  <p className="mt-2">{step}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {primaryAction || secondaryAction ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {primaryAction ? (
            <ActionButton
              action={primaryAction}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                primaryAction.variant === "secondary"
                  ? "border border-white/12 bg-white/8 text-slate-100 hover:bg-white/12"
                  : "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
              }`}
            />
          ) : null}
          {secondaryAction ? (
            <ActionButton
              action={secondaryAction}
              className="rounded-2xl border border-white/12 bg-slate-950/72 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900"
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
