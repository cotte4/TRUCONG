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
  const palette =
    accent === "emerald"
      ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-100"
      : accent === "amber"
        ? "border-amber-300/20 bg-amber-300/8 text-amber-100"
        : "border-cyan-300/20 bg-cyan-300/8 text-cyan-100";

  return (
    <article className={`rounded-[2rem] border p-6 shadow-2xl backdrop-blur ${palette}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/65">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">{description}</p>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </article>
  );
}
