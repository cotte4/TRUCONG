import type { BongSummary } from './bongs.js';
import type { HandScoreAward, HandScoreState } from './hand.js';
import { getHandAwards, getHandScorePointsBySource } from './hand.js';
import type { TeamScore, TeamSide, CardSignature } from './types.js';
import type { ResolvedTrickPlay, TrickOutcome } from './tricks.js';

export interface ResolvedTrickSummaryPlay {
  seatId: string;
  team: TeamSide;
  card: CardSignature;
  effectiveCard: CardSignature;
  effectiveStrength: number;
  isWildcard: boolean;
  wildcardId: string | null;
}

export interface ResolvedTrickSummary {
  handId: string;
  playCount: number;
  winnerTeam: TeamSide | null;
  winningSeatId: string | null;
  isTie: boolean;
  tieReason: TrickOutcome['tieReason'];
  plays: ResolvedTrickSummaryPlay[];
}

export interface HandFinalizationSummary {
  handId: string | null;
  resolvedTrick: ResolvedTrickSummary | null;
  scoreDeltaByTeam: TeamScore;
  totalPointsByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  trucoAward: HandScoreAward | null;
  envidoAward: HandScoreAward | null;
  endedByFold: TeamSide | null;
  bongSummary: BongSummary;
  awardSources: Array<'truco' | 'envido'>;
}

export interface ResolvedTrickSnapshot {
  type: 'trick/resolved';
  phase: 'trick_resolution';
  summary: ResolvedTrickSummary;
  payload: ResolvedTrickEventPayload;
  policy: ResolvedTrickLifecyclePolicy;
  handId: string;
  playCount: number;
  winnerTeam: TeamSide | null;
  winningSeatId: string | null;
  isTie: boolean;
  tieReason: TrickOutcome['tieReason'];
  winningCard: CardSignature | null;
  winningStrength: number | null;
  wildcardPlayCount: number;
  wildcardIds: string[];
}

export interface ResolvedTrickEventPayload {
  type: 'trick/resolved';
  phase: 'trick_resolution';
  handId: string;
  playCount: number;
  winnerTeam: TeamSide | null;
  winningSeatId: string | null;
  isTie: boolean;
  tieReason: TrickOutcome['tieReason'];
  summary: ResolvedTrickSummary;
  winningCard: CardSignature | null;
  winningStrength: number | null;
  wildcardPlayCount: number;
  wildcardIds: string[];
}

export interface HandFinalizationEventPayload {
  type: 'hand/finalized';
  phase: 'hand_scoring';
  handId: string | null;
  winningTeam: TeamSide | null;
  isTie: boolean;
  endedByFold: TeamSide | null;
  summary: HandFinalizationSummary;
  pointsBySource: {
    truco: number;
    envido: number;
    total: number;
  };
  awards: HandScoreAward[];
}

export interface ResolvedTrickLifecyclePolicy {
  handId: string;
  nextPhase: 'action_turn' | 'hand_scoring';
  shouldFinalizeHand: boolean;
  isTerminal: boolean;
  winnerTeam: TeamSide | null;
  isTie: boolean;
  tieReason: TrickOutcome['tieReason'];
  winningSeatId: string | null;
  playCount: number;
  wildcardPlayCount: number;
}

export interface HandFinalizationPolicy {
  handId: string | null;
  nextPhase: 'action_turn';
  shouldAdvanceToNextHand: boolean;
  isTerminal: boolean;
  winningTeam: TeamSide | null;
  isTie: boolean;
  awardCount: number;
  awardSources: Array<'truco' | 'envido'>;
  pointsBySource: {
    truco: number;
    envido: number;
    total: number;
  };
  scoreDeltaByTeam: TeamScore;
  scoreByTeam: TeamScore;
  endedByFold: TeamSide | null;
}

export interface ResolvedTrickLifecycleBundle {
  type: 'trick/resolved';
  phase: 'trick_resolution';
  summary: ResolvedTrickSummary;
  payload: ResolvedTrickEventPayload;
  policy: ResolvedTrickLifecyclePolicy;
  handId: string;
  playCount: number;
  winnerTeam: TeamSide | null;
  winningSeatId: string | null;
  isTie: boolean;
  tieReason: TrickOutcome['tieReason'];
  winningCard: CardSignature | null;
  winningStrength: number | null;
  wildcardPlayCount: number;
  wildcardIds: string[];
}

export interface HandFinalizationLifecycleBundle {
  type: 'hand/finalized';
  phase: 'hand_scoring';
  summary: HandFinalizationSummary;
  payload: HandFinalizationEventPayload;
  policy: HandFinalizationPolicy;
  scoreDeltaByTeam: TeamScore;
  handId: string | null;
  winningTeam: TeamSide | null;
  isTie: boolean;
  endedByFold: TeamSide | null;
  totalPointsByTeam: TeamScore;
  awardSources: Array<'truco' | 'envido'>;
  resolvedTrick: ResolvedTrickSummary | null;
  bongSummary: BongSummary;
  pointsBySource: {
    truco: number;
    envido: number;
    total: number;
  };
  awards: HandScoreAward[];
}

export interface HandFinalizationSnapshot {
  type: 'hand/finalized';
  phase: 'hand_scoring';
  summary: HandFinalizationSummary;
  policy: HandFinalizationPolicy;
  payload: HandFinalizationEventPayload;
  handId: string | null;
  winningTeam: TeamSide | null;
  isTie: boolean;
  endedByFold: TeamSide | null;
  scoreDeltaByTeam: TeamScore;
  totalPointsByTeam: TeamScore;
  awardSources: Array<'truco' | 'envido'>;
  resolvedTrick: ResolvedTrickSummary | null;
  bongSummary: BongSummary;
  pointsBySource: {
    truco: number;
    envido: number;
    total: number;
  };
  awards: HandScoreAward[];
}

function cloneTeamScore(score: TeamScore): TeamScore {
  return {
    A: score.A,
    B: score.B,
  };
}

export function getResolvedTrickSummary(outcome: TrickOutcome): ResolvedTrickSummary {
  const plays = outcome.plays.map((play: ResolvedTrickPlay) => ({
    seatId: play.seatId,
    team: play.team,
    card: play.card,
    effectiveCard: play.effectiveCard,
    effectiveStrength: play.effectiveStrength,
    isWildcard: Boolean(play.isWildcard),
    wildcardId: play.wildcardId ?? null,
  }));

  return {
    handId: outcome.handId,
    playCount: outcome.plays.length,
    winnerTeam: outcome.winnerTeam,
    winningSeatId: outcome.winningPlay?.seatId ?? null,
    isTie: outcome.isTie,
    tieReason: outcome.tieReason,
    plays,
  };
}

export function buildResolvedTrickEventPayload(outcome: TrickOutcome): ResolvedTrickEventPayload {
  const summary = getResolvedTrickSummary(outcome);

  return {
    type: 'trick/resolved',
    phase: 'trick_resolution',
    handId: summary.handId,
    playCount: summary.playCount,
    winnerTeam: summary.winnerTeam,
    winningSeatId: summary.winningSeatId,
    isTie: summary.isTie,
    tieReason: summary.tieReason,
    summary,
    winningCard: outcome.winningPlay?.effectiveCard ?? null,
    winningStrength: outcome.winningPlay?.effectiveStrength ?? null,
    wildcardPlayCount: outcome.plays.filter((play) => play.isWildcard).length,
    wildcardIds: outcome.plays
      .map((play) => play.wildcardId ?? null)
      .filter((wildcardId): wildcardId is string => wildcardId !== null),
  };
}

export function getResolvedTrickLifecyclePolicy(outcome: TrickOutcome): ResolvedTrickLifecyclePolicy {
  const summary = getResolvedTrickSummary(outcome);

  return {
    handId: summary.handId,
    nextPhase: summary.isTie ? 'action_turn' : 'hand_scoring',
    shouldFinalizeHand: !summary.isTie,
    isTerminal: false,
    winnerTeam: summary.winnerTeam,
    isTie: summary.isTie,
    tieReason: summary.tieReason,
    winningSeatId: summary.winningSeatId,
    playCount: summary.playCount,
    wildcardPlayCount: outcome.plays.filter((play) => play.isWildcard).length,
  };
}

export function buildResolvedTrickLifecycleBundle(outcome: TrickOutcome): ResolvedTrickLifecycleBundle {
  const summary = getResolvedTrickSummary(outcome);
  const payload = buildResolvedTrickEventPayload(outcome);

  return {
    type: 'trick/resolved',
    phase: 'trick_resolution',
    summary,
    payload,
    policy: getResolvedTrickLifecyclePolicy(outcome),
    handId: summary.handId,
    playCount: summary.playCount,
    winnerTeam: summary.winnerTeam,
    winningSeatId: summary.winningSeatId,
    isTie: summary.isTie,
    tieReason: summary.tieReason,
    winningCard: payload.winningCard,
    winningStrength: payload.winningStrength,
    wildcardPlayCount: payload.wildcardPlayCount,
    wildcardIds: [...payload.wildcardIds],
  };
}

export function getResolvedTrickSnapshot(outcome: TrickOutcome): ResolvedTrickSnapshot {
  const summary = getResolvedTrickSummary(outcome);
  const payload = buildResolvedTrickEventPayload(outcome);

  return {
    type: 'trick/resolved',
    phase: 'trick_resolution',
    summary,
    payload,
    policy: getResolvedTrickLifecyclePolicy(outcome),
    handId: summary.handId,
    playCount: summary.playCount,
    winnerTeam: summary.winnerTeam,
    winningSeatId: summary.winningSeatId,
    isTie: summary.isTie,
    tieReason: summary.tieReason,
    winningCard: payload.winningCard,
    winningStrength: payload.winningStrength,
    wildcardPlayCount: payload.wildcardPlayCount,
    wildcardIds: [...payload.wildcardIds],
  };
}

export function getHandScoreDeltaByTeam(handScore: HandScoreState): TeamScore {
  return cloneTeamScore(handScore.totalPointsByTeam);
}

export function getHandWinningTeam(handScore: HandScoreState): TeamSide | null {
  const delta = getHandScoreDeltaByTeam(handScore);

  if (delta.A === delta.B) {
    return null;
  }

  return delta.A > delta.B ? 'A' : 'B';
}

export function getHandFinalizationSummary(handScore: HandScoreState): HandFinalizationSummary {
  const resolvedTrick = handScore.trickOutcome ? getResolvedTrickSummary(handScore.trickOutcome) : null;
  const awardSources: Array<'truco' | 'envido'> = [];

  if (handScore.trucoAward) {
    awardSources.push('truco');
  }

  if (handScore.envidoAward) {
    awardSources.push('envido');
  }

  return {
    handId: handScore.trickOutcome?.handId ?? null,
    resolvedTrick,
    scoreDeltaByTeam: getHandScoreDeltaByTeam(handScore),
    totalPointsByTeam: cloneTeamScore(handScore.totalPointsByTeam),
    winningTeam: getHandWinningTeam(handScore),
    isTie: getHandWinningTeam(handScore) === null,
    trucoAward: handScore.trucoAward,
    envidoAward: handScore.envidoAward,
    endedByFold: handScore.endedByFold,
    bongSummary: handScore.bongSummary,
    awardSources,
  };
}

export function buildHandFinalizationEventPayload(handScore: HandScoreState): HandFinalizationEventPayload {
  const summary = getHandFinalizationSummary(handScore);

  return {
    type: 'hand/finalized',
    phase: 'hand_scoring',
    handId: summary.handId,
    winningTeam: summary.winningTeam,
    isTie: summary.isTie,
    endedByFold: summary.endedByFold,
    summary,
    pointsBySource: getHandScorePointsBySource(handScore),
    awards: getHandAwards(handScore),
  };
}

export function getHandFinalizationPolicy(handScore: HandScoreState): HandFinalizationPolicy {
  const summary = getHandFinalizationSummary(handScore);

  return {
    handId: summary.handId,
    nextPhase: 'action_turn',
    shouldAdvanceToNextHand: true,
    isTerminal: false,
    winningTeam: summary.winningTeam,
    isTie: summary.isTie,
    awardCount: summary.awardSources.length,
    awardSources: summary.awardSources,
    pointsBySource: getHandScorePointsBySource(handScore),
    scoreDeltaByTeam: summary.scoreDeltaByTeam,
    scoreByTeam: summary.totalPointsByTeam,
    endedByFold: summary.endedByFold,
  };
}

export function buildHandFinalizationLifecycleBundle(handScore: HandScoreState): HandFinalizationLifecycleBundle {
  const summary = getHandFinalizationSummary(handScore);
  const payload = buildHandFinalizationEventPayload(handScore);
  const pointsBySource = getHandScorePointsBySource(handScore);
  const awards = getHandAwards(handScore);

  return {
    type: 'hand/finalized',
    phase: 'hand_scoring',
    summary,
    payload,
    policy: getHandFinalizationPolicy(handScore),
    scoreDeltaByTeam: summary.scoreDeltaByTeam,
    handId: summary.handId,
    winningTeam: summary.winningTeam,
    isTie: summary.isTie,
    endedByFold: summary.endedByFold,
    totalPointsByTeam: summary.totalPointsByTeam,
    awardSources: [...summary.awardSources],
    resolvedTrick: summary.resolvedTrick,
    bongSummary: summary.bongSummary,
    pointsBySource,
    awards,
  };
}

export function getHandFinalizationSnapshot(handScore: HandScoreState): HandFinalizationSnapshot {
  const summary = getHandFinalizationSummary(handScore);
  const payload = buildHandFinalizationEventPayload(handScore);
  const pointsBySource = getHandScorePointsBySource(handScore);
  const awards = getHandAwards(handScore);

  return {
    type: 'hand/finalized',
    phase: 'hand_scoring',
    summary,
    policy: getHandFinalizationPolicy(handScore),
    payload,
    handId: summary.handId,
    winningTeam: summary.winningTeam,
    isTie: summary.isTie,
    endedByFold: summary.endedByFold,
    scoreDeltaByTeam: summary.scoreDeltaByTeam,
    totalPointsByTeam: summary.totalPointsByTeam,
    awardSources: [...summary.awardSources],
    resolvedTrick: summary.resolvedTrick,
    bongSummary: summary.bongSummary,
    pointsBySource,
    awards,
  };
}
