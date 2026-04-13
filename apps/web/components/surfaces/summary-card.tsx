import type { ReactNode } from "react";

type SummaryCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  accent?: string;
  footer?: ReactNode;
};

export function SummaryCard({
  eyebrow,
  title,
  description,
  accent = "cyan",
  footer,
}: SummaryCardProps) {
  const accentBorder =
    accent === "emerald"
      ? "border-emerald-300/22"
      : accent === "amber"
        ? "border-amber-300/22"
        : "border-cyan-300/22";

  const accentText =
    accent === "emerald"
      ? "text-emerald-200/80"
      : accent === "amber"
        ? "text-amber-200/80"
        : "text-cyan-200/80";

  return (
    <article className={`trap-panel rounded-[2rem] p-6 ${accentBorder}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.28em] ${accentText}`}>{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/85">{description}</p>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </article>
  );
}
