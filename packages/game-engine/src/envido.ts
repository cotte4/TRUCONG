import type { HandScoreAward } from './hand.js';
import type { EnvidoCall, EnvidoResponse, EnvidoScoreContext, TeamScore, TeamSide } from './types.js';

export interface EnvidoCallStep {
  call: EnvidoCall;
  acceptedPoints: number;
}

export interface EnvidoResolution {
  callChain: EnvidoCall[];
  response: EnvidoResponse;
  accepted: boolean;
  pointsAwarded: number;
  isFinished: boolean;
}

export interface EnvidoScoringInput {
  callChain: EnvidoCall[];
  context: EnvidoScoreContext;
  teamScores: TeamScore;
}

export interface EnvidoScoringResolution {
  callChain: EnvidoCall[];
  teamScores: TeamScore;
  winnerTeam: TeamSide | null;
  isTie: boolean;
  pointsAwarded: number;
}

export interface EnvidoScorePolicy {
  winnerTeam: TeamSide | null;
  isTie: boolean;
  pointsAwarded: number;
  shouldAward: boolean;
  award: HandScoreAward | null;
  scoreDeltaByTeam: TeamScore;
}

export interface EnvidoScoreSnapshot {
  type: 'envido/resolved';
  phase: 'envido_scoring';
  scoring: EnvidoScoringResolution;
  policy: EnvidoScorePolicy;
  award: HandScoreAward | null;
  scoreDeltaByTeam: TeamScore;
  callChain: EnvidoCall[];
  teamScores: TeamScore;
  winnerTeam: TeamSide | null;
  isTie: boolean;
  pointsAwarded: number;
  shouldAward: boolean;
  awardedTo: TeamSide | null;
  payload: EnvidoScorePayload;
}

export interface EnvidoScorePayload {
  type: 'envido/resolved';
  phase: 'envido_scoring';
  callChain: EnvidoCall[];
  teamScores: TeamScore;
  winnerTeam: TeamSide | null;
  isTie: boolean;
  pointsAwarded: number;
  shouldAward: boolean;
  awardedTo: TeamSide | null;
  scoreDeltaByTeam: TeamScore;
}

export const ENVIDO_CALL_STEPS: EnvidoCallStep[] = [
  { call: 'envido', acceptedPoints: 2 },
  { call: 'real_envido', acceptedPoints: 3 },
  { call: 'falta_envido', acceptedPoints: 0 },
];

export function getEnvidoStep(call: EnvidoCall) {
  return ENVIDO_CALL_STEPS.find((step) => step.call === call) ?? null;
}

export function getNextEnvidoCall(call: EnvidoCall) {
  const index = ENVIDO_CALL_STEPS.findIndex((step) => step.call === call);
  return index >= 0 && index < ENVIDO_CALL_STEPS.length - 1 ? ENVIDO_CALL_STEPS[index + 1].call : null;
}

export function getEnvidoAcceptedPoints(callChain: EnvidoCall[], context: EnvidoScoreContext) {
  return callChain.reduce((total, call) => {
    if (call === 'falta_envido') {
      return total + getFaltaEnvidoPoints(context);
    }

    return total + (getEnvidoStep(call)?.acceptedPoints ?? 0);
  }, 0);
}

export function getEnvidoDeclinedPoints(callChain: EnvidoCall[], context: EnvidoScoreContext) {
  const previousAcceptedPoints = getEnvidoAcceptedPoints(callChain.slice(0, -1), context);
  return Math.max(1, previousAcceptedPoints);
}

export function validateEnvidoCallChain(callChain: EnvidoCall[]) {
  if (callChain.length === 0) {
    throw new Error('At least one Envido call is required.');
  }

  let envidoCount = 0;
  let previous: EnvidoCall | null = null;

  for (const call of callChain) {
    if (call === 'envido') {
      envidoCount += 1;
      if (envidoCount > 2) {
        throw new Error('Envido can be called at most twice.');
      }
    }

    if (previous === null) {
      previous = call;
      continue;
    }

    if (previous === 'falta_envido') {
      throw new Error('No Envido call is allowed after falta envido.');
    }

    if (previous === 'real_envido' && call !== 'falta_envido') {
      throw new Error('Only falta envido can follow real envido.');
    }

    if (previous === 'envido' && call === 'envido' && envidoCount > 2) {
      throw new Error('Envido can be called at most twice.');
    }

    previous = call;
  }

  return [...callChain];
}

export function resolveEnvidoResponse(
  callChain: EnvidoCall[],
  response: EnvidoResponse,
  context: EnvidoScoreContext,
): EnvidoResolution {
  const validatedCallChain = validateEnvidoCallChain(callChain);

  const acceptedPoints = getEnvidoAcceptedPoints(validatedCallChain, context);
  const declinedPoints = getEnvidoDeclinedPoints(validatedCallChain, context);

  return {
    callChain: validatedCallChain,
    response,
    accepted: response === 'quiero',
    pointsAwarded: response === 'quiero' ? acceptedPoints : declinedPoints,
    isFinished: true,
  };
}

export function getFaltaEnvidoPoints(context: EnvidoScoreContext) {
  const leadingScore = Math.max(context.teamScores.A, context.teamScores.B);
  return Math.max(1, context.targetScore - leadingScore);
}

export function getEnvidoCallTotal(callChain: EnvidoCall[], context: EnvidoScoreContext) {
  return getEnvidoAcceptedPoints(callChain, context);
}

export function getEnvidoWinningTeam(teamScores: TeamScore) {
  if (teamScores.A === teamScores.B) {
    return null;
  }

  return teamScores.A > teamScores.B ? 'A' : 'B';
}

export function resolveEnvidoScoring(input: EnvidoScoringInput): EnvidoScoringResolution {
  const validatedCallChain = validateEnvidoCallChain(input.callChain);

  const winnerTeam = getEnvidoWinningTeam(input.teamScores);

  return {
    callChain: validatedCallChain,
    teamScores: input.teamScores,
    winnerTeam,
    isTie: winnerTeam === null,
    pointsAwarded: getEnvidoAcceptedPoints(validatedCallChain, input.context),
  };
}

export function buildEnvidoHandAward(scoring: EnvidoScoringResolution): HandScoreAward | null {
  if (!scoring.winnerTeam) {
    return null;
  }

  return {
    team: scoring.winnerTeam,
    points: scoring.pointsAwarded,
    source: 'envido',
  };
}

export function getEnvidoScoreDeltaByTeam(scoring: EnvidoScoringResolution): TeamScore {
  const award = buildEnvidoHandAward(scoring);

  return {
    A: award?.team === 'A' ? award.points : 0,
    B: award?.team === 'B' ? award.points : 0,
  };
}

export function getEnvidoScorePolicy(scoring: EnvidoScoringResolution): EnvidoScorePolicy {
  const award = buildEnvidoHandAward(scoring);

  return {
    winnerTeam: scoring.winnerTeam,
    isTie: scoring.isTie,
    pointsAwarded: scoring.pointsAwarded,
    shouldAward: award !== null,
    award,
    scoreDeltaByTeam: getEnvidoScoreDeltaByTeam(scoring),
  };
}

export function getEnvidoScoreSnapshot(scoring: EnvidoScoringResolution): EnvidoScoreSnapshot {
  const policy = getEnvidoScorePolicy(scoring);
  const award = policy.award;

  return {
    type: 'envido/resolved',
    phase: 'envido_scoring',
    scoring,
    policy,
    award,
    scoreDeltaByTeam: policy.scoreDeltaByTeam,
    callChain: [...scoring.callChain],
    teamScores: {
      A: scoring.teamScores.A,
      B: scoring.teamScores.B,
    },
    winnerTeam: scoring.winnerTeam,
    isTie: scoring.isTie,
    pointsAwarded: scoring.pointsAwarded,
    shouldAward: policy.shouldAward,
    awardedTo: award?.team ?? null,
    payload: {
      type: 'envido/resolved',
      phase: 'envido_scoring',
      callChain: scoring.callChain,
      teamScores: scoring.teamScores,
      winnerTeam: scoring.winnerTeam,
      isTie: scoring.isTie,
      pointsAwarded: scoring.pointsAwarded,
      shouldAward: policy.shouldAward,
      awardedTo: award?.team ?? null,
      scoreDeltaByTeam: policy.scoreDeltaByTeam,
    },
  };
}
