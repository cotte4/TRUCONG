"use client";

import { useEffect, useState } from "react";
import { TrucoScoreboard } from "@/components/surfaces/truco-scoreboard";

const STORAGE_KEY = "dimadong:manual-scorekeeper";

type TeamSide = "A" | "B";
type TargetScore = 11 | 15 | 30;
type ScoreState = { A: number; B: number };

const targetOptions: TargetScore[] = [11, 15, 30];
const deltaOptions = [1, 2, 3, 4] as const;

function clampScore(next: number) {
  return Math.max(0, next);
}

function getInitialScorekeeperState() {
  if (typeof window === "undefined") {
    return {
      targetScore: 15 as TargetScore,
      score: { A: 0, B: 0 } as ScoreState,
    };
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return {
      targetScore: 15 as TargetScore,
      score: { A: 0, B: 0 } as ScoreState,
    };
  }

  try {
    const parsed = JSON.parse(saved) as {
      targetScore?: TargetScore;
      score?: ScoreState;
    };

    return {
      targetScore:
        parsed.targetScore && targetOptions.includes(parsed.targetScore)
          ? parsed.targetScore
          : (15 as TargetScore),
      score: {
        A: clampScore(parsed.score?.A ?? 0),
        B: clampScore(parsed.score?.B ?? 0),
      },
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);

    return {
      targetScore: 15 as TargetScore,
      score: { A: 0, B: 0 } as ScoreState,
    };
  }
}

export function ManualScorekeeper() {
  const [targetScore, setTargetScore] = useState<TargetScore>(
    () => getInitialScorekeeperState().targetScore,
  );
  const [score, setScore] = useState<ScoreState>(
    () => getInitialScorekeeperState().score,
  );

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ targetScore, score }),
    );
  }, [score, targetScore]);

  const adjustScore = (team: TeamSide, delta: number) => {
    setScore((current) => ({
      ...current,
      [team]: clampScore(current[team] + delta),
    }));
  };

  const resetScore = () => {
    setScore({ A: 0, B: 0 });
  };

  const winner =
    score.A >= targetScore && score.A !== score.B
      ? "A"
      : score.B >= targetScore && score.B !== score.A
        ? "B"
        : null;

  return (
    <section className="rounded-[2rem] border border-fuchsia-300/16 bg-[linear-gradient(160deg,rgba(17,20,32,0.95),rgba(7,9,14,0.98))] p-6 shadow-[0_24px_80px_rgba(6,10,24,0.35)] backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fuchsia-200/72">
            Anotador manual
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Sumá los puntos sin armar una sala.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-slate-300">
            Este marcador queda guardado en tu navegador. Sirve para llevar una mesa casual o
            destrabar una partida cuando todavía no querés entrar al realtime.
          </p>
        </div>

        <button
          type="button"
          onClick={resetScore}
          className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Reiniciar
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {targetOptions.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTargetScore(value)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              targetScore === value
                ? "border-fuchsia-300/40 bg-fuchsia-400/14 text-fuchsia-50"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            A {value}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <TrucoScoreboard
          teamA={score.A}
          teamB={score.B}
          targetScore={targetScore}
          compact
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {(["A", "B"] as TeamSide[]).map((team) => {
          const isWinner = winner === team;
          const tone =
            team === "A"
              ? "border-cyan-300/22 bg-cyan-300/8"
              : "border-emerald-300/22 bg-emerald-300/8";

          return (
            <div
              key={team}
              className={`rounded-[1.5rem] border px-4 py-4 ${tone} ${isWinner ? "ring-1 ring-white/18" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/62">
                    Equipo {team}
                  </p>
                  <p className="mt-1 text-3xl font-black text-white">{score[team]}</p>
                </div>
                {isWinner ? (
                  <span className="rounded-full border border-amber-300/30 bg-amber-300/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">
                    Ganando
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {deltaOptions.map((delta) => (
                  <button
                    key={`${team}-plus-${delta}`}
                    type="button"
                    onClick={() => adjustScore(team, delta)}
                    className="rounded-[1rem] border border-white/10 bg-white/6 px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    +{delta}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => adjustScore(team, -1)}
                className="mt-3 w-full rounded-[1rem] border border-white/10 bg-slate-950/55 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
              >
                Restar 1
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
        {winner
          ? `Equipo ${winner} ya llego al objetivo de ${targetScore}.`
          : `Ningun equipo llego todavia a ${targetScore}.`}
      </div>
    </section>
  );
}
