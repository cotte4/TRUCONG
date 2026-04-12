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
      ? "game-panel-emerald text-emerald-100"
      : accent === "amber"
        ? "game-panel-amber text-amber-100"
        : "game-panel-cyan text-cyan-100";

  return (
    <article className={`game-panel game-briefing-lines rounded-[2rem] p-6 ${palette}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/65">{eyebrow}</p>
      <h2 className="game-screen-title mt-3 text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">{description}</p>
      {footer ? <div className="mt-6">{footer}</div> : null}
    </article>
  );
}
