import type { EnvidoResolution } from './envido.js';
import type { TrucoResolution } from './truco.js';
import type { TeamScore, TeamSide } from './types.js';

export interface CantoScoreDelta {
  accepted: boolean;
  points: number;
  isFinished: boolean;
  resolvedBy: 'response' | 'timeout';
}

export interface CantoTeamScoreDelta extends CantoScoreDelta {
  awardedTo: TeamSide;
  deltaByTeam: TeamScore;
}

export interface CantoScoreSnapshot {
  type: 'canto/resolved';
  phase: 'canto_resolution';
  resolution: CantoScoreDelta;
  awardedTo: TeamSide;
  teamDelta: CantoTeamScoreDelta;
  accepted: boolean;
  points: number;
  isFinished: boolean;
  resolvedBy: 'response' | 'timeout';
  scoreDeltaByTeam: TeamScore;
  payload: CantoOutcomePayload;
}

export interface CantoOutcomePayload {
  type: 'canto/resolved';
  phase: 'canto_resolution';
  accepted: boolean;
  points: number;
  isFinished: boolean;
  resolvedBy: 'response' | 'timeout';
  awardedTo: TeamSide;
  scoreDeltaByTeam: TeamScore;
}

export interface CantoScorePolicy {
  accepted: boolean;
  points: number;
  isFinished: boolean;
  resolvedBy: 'response' | 'timeout';
  awardedTo: TeamSide;
  deltaByTeam: TeamScore;
}

export function createEmptyTeamScoreDelta(): TeamScore {
  return { A: 0, B: 0 };
}

export function applyPointsToTeam(points: number, awardedTo: TeamSide): TeamScore {
  return {
    A: awardedTo === 'A' ? points : 0,
    B: awardedTo === 'B' ? points : 0,
  };
}

export function mergeTeamScoreDeltas(...deltas: TeamScore[]) {
  return deltas.reduce<TeamScore>(
    (total, delta) => ({
      A: total.A + delta.A,
      B: total.B + delta.B,
    }),
    createEmptyTeamScoreDelta(),
  );
}

export function buildCantoTeamScoreDelta(
  resolution: CantoScoreDelta,
  awardedTo: TeamSide,
): CantoTeamScoreDelta {
  return {
    ...resolution,
    awardedTo,
    deltaByTeam: applyPointsToTeam(resolution.points, awardedTo),
  };
}

export function getTrucoCantoScoreDelta(resolution: TrucoResolution): CantoScoreDelta {
  return {
    accepted: resolution.accepted,
    points: resolution.pointsAwarded,
    isFinished: resolution.isFinished,
    resolvedBy: resolution.resolvedBy,
  };
}

export function getEnvidoCantoScoreDelta(resolution: EnvidoResolution): CantoScoreDelta {
  return {
    accepted: resolution.accepted,
    points: resolution.pointsAwarded,
    isFinished: resolution.isFinished,
    resolvedBy: 'response',
  };
}

export function buildTrucoTeamScoreDelta(
  resolution: TrucoResolution,
  awardedTo: TeamSide,
): CantoTeamScoreDelta {
  return buildCantoTeamScoreDelta(getTrucoCantoScoreDelta(resolution), awardedTo);
}

export function buildEnvidoTeamScoreDelta(
  resolution: EnvidoResolution,
  awardedTo: TeamSide,
): CantoTeamScoreDelta {
  return buildCantoTeamScoreDelta(getEnvidoCantoScoreDelta(resolution), awardedTo);
}

export function getCantoScoreSnapshot(
  resolution: CantoScoreDelta,
  awardedTo: TeamSide,
): CantoScoreSnapshot {
  const teamDelta = buildCantoTeamScoreDelta(resolution, awardedTo);
  const scoreDeltaByTeam = teamDelta.deltaByTeam;

  return {
    type: 'canto/resolved',
    phase: 'canto_resolution',
    resolution,
    awardedTo,
    teamDelta,
    accepted: resolution.accepted,
    points: resolution.points,
    isFinished: resolution.isFinished,
    resolvedBy: resolution.resolvedBy,
    scoreDeltaByTeam,
    payload: {
      type: 'canto/resolved',
      phase: 'canto_resolution',
      accepted: resolution.accepted,
      points: resolution.points,
      isFinished: resolution.isFinished,
      resolvedBy: resolution.resolvedBy,
      awardedTo,
      scoreDeltaByTeam,
    },
  };
}

export function getCantoScorePolicy(
  resolution: CantoScoreDelta,
  awardedTo: TeamSide,
): CantoScorePolicy {
  return {
    accepted: resolution.accepted,
    points: resolution.points,
    isFinished: resolution.isFinished,
    resolvedBy: resolution.resolvedBy,
    awardedTo,
    deltaByTeam: applyPointsToTeam(resolution.points, awardedTo),
  };
}

export function getCantoScoreDeltaByTeam(
  resolution: CantoScoreDelta,
  awardedTo: TeamSide,
): TeamScore {
  return applyPointsToTeam(resolution.points, awardedTo);
}
