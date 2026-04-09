import type { BongCall, BongSummary } from './bongs.js';
import { summarizeBongs } from './bongs.js';
import type { TeamScore, TeamSide } from './types.js';
import type { TrucoRulesState } from './rules.js';
import type { TrickOutcome } from './tricks.js';
import { getTrucoCallPoints } from './truco.js';

export interface HandScoreAward {
  team: TeamSide;
  points: number;
  source: 'truco' | 'envido';
}

export interface HandScoreState {
  trickOutcome: TrickOutcome | null;
  endedByFold: TeamSide | null;
  trucoAward: HandScoreAward | null;
  envidoAward: HandScoreAward | null;
  bongSummary: BongSummary;
  totalPointsByTeam: TeamScore;
}

export interface HandScorePointsBySource {
  truco: number;
  envido: number;
  total: number;
}

export interface HandScorePolicy {
  hasTrucoAward: boolean;
  hasEnvidoAward: boolean;
  hasAnyAward: boolean;
  awardCount: number;
  awardSources: Array<HandScoreAward['source']>;
  totalPoints: number;
  scoreDeltaByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  endedByFold: TeamSide | null;
  scoreByTeam: TeamScore;
  bongSummary: BongSummary;
}

export interface HandScoreBreakdown {
  awards: HandScoreAward[];
  awardCount: number;
  awardSources: Array<HandScoreAward['source']>;
  pointsBySource: HandScorePointsBySource;
  scoreByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  endedByFold: TeamSide | null;
  bongSummary: BongSummary;
}

export interface HandScoreInput {
  trickOutcome: TrickOutcome | null;
  truco: TrucoRulesState;
  endedByFold?: TeamSide | null;
  envidoAward?: HandScoreAward | null;
  bongs?: BongCall[];
}

export function createEmptyHandScoreState(): HandScoreState {
  return {
    trickOutcome: null,
    endedByFold: null,
    trucoAward: null,
    envidoAward: null,
    bongSummary: {
      effectiveBongs: 0,
      rawCalls: 0,
    },
    totalPointsByTeam: { A: 0, B: 0 },
  };
}

function getOpponentTeam(team: TeamSide): TeamSide {
  return team === 'A' ? 'B' : 'A';
}

export function getHandAwards(handScore: HandScoreState) {
  const awards: HandScoreAward[] = [];

  if (handScore.trucoAward) {
    awards.push(handScore.trucoAward);
  }

  if (handScore.envidoAward) {
    awards.push(handScore.envidoAward);
  }

  return awards;
}

export function getHandAwardSources(handScore: HandScoreState) {
  return getHandAwards(handScore).map((award) => award.source);
}

export function getHandScorePointsBySource(handScore: HandScoreState): HandScorePointsBySource {
  const truco = handScore.trucoAward?.points ?? 0;
  const envido = handScore.envidoAward?.points ?? 0;

  return {
    truco,
    envido,
    total: truco + envido,
  };
}

export function getHandScoreBreakdown(handScore: HandScoreState): HandScoreBreakdown {
  const awards = getHandAwards(handScore);
  const pointsBySource = getHandScorePointsBySource(handScore);
  const winningTeam =
    handScore.totalPointsByTeam.A === handScore.totalPointsByTeam.B
      ? null
      : handScore.totalPointsByTeam.A > handScore.totalPointsByTeam.B
        ? 'A'
        : 'B';

  return {
    awards,
    awardCount: awards.length,
    awardSources: awards.map((award) => award.source),
    pointsBySource,
    scoreByTeam: {
      A: handScore.totalPointsByTeam.A,
      B: handScore.totalPointsByTeam.B,
    },
    winningTeam,
    isTie: winningTeam === null,
    endedByFold: handScore.endedByFold,
    bongSummary: handScore.bongSummary,
  };
}

export function getHandScorePolicy(handScore: HandScoreState): HandScorePolicy {
  const breakdown = getHandScoreBreakdown(handScore);

  return {
    hasTrucoAward: handScore.trucoAward !== null,
    hasEnvidoAward: handScore.envidoAward !== null,
    hasAnyAward: breakdown.awardCount > 0,
    awardCount: breakdown.awardCount,
    awardSources: breakdown.awardSources,
    totalPoints: breakdown.pointsBySource.total,
    scoreDeltaByTeam: {
      A: handScore.totalPointsByTeam.A,
      B: handScore.totalPointsByTeam.B,
    },
    winningTeam: breakdown.winningTeam,
    isTie: breakdown.isTie,
    endedByFold: breakdown.endedByFold,
    scoreByTeam: breakdown.scoreByTeam,
    bongSummary: breakdown.bongSummary,
  };
}

export function getTrucoHandPoints(
  truco: TrucoRulesState,
  outcome: 'normal' | 'fold',
) {
  if (outcome === 'fold') {
    if (truco.window?.status === 'open') {
      return getTrucoCallPoints(truco.window.call).declinedPoints;
    }

    return truco.lastResolution?.pointsAwarded ?? 1;
  }

  if (truco.lastResolution) {
    return truco.lastResolution.pointsAwarded;
  }

  if (truco.window?.status === 'open') {
    return getTrucoCallPoints(truco.window.call).acceptedPoints;
  }

  return 1;
}

export function resolveHandScore(input: HandScoreInput): HandScoreState {
  const bongSummary = summarizeBongs(input.bongs ?? []);
  const endedByFold = input.endedByFold ?? null;
  const trickWinnerTeam = endedByFold ? getOpponentTeam(endedByFold) : input.trickOutcome?.winnerTeam ?? null;
  const trucoAward =
    trickWinnerTeam === null
      ? null
      : {
          team: trickWinnerTeam,
          points: getTrucoHandPoints(input.truco, endedByFold ? 'fold' : 'normal'),
          source: 'truco' as const,
        };
  const totalPointsByTeam: TeamScore = { A: 0, B: 0 };

  if (trucoAward) {
    totalPointsByTeam[trucoAward.team] += trucoAward.points;
  }

  if (input.envidoAward) {
    totalPointsByTeam[input.envidoAward.team] += input.envidoAward.points;
  }

  return {
    trickOutcome: input.trickOutcome,
    endedByFold,
    trucoAward,
    envidoAward: input.envidoAward ?? null,
    bongSummary,
    totalPointsByTeam,
  };
}
