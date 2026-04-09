import type { CardSignature, TeamSide, WildcardChoice } from './types.js';
import { compareTrucoCards, getTrucoCardStrength } from './cards.js';
import { areWildcardsTied } from './wildcards.js';
import type { WildcardRulesState } from './rules.js';

export interface TrickPlay {
  seatId: string;
  team: TeamSide;
  card: CardSignature;
  isWildcard?: boolean;
  wildcardId?: string | null;
}

export interface ResolvedTrickPlay extends TrickPlay {
  effectiveCard: CardSignature;
  effectiveStrength: number;
  wildcardChoice: CardSignature | null;
}

export interface TrickOutcome {
  handId: string;
  plays: ResolvedTrickPlay[];
  winnerTeam: TeamSide | null;
  winningPlay: ResolvedTrickPlay | null;
  isTie: boolean;
  tieReason: 'card_tie' | 'wildcard_tie' | null;
}

export interface TrickRulesState {
  handId: string | null;
  lastOutcome: TrickOutcome | null;
}

export interface TrickResolutionInput {
  handId: string;
  plays: TrickPlay[];
  wildcards: Pick<WildcardRulesState, 'commitments' | 'activeWildcardByHandId'>;
}

export function createEmptyTrickRulesState(): TrickRulesState {
  return {
    handId: null,
    lastOutcome: null,
  };
}

export function getActiveWildcardIdForHand(
  wildcards: Pick<WildcardRulesState, 'activeWildcardByHandId'>,
  handId: string,
) {
  return wildcards.activeWildcardByHandId[handId] ?? null;
}

export function resolveTrickPlay(
  handId: string,
  play: TrickPlay,
  wildcards: Pick<WildcardRulesState, 'commitments' | 'activeWildcardByHandId'>,
): ResolvedTrickPlay {
  const activeWildcardId = getActiveWildcardIdForHand(wildcards, handId);
  const commitment =
    play.wildcardId ? wildcards.commitments[play.wildcardId] ?? null : null;
  const wildcardChoice =
    play.isWildcard && play.wildcardId && activeWildcardId === play.wildcardId
      ? commitment?.choice ?? null
      : null;
  const effectiveCard = wildcardChoice ?? play.card;

  return {
    ...play,
    effectiveCard,
    effectiveStrength: getTrucoCardStrength(effectiveCard),
    wildcardChoice,
  };
}

export function resolveTrickOutcome(input: TrickResolutionInput): TrickOutcome {
  if (input.plays.length === 0) {
    throw new Error('At least one trick play is required.');
  }

  const plays = input.plays.map((play) => resolveTrickPlay(input.handId, play, input.wildcards));

  let winningPlay = plays[0];
  let tieReason: TrickOutcome['tieReason'] = null;

  for (let index = 1; index < plays.length; index += 1) {
    const candidate = plays[index];
    const comparison = compareTrucoCards(candidate.effectiveCard, winningPlay.effectiveCard);

    if (comparison > 0) {
      winningPlay = candidate;
      tieReason = null;
      continue;
    }

    if (comparison === 0) {
      const wildcardTie = areWildcardsTied(
        {
          isWildcard: Boolean(winningPlay.isWildcard),
          choice: winningPlay.wildcardChoice ?? winningPlay.effectiveCard,
        },
        {
          isWildcard: Boolean(candidate.isWildcard),
          choice: candidate.wildcardChoice ?? candidate.effectiveCard,
        },
      );

      tieReason = wildcardTie ? 'wildcard_tie' : 'card_tie';
    }
  }

  const isTie = tieReason !== null;

  return {
    handId: input.handId,
    plays,
    winnerTeam: isTie ? null : winningPlay.team,
    winningPlay: isTie ? null : winningPlay,
    isTie,
    tieReason,
  };
}
