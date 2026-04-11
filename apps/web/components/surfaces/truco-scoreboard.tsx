type TeamSide = "A" | "B";

type TrucoScoreboardProps = {
  teamA: number;
  teamB: number;
  targetScore: number;
  compact?: boolean;
};

function getTeamTone(side: TeamSide) {
  if (side === "A") {
    return {
      border: "border-cyan-300/25",
      bg: "bg-cyan-300/8",
      badge: "text-cyan-100/70",
      number: "text-cyan-50",
      tally: "bg-cyan-200",
      slash: "bg-cyan-100",
    };
  }

  return {
    border: "border-emerald-300/25",
    bg: "bg-emerald-300/8",
    badge: "text-emerald-100/70",
    number: "text-emerald-50",
    tally: "bg-emerald-200",
    slash: "bg-emerald-100",
  };
}

function TrucoTallyGroup({
  count,
  tone,
  compact = false,
}: {
  count: number;
  tone: ReturnType<typeof getTeamTone>;
  compact?: boolean;
}) {
  const strokeClass = compact ? "h-1.5" : "h-2";
  const verticalClass = compact ? "w-1.5" : "w-2";
  const frameSize = compact ? "h-9 w-9" : "h-11 w-11";

  return (
    <div className={`relative rounded-xl border border-white/8 bg-slate-950/65 ${frameSize}`}>
      {count >= 1 ? <span className={`absolute left-1.5 top-1.5 right-1.5 ${strokeClass} ${tone.tally}`} /> : null}
      {count >= 2 ? <span className={`absolute right-1.5 top-1.5 bottom-1.5 ${verticalClass} ${tone.tally}`} /> : null}
      {count >= 3 ? <span className={`absolute bottom-1.5 left-1.5 right-1.5 ${strokeClass} ${tone.tally}`} /> : null}
      {count >= 4 ? <span className={`absolute left-1.5 top-1.5 bottom-1.5 ${verticalClass} ${tone.tally}`} /> : null}
      {count >= 5 ? <span className={`absolute left-1/2 top-1/2 h-1 w-[82%] -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] ${tone.slash}`} /> : null}
    </div>
  );
}

function TeamScorePanel({
  side,
  score,
  targetScore,
  compact = false,
}: {
  side: TeamSide;
  score: number;
  targetScore: number;
  compact?: boolean;
}) {
  const tone = getTeamTone(side);
  const completeGroups = Math.floor(score / 5);
  const partialGroup = score % 5;
  const tallyGroups = Array.from({ length: completeGroups }, () => 5);

  if (partialGroup > 0 || tallyGroups.length === 0) {
    tallyGroups.push(partialGroup);
  }

  return (
    <div className={`rounded-[1.6rem] border ${tone.border} ${tone.bg} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-[0.2em] ${tone.badge}`}>Equipo {side}</p>
          <p className={`mt-2 font-semibold ${compact ? "text-3xl" : "text-4xl"} ${tone.number}`}>{score}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
          a {targetScore}
        </span>
      </div>
      <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-4"}`}>
        {tallyGroups.map((groupCount, index) => (
          <TrucoTallyGroup
            key={`${side}-${index}-${groupCount}`}
            count={groupCount}
            tone={tone}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

export function TrucoScoreboard({
  teamA,
  teamB,
  targetScore,
  compact = false,
}: TrucoScoreboardProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TeamScorePanel side="A" score={teamA} targetScore={targetScore} compact={compact} />
      <TeamScorePanel side="B" score={teamB} targetScore={targetScore} compact={compact} />
    </div>
  );
}
