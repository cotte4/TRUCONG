import type { HandScoreAward } from './hand.js';
import type { TeamScore } from './types.js';
import type { TeamSide, TrucoCall, TrucoResponse } from './types.js';

export interface TrucoCallStep {
  call: TrucoCall;
  acceptedPoints: number;
  declinedPoints: number;
}

export interface AcceptedTrucoLadderState {
  call: TrucoCall;
  acceptedPoints: number;
  nextCall: TrucoCall | null;
  isTerminal: boolean;
  ladderIndex: number;
}

export interface TrucoResolution {
  call: TrucoCall;
  response: TrucoResponse;
  accepted: boolean;
  pointsAwarded: number;
  nextCall: TrucoCall | null;
  isFinished: boolean;
  resolvedBy: 'response' | 'timeout';
}

export interface TrucoScorePolicy {
  call: TrucoCall;
  response: TrucoResponse;
  accepted: boolean;
  pointsAwarded: number;
  awardedTo: TeamSide;
  award: HandScoreAward;
  scoreDeltaByTeam: TeamScore;
  nextCall: TrucoCall | null;
  isFinished: boolean;
  resolvedBy: 'response' | 'timeout';
}

export interface TrucoScoreSnapshot {
  type: 'truco/resolved';
  phase: 'truco_resolution';
  resolution: TrucoResolution;
  policy: TrucoScorePolicy;
  award: HandScoreAward;
  scoreDeltaByTeam: TeamScore;
  call: TrucoCall;
  response: TrucoResponse;
  accepted: boolean;
  pointsAwarded: number;
  awardedTo: TeamSide;
  nextCall: TrucoCall | null;
  isFinished: boolean;
  resolvedBy: 'response' | 'timeout';
  payload: TrucoScorePayload;
}

export interface TrucoScorePayload {
  type: 'truco/resolved';
  phase: 'truco_resolution';
  call: TrucoCall;
  response: TrucoResponse;
  accepted: boolean;
  pointsAwarded: number;
  awardedTo: TeamSide;
  nextCall: TrucoCall | null;
  isFinished: boolean;
  resolvedBy: 'response' | 'timeout';
  scoreDeltaByTeam: TeamScore;
}

export const TRUCO_CALL_STEPS: TrucoCallStep[] = [
  { call: 'truco', acceptedPoints: 2, declinedPoints: 1 },
  { call: 'retruco', acceptedPoints: 3, declinedPoints: 2 },
  { call: 'vale_cuatro', acceptedPoints: 4, declinedPoints: 3 },
];

export function getTrucoStep(call: TrucoCall) {
  return TRUCO_CALL_STEPS.find((step) => step.call === call) ?? null;
}

export function getNextTrucoCall(call: TrucoCall) {
  const index = TRUCO_CALL_STEPS.findIndex((step) => step.call === call);
  return index >= 0 && index < TRUCO_CALL_STEPS.length - 1 ? TRUCO_CALL_STEPS[index + 1].call : null;
}

export function resolveAcceptedTrucoLadderState(call: TrucoCall): AcceptedTrucoLadderState {
  const step = getTrucoStep(call);

  if (!step) {
    throw new Error(`Unknown Truco call: ${call}`);
  }

  const ladderIndex = TRUCO_CALL_STEPS.findIndex((item) => item.call === call);

  return {
    call,
    acceptedPoints: step.acceptedPoints,
    nextCall: getNextTrucoCall(call),
    isTerminal: call === 'vale_cuatro',
    ladderIndex,
  };
}

export function resolveTrucoResponse(call: TrucoCall, response: TrucoResponse): TrucoResolution {
  const step = getTrucoStep(call);
  const ladderState = resolveAcceptedTrucoLadderState(call);

  return {
    call,
    response,
    accepted: response === 'quiero',
    pointsAwarded: response === 'quiero' ? ladderState.acceptedPoints : step?.declinedPoints ?? 0,
    nextCall: response === 'quiero' ? ladderState.nextCall : null,
    isFinished: response === 'no_quiero' || ladderState.isTerminal,
    resolvedBy: 'response',
  };
}

export function resolveTrucoTimeout(call: TrucoCall): TrucoResolution {
  return {
    ...resolveTrucoResponse(call, 'no_quiero'),
    resolvedBy: 'timeout',
  };
}

export function buildTrucoHandAward(resolution: TrucoResolution, awardedTo: TeamSide): HandScoreAward {
  return {
    team: awardedTo,
    points: resolution.pointsAwarded,
    source: 'truco',
  };
}

export function getTrucoScoreDeltaByTeam(resolution: TrucoResolution, awardedTo: TeamSide): TeamScore {
  return {
    A: awardedTo === 'A' ? resolution.pointsAwarded : 0,
    B: awardedTo === 'B' ? resolution.pointsAwarded : 0,
  };
}

export function getTrucoScorePolicy(resolution: TrucoResolution, awardedTo: TeamSide): TrucoScorePolicy {
  const award = buildTrucoHandAward(resolution, awardedTo);

  return {
    call: resolution.call,
    response: resolution.response,
    accepted: resolution.accepted,
    pointsAwarded: resolution.pointsAwarded,
    awardedTo,
    award,
    scoreDeltaByTeam: getTrucoScoreDeltaByTeam(resolution, awardedTo),
    nextCall: resolution.nextCall,
    isFinished: resolution.isFinished,
    resolvedBy: resolution.resolvedBy,
  };
}

export function getTrucoScoreSnapshot(resolution: TrucoResolution, awardedTo: TeamSide): TrucoScoreSnapshot {
  const policy = getTrucoScorePolicy(resolution, awardedTo);

  return {
    type: 'truco/resolved',
    phase: 'truco_resolution',
    resolution,
    policy,
    award: policy.award,
    scoreDeltaByTeam: policy.scoreDeltaByTeam,
    call: resolution.call,
    response: resolution.response,
    accepted: resolution.accepted,
    pointsAwarded: resolution.pointsAwarded,
    awardedTo,
    nextCall: resolution.nextCall,
    isFinished: resolution.isFinished,
    resolvedBy: resolution.resolvedBy,
    payload: {
      type: 'truco/resolved',
      phase: 'truco_resolution',
      call: resolution.call,
      response: resolution.response,
      accepted: resolution.accepted,
      pointsAwarded: resolution.pointsAwarded,
      awardedTo,
      nextCall: resolution.nextCall,
      isFinished: resolution.isFinished,
      resolvedBy: resolution.resolvedBy,
      scoreDeltaByTeam: policy.scoreDeltaByTeam,
    },
  };
}

export function getTrucoCallPoints(call: TrucoCall) {
  const step = getTrucoStep(call);

  if (!step) {
    throw new Error(`Unknown Truco call: ${call}`);
  }

  return step;
}

export function getTrucoTargetTeam(nextTurn: TeamSide) {
  return nextTurn;
}
