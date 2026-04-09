import type { HandFinalizationSummary } from './lifecycle.js';
import type { TeamScore, TeamSide } from './types.js';

export interface MatchScoreState {
  targetScore: number;
  scoreByTeam: TeamScore;
  handId: string | null;
  handCount: number;
  lastHandDelta: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  isComplete: boolean;
  leadingTeam: TeamSide | null;
  pointsToWin: number;
  pointsNeededByTeam: TeamScore;
  scoreMargin: number;
}

export interface MatchScoreInput {
  targetScore: number;
  scoreByTeam: TeamScore;
  handSummary: HandFinalizationSummary | null;
  handCount?: number;
}

export interface MatchScorePolicy {
  handId: string | null;
  targetScore: number;
  nextPhase: 'action_turn' | 'match_end';
  shouldFinalizeMatch: boolean;
  isTerminal: boolean;
  winningTeam: TeamSide | null;
  isTie: boolean;
  leadingTeam: TeamSide | null;
  pointsToWin: number;
  pointsNeededByTeam: TeamScore;
  scoreMargin: number;
  scoreDeltaByTeam: TeamScore;
  scoreByTeam: TeamScore;
  handCount: number;
}

export interface MatchFinalizationSummary {
  handId: string | null;
  targetScore: number;
  scoreByTeam: TeamScore;
  scoreDeltaByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  leadingTeam: TeamSide | null;
  pointsToWin: number;
  pointsNeededByTeam: TeamScore;
  scoreMargin: number;
  handCount: number;
}

export interface MatchFinalizationEventPayload {
  type: 'match/finalized';
  phase: 'match_end';
  summary: MatchFinalizationSummary;
}

export interface MatchLifecycleBundle {
  type: 'match/finalized';
  phase: 'match_end';
  summary: MatchFinalizationSummary;
  payload: MatchFinalizationEventPayload;
  policy: MatchScorePolicy;
  scoreDeltaByTeam: TeamScore;
  handId: string | null;
  targetScore: number;
  scoreByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  leadingTeam: TeamSide | null;
  pointsToWin: number;
  pointsNeededByTeam: TeamScore;
  scoreMargin: number;
  handCount: number;
}

export interface MatchFinalizationSnapshot {
  type: 'match/finalized';
  phase: 'match_end';
  summary: MatchFinalizationSummary;
  policy: MatchScorePolicy;
  scoreDeltaByTeam: TeamScore;
  payload: MatchFinalizationEventPayload;
  handId: string | null;
  targetScore: number;
  scoreByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  leadingTeam: TeamSide | null;
  pointsToWin: number;
  pointsNeededByTeam: TeamScore;
  scoreMargin: number;
  handCount: number;
}

export interface MatchProgressionInput {
  state: MatchScoreState;
  handSummary: HandFinalizationSummary | null;
}

export interface MatchProgressionBundle extends MatchLifecycleBundle {
  state: MatchScoreState;
  isComplete: boolean;
}

export interface MatchProgressionSnapshot {
  type: 'match/finalized';
  phase: 'match_end';
  state: MatchScoreState;
  summary: MatchFinalizationSummary;
  policy: MatchScorePolicy;
  scoreDeltaByTeam: TeamScore;
  payload: MatchFinalizationEventPayload;
  handId: string | null;
  targetScore: number;
  scoreByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  leadingTeam: TeamSide | null;
  pointsToWin: number;
  pointsNeededByTeam: TeamScore;
  scoreMargin: number;
  handCount: number;
  isComplete: boolean;
}

export interface HandMatchProgressionInput {
  matchState: MatchScoreState;
  handSummary: HandFinalizationSummary;
}

export interface HandMatchProgressionBundle {
  type: 'match/finalized';
  phase: 'match_end';
  state: MatchScoreState;
  handSummary: HandFinalizationSummary;
  match: MatchProgressionBundle;
  policy: MatchScorePolicy;
  scoreDeltaByTeam: TeamScore;
  payload: MatchFinalizationEventPayload;
  handId: string | null;
  targetScore: number;
  scoreByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  leadingTeam: TeamSide | null;
  pointsToWin: number;
  pointsNeededByTeam: TeamScore;
  scoreMargin: number;
  handCount: number;
  isComplete: boolean;
}

export interface HandMatchProgressionSnapshot {
  type: 'match/finalized';
  phase: 'match_end';
  scoreDeltaByTeam: TeamScore;
  summary: MatchFinalizationSummary;
  policy: MatchScorePolicy;
  payload: MatchFinalizationEventPayload;
  handId: string | null;
  targetScore: number;
  scoreByTeam: TeamScore;
  winningTeam: TeamSide | null;
  isTie: boolean;
  leadingTeam: TeamSide | null;
  pointsToWin: number;
  pointsNeededByTeam: TeamScore;
  scoreMargin: number;
  handCount: number;
}

function cloneTeamScore(score: TeamScore): TeamScore {
  return {
    A: score.A,
    B: score.B,
  };
}

export function applyMatchScoreDelta(scoreByTeam: TeamScore, deltaByTeam: TeamScore): TeamScore {
  return {
    A: scoreByTeam.A + deltaByTeam.A,
    B: scoreByTeam.B + deltaByTeam.B,
  };
}

export function getMatchLeadingTeam(scoreByTeam: TeamScore): TeamSide | null {
  if (scoreByTeam.A === scoreByTeam.B) {
    return null;
  }

  return scoreByTeam.A > scoreByTeam.B ? 'A' : 'B';
}

export function getMatchScoreMargin(scoreByTeam: TeamScore) {
  return Math.abs(scoreByTeam.A - scoreByTeam.B);
}

export function getMatchPointsNeededByTeam(scoreByTeam: TeamScore, targetScore: number): TeamScore {
  return {
    A: Math.max(0, targetScore - scoreByTeam.A),
    B: Math.max(0, targetScore - scoreByTeam.B),
  };
}

export function getMatchPointsToWin(scoreByTeam: TeamScore, targetScore: number) {
  const leadingTeam = getMatchLeadingTeam(scoreByTeam);
  const leadingScore = leadingTeam ? scoreByTeam[leadingTeam] : Math.max(scoreByTeam.A, scoreByTeam.B);

  return Math.max(0, targetScore - leadingScore);
}

export function getMatchWinningTeam(scoreByTeam: TeamScore, targetScore: number) {
  const reachedTargetTeam =
    scoreByTeam.A >= targetScore || scoreByTeam.B >= targetScore ? getMatchLeadingTeam(scoreByTeam) : null;

  return reachedTargetTeam;
}

export function resolveMatchScore(input: MatchScoreInput): MatchScoreState {
  const scoreDeltaByTeam = input.handSummary?.scoreDeltaByTeam ?? { A: 0, B: 0 };
  const scoreByTeam = input.handSummary
    ? applyMatchScoreDelta(input.scoreByTeam, scoreDeltaByTeam)
    : cloneTeamScore(input.scoreByTeam);
  const winningTeam = getMatchWinningTeam(scoreByTeam, input.targetScore);
  const leadingTeam = getMatchLeadingTeam(scoreByTeam);
  const pointsToWin = getMatchPointsToWin(scoreByTeam, input.targetScore);

  return {
    targetScore: input.targetScore,
    scoreByTeam,
    handId: input.handSummary?.handId ?? null,
    handCount: input.handCount ?? (input.handSummary ? 1 : 0),
    lastHandDelta: scoreDeltaByTeam,
    winningTeam,
    isTie: scoreByTeam.A === scoreByTeam.B,
    isComplete: winningTeam !== null,
    leadingTeam,
    pointsToWin,
    pointsNeededByTeam: getMatchPointsNeededByTeam(scoreByTeam, input.targetScore),
    scoreMargin: getMatchScoreMargin(scoreByTeam),
  };
}

export function advanceMatchScore(input: MatchProgressionInput): MatchScoreState {
  return resolveMatchScore({
    targetScore: input.state.targetScore,
    scoreByTeam: input.state.scoreByTeam,
    handSummary: input.handSummary,
    handCount: input.state.handCount + (input.handSummary ? 1 : 0),
  });
}

export function getMatchScorePolicy(state: MatchScoreState): MatchScorePolicy {
  return {
    handId: state.handId,
    targetScore: state.targetScore,
    nextPhase: state.isComplete ? 'match_end' : 'action_turn',
    shouldFinalizeMatch: state.isComplete,
    isTerminal: state.isComplete,
    winningTeam: state.winningTeam,
    isTie: state.isTie,
    leadingTeam: state.leadingTeam,
    pointsToWin: state.pointsToWin,
    pointsNeededByTeam: state.pointsNeededByTeam,
    scoreMargin: state.scoreMargin,
    scoreDeltaByTeam: cloneTeamScore(state.lastHandDelta),
    scoreByTeam: cloneTeamScore(state.scoreByTeam),
    handCount: state.handCount,
  };
}

export function getMatchFinalizationSummary(state: MatchScoreState): MatchFinalizationSummary {
  return {
    handId: state.handId,
    targetScore: state.targetScore,
    scoreByTeam: cloneTeamScore(state.scoreByTeam),
    scoreDeltaByTeam: cloneTeamScore(state.lastHandDelta),
    winningTeam: state.winningTeam,
    isTie: state.isTie,
    leadingTeam: state.leadingTeam,
    pointsToWin: state.pointsToWin,
    pointsNeededByTeam: cloneTeamScore(state.pointsNeededByTeam),
    scoreMargin: state.scoreMargin,
    handCount: state.handCount,
  };
}

export function getMatchScoreDeltaByTeam(state: MatchScoreState): TeamScore {
  return cloneTeamScore(state.lastHandDelta);
}

export function buildMatchFinalizationEventPayload(state: MatchScoreState): MatchFinalizationEventPayload {
  return {
    type: 'match/finalized',
    phase: 'match_end',
    summary: getMatchFinalizationSummary(state),
  };
}

export function buildMatchLifecycleBundle(state: MatchScoreState): MatchLifecycleBundle {
  const summary = getMatchFinalizationSummary(state);
  const policy = getMatchScorePolicy(state);
  const scoreDeltaByTeam = getMatchScoreDeltaByTeam(state);
  const payload = buildMatchFinalizationEventPayload(state);

  return {
    type: 'match/finalized',
    phase: 'match_end',
    summary,
    payload,
    policy,
    scoreDeltaByTeam,
    handId: summary.handId,
    targetScore: summary.targetScore,
    scoreByTeam: summary.scoreByTeam,
    winningTeam: summary.winningTeam,
    isTie: summary.isTie,
    leadingTeam: summary.leadingTeam,
    pointsToWin: summary.pointsToWin,
    pointsNeededByTeam: summary.pointsNeededByTeam,
    scoreMargin: summary.scoreMargin,
    handCount: summary.handCount,
  };
}

export function getMatchFinalizationSnapshot(state: MatchScoreState): MatchFinalizationSnapshot {
  const summary = getMatchFinalizationSummary(state);
  const policy = getMatchScorePolicy(state);
  const scoreDeltaByTeam = getMatchScoreDeltaByTeam(state);
  const payload = buildMatchFinalizationEventPayload(state);

  return {
    type: 'match/finalized',
    phase: 'match_end',
    summary,
    policy,
    scoreDeltaByTeam,
    payload,
    handId: summary.handId,
    targetScore: summary.targetScore,
    scoreByTeam: summary.scoreByTeam,
    winningTeam: summary.winningTeam,
    isTie: summary.isTie,
    leadingTeam: summary.leadingTeam,
    pointsToWin: summary.pointsToWin,
    pointsNeededByTeam: summary.pointsNeededByTeam,
    scoreMargin: summary.scoreMargin,
    handCount: summary.handCount,
  };
}

export function buildMatchProgressionBundle(input: MatchProgressionInput): MatchProgressionBundle {
  const state = advanceMatchScore(input);
  const summary = getMatchFinalizationSummary(state);
  const policy = getMatchScorePolicy(state);
  const scoreDeltaByTeam = getMatchScoreDeltaByTeam(state);
  const payload = buildMatchFinalizationEventPayload(state);

  return {
    type: 'match/finalized',
    phase: 'match_end',
    state,
    summary,
    payload,
    policy,
    scoreDeltaByTeam,
    handId: summary.handId,
    targetScore: summary.targetScore,
    scoreByTeam: summary.scoreByTeam,
    winningTeam: summary.winningTeam,
    isTie: summary.isTie,
    leadingTeam: summary.leadingTeam,
    pointsToWin: summary.pointsToWin,
    pointsNeededByTeam: summary.pointsNeededByTeam,
    scoreMargin: summary.scoreMargin,
    handCount: summary.handCount,
    isComplete: state.isComplete,
  };
}

export function getMatchProgressionSnapshot(input: MatchProgressionInput): MatchProgressionSnapshot {
  const state = advanceMatchScore(input);
  const summary = getMatchFinalizationSummary(state);
  const policy = getMatchScorePolicy(state);
  const scoreDeltaByTeam = getMatchScoreDeltaByTeam(state);
  const payload = buildMatchFinalizationEventPayload(state);

  return {
    type: 'match/finalized',
    phase: 'match_end',
    state,
    summary,
    policy,
    scoreDeltaByTeam,
    payload,
    handId: summary.handId,
    targetScore: summary.targetScore,
    scoreByTeam: summary.scoreByTeam,
    winningTeam: summary.winningTeam,
    isTie: summary.isTie,
    leadingTeam: summary.leadingTeam,
    pointsToWin: summary.pointsToWin,
    pointsNeededByTeam: summary.pointsNeededByTeam,
    scoreMargin: summary.scoreMargin,
    handCount: summary.handCount,
    isComplete: state.isComplete,
  };
}

export function getMatchProgressionSummary(input: MatchProgressionInput): MatchFinalizationSummary {
  return getMatchProgressionSnapshot(input).summary;
}

export function getMatchProgressionPolicy(input: MatchProgressionInput): MatchScorePolicy {
  return getMatchProgressionSnapshot(input).policy;
}

export function getMatchProgressionScoreDeltaByTeam(input: MatchProgressionInput): TeamScore {
  return cloneTeamScore(input.handSummary?.scoreDeltaByTeam ?? { A: 0, B: 0 });
}

export function buildHandMatchProgressionBundle(
  input: HandMatchProgressionInput,
): HandMatchProgressionBundle {
  const match = buildMatchProgressionBundle({
    state: input.matchState,
    handSummary: input.handSummary,
  });

  return {
    type: 'match/finalized',
    phase: 'match_end',
    handSummary: input.handSummary,
    state: match.state,
    match,
    policy: match.policy,
    scoreDeltaByTeam: match.scoreDeltaByTeam,
    payload: match.payload,
    handId: match.summary.handId,
    targetScore: match.summary.targetScore,
    scoreByTeam: match.summary.scoreByTeam,
    winningTeam: match.summary.winningTeam,
    isTie: match.summary.isTie,
    leadingTeam: match.summary.leadingTeam,
    pointsToWin: match.summary.pointsToWin,
    pointsNeededByTeam: match.summary.pointsNeededByTeam,
    scoreMargin: match.summary.scoreMargin,
    handCount: match.summary.handCount,
    isComplete: match.state.isComplete,
  };
}

export function getHandMatchProgressionSummary(
  input: HandMatchProgressionInput,
): MatchFinalizationSummary {
  return buildMatchProgressionBundle({
    state: input.matchState,
    handSummary: input.handSummary,
  }).summary;
}

export function getHandMatchProgressionSnapshot(
  input: HandMatchProgressionInput,
): HandMatchProgressionSnapshot {
  const match = buildMatchProgressionBundle({
    state: input.matchState,
    handSummary: input.handSummary,
  });

  return {
    type: 'match/finalized',
    phase: 'match_end',
    scoreDeltaByTeam: getHandMatchProgressionDeltaByTeam(input),
    summary: match.summary,
    policy: match.policy,
    payload: match.payload,
    handId: match.summary.handId,
    targetScore: match.summary.targetScore,
    scoreByTeam: match.summary.scoreByTeam,
    winningTeam: match.summary.winningTeam,
    isTie: match.summary.isTie,
    leadingTeam: match.summary.leadingTeam,
    pointsToWin: match.summary.pointsToWin,
    pointsNeededByTeam: match.summary.pointsNeededByTeam,
    scoreMargin: match.summary.scoreMargin,
    handCount: match.summary.handCount,
  };
}

export function getHandMatchProgressionPolicy(
  input: HandMatchProgressionInput,
): MatchScorePolicy {
  return buildMatchProgressionBundle({
    state: input.matchState,
    handSummary: input.handSummary,
  }).policy;
}

export function getHandMatchProgressionDeltaByTeam(
  input: HandMatchProgressionInput,
): TeamScore {
  return cloneTeamScore(input.handSummary.scoreDeltaByTeam);
}
