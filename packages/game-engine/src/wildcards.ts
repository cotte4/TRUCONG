import type { CardSignature, HandWildcardState, WildcardChoice, WildcardCommitment } from './types.js';
import { areSameTrucoCards, createCardLabel, getCardSignature } from './cards.js';

export interface WildcardFilterInput {
  candidateChoices: WildcardChoice[];
  playedCards: CardSignature[];
}

export interface WildcardResolution {
  wildcardId: string;
  choice: WildcardChoice;
  lockedForEnvido: boolean;
}

export interface WildcardComparison {
  isWildcard: boolean;
  choice?: CardSignature;
}

export interface WildcardTimeoutInput {
  candidateChoices: WildcardChoice[];
  playedCards: CardSignature[];
}

export interface PendingWildcardSelectionRequirement {
  wildcardId: string;
  legalChoices: WildcardChoice[];
  timeoutChoice: WildcardChoice;
  needsSelection: boolean;
}

export interface PendingWildcardSelectionInput extends WildcardTimeoutInput {
  wildcardId: string;
}

export interface PendingWildcardSelectionPolicyInput extends PendingWildcardSelectionInput {
  selectedLabel?: string | null;
  selectedChoice?: WildcardChoice | null;
}

export interface PendingWildcardSelectionPolicy {
  requirement: PendingWildcardSelectionRequirement;
  selectedLabel: string | null;
  selectedChoice: WildcardChoice | null;
  labelValidation: WildcardSelectionLabelValidationResult | null;
  choiceValidation: WildcardSelectionChoiceValidationResult | null;
  isSelectedLegal: boolean;
  resolvedChoice: WildcardChoice | null;
}

export interface WildcardSelectionLabelValidationInput {
  selectedLabel: string;
  legalChoices: WildcardChoice[];
}

export interface WildcardSelectionLabelValidationResult {
  selectedLabel: string;
  isLegal: boolean;
  matchedChoice: WildcardChoice | null;
}

export interface WildcardSelectionChoiceValidationInput {
  selectedChoice: WildcardChoice;
  legalChoices: WildcardChoice[];
}

export interface WildcardSelectionChoiceValidationResult {
  selectedChoice: WildcardChoice;
  matchedByLabel: WildcardChoice | null;
  matchedByValue: WildcardChoice | null;
  labelMatchesValue: boolean;
  isLegal: boolean;
}

export interface ResolvedWildcardSelectionByLabel {
  selectedLabel: string;
  legalChoices: WildcardChoice[];
  selectedChoice: WildcardChoice | null;
  isLegal: boolean;
}

export const DEFAULT_UNDECLARED_WILDCARD_TIMEOUT_CHOICE: WildcardChoice = {
  rank: 4,
  suit: 'copa',
  label: createCardLabel({ rank: 4, suit: 'copa' }),
};

export function filterLegalWildcardChoices(input: WildcardFilterInput) {
  const playedSignatures = new Set(input.playedCards.map(getCardSignature));

  return input.candidateChoices.filter((choice) => !playedSignatures.has(getCardSignature(choice)));
}

export function getLegalWildcardChoicesForHand(input: WildcardFilterInput) {
  return filterLegalWildcardChoices(input);
}

export function selectLegalWildcardChoicesForHand(input: WildcardFilterInput) {
  return getLegalWildcardChoicesForHand(input);
}

export function getWildcardChoiceByLabel(legalChoices: WildcardChoice[], selectedLabel: string) {
  return legalChoices.find((choice) => choice.label === selectedLabel) ?? null;
}

export function getWildcardChoiceByValue(legalChoices: WildcardChoice[], selectedChoice: WildcardChoice) {
  return legalChoices.find((choice) => areSameTrucoCards(choice, selectedChoice)) ?? null;
}

export function validateSelectedWildcardLabel(
  input: WildcardSelectionLabelValidationInput,
): WildcardSelectionLabelValidationResult {
  const matchedChoice = getWildcardChoiceByLabel(input.legalChoices, input.selectedLabel);

  return {
    selectedLabel: input.selectedLabel,
    isLegal: matchedChoice !== null,
    matchedChoice,
  };
}

export function isSelectedWildcardLabelLegal(input: WildcardSelectionLabelValidationInput) {
  return validateSelectedWildcardLabel(input).isLegal;
}

export function validateSelectedWildcardChoice(
  input: WildcardSelectionChoiceValidationInput,
): WildcardSelectionChoiceValidationResult {
  const matchedByLabel = getWildcardChoiceByLabel(input.legalChoices, input.selectedChoice.label);
  const matchedByValue = getWildcardChoiceByValue(input.legalChoices, input.selectedChoice);
  const labelMatchesValue =
    matchedByLabel !== null &&
    matchedByValue !== null &&
    areSameTrucoCards(matchedByLabel, matchedByValue) &&
    matchedByLabel.label === matchedByValue.label;

  return {
    selectedChoice: input.selectedChoice,
    matchedByLabel,
    matchedByValue,
    labelMatchesValue,
    isLegal: labelMatchesValue,
  };
}

export function isSelectedWildcardChoiceLegal(input: WildcardSelectionChoiceValidationInput) {
  return validateSelectedWildcardChoice(input).isLegal;
}

export function resolveWildcardSelectionByLabel(
  input: WildcardSelectionLabelValidationInput,
): ResolvedWildcardSelectionByLabel {
  const matchedChoice = getWildcardChoiceByLabel(input.legalChoices, input.selectedLabel);

  return {
    selectedLabel: input.selectedLabel,
    legalChoices: input.legalChoices,
    selectedChoice: matchedChoice,
    isLegal: matchedChoice !== null,
  };
}

export function requireLegalWildcardSelectionByLabel(
  input: WildcardSelectionLabelValidationInput,
) {
  const resolved = resolveWildcardSelectionByLabel(input);

  if (!resolved.selectedChoice) {
    throw new Error(`Illegal wildcard selection label: ${input.selectedLabel}`);
  }

  return resolved.selectedChoice;
}

export function resolveWildcardSelectionByChoice(
  input: WildcardSelectionChoiceValidationInput,
): WildcardSelectionChoiceValidationResult {
  return validateSelectedWildcardChoice(input);
}

export function requireLegalWildcardSelectionByChoice(
  input: WildcardSelectionChoiceValidationInput,
) {
  const resolved = resolveWildcardSelectionByChoice(input);

  if (!resolved.isLegal) {
    throw new Error(`Illegal wildcard selection choice: ${input.selectedChoice.label}`);
  }

  return resolved.matchedByValue ?? resolved.selectedChoice;
}

export function isWildcardChoiceAlreadyPlayed(choice: WildcardChoice, playedCards: CardSignature[]) {
  return playedCards.some((playedCard) => areSameTrucoCards(playedCard, choice));
}

export function areWildcardsTied(left: WildcardComparison, right: WildcardComparison) {
  return left.isWildcard && right.isWildcard;
}

export function createEmptyWildcardState(): HandWildcardState {
  return { commitments: {} };
}

export function lockWildcardForEnvido(
  state: HandWildcardState,
  wildcardId: string,
  choice: WildcardChoice,
): HandWildcardState {
  return {
    commitments: {
      ...state.commitments,
      [wildcardId]: {
        wildcardId,
        choice,
        lockedForEnvido: true,
      },
    },
  };
}

export function resolveWildcardChoice(state: HandWildcardState, wildcardId: string, choice: WildcardChoice) {
  const existing = state.commitments[wildcardId];

  if (existing?.lockedForEnvido && !areSameTrucoCards(existing.choice, choice)) {
    throw new Error('This wildcard is locked for the hand.');
  }

  return {
    wildcardId,
    choice,
    lockedForEnvido: existing?.lockedForEnvido ?? false,
  } satisfies WildcardResolution;
}

export function getWildcardEnvidoChoice(state: HandWildcardState, wildcardId: string) {
  return state.commitments[wildcardId]?.choice ?? null;
}

export function registerWildcardCommitment(
  state: HandWildcardState,
  commitment: WildcardCommitment,
): HandWildcardState {
  return {
    commitments: {
      ...state.commitments,
      [commitment.wildcardId]: commitment,
    },
  };
}

export function getUndeclaredWildcardTimeoutChoice() {
  return {
    ...DEFAULT_UNDECLARED_WILDCARD_TIMEOUT_CHOICE,
  };
}

export function resolveWildcardTimeoutChoice(input: WildcardTimeoutInput) {
  const legalChoices = getLegalWildcardChoicesForHand(input);
  const defaultChoice = getUndeclaredWildcardTimeoutChoice();
  const legalDefaultChoice = getWildcardChoiceByValue(legalChoices, defaultChoice);

  if (legalDefaultChoice) {
    return legalDefaultChoice;
  }

  return legalChoices[0] ?? defaultChoice;
}

export function getPendingWildcardSelectionRequirement(
  input: PendingWildcardSelectionInput,
): PendingWildcardSelectionRequirement {
  const legalChoices = getLegalWildcardChoicesForHand(input);

  return {
    wildcardId: input.wildcardId,
    legalChoices,
    timeoutChoice: resolveWildcardTimeoutChoice(input),
    needsSelection: legalChoices.length > 0,
  };
}

export function getPendingWildcardSelectionPolicy(
  input: PendingWildcardSelectionPolicyInput,
): PendingWildcardSelectionPolicy {
  const requirement = getPendingWildcardSelectionRequirement(input);
  const selectedLabel = input.selectedLabel ?? input.selectedChoice?.label ?? null;
  const selectedChoice = input.selectedChoice ?? null;
  const labelValidation = selectedLabel
    ? validateSelectedWildcardLabel({
        selectedLabel,
        legalChoices: requirement.legalChoices,
      })
    : null;
  const choiceValidation = selectedChoice
    ? validateSelectedWildcardChoice({
        selectedChoice,
        legalChoices: requirement.legalChoices,
      })
    : null;
  const isSelectedLegal = choiceValidation?.isLegal ?? labelValidation?.isLegal ?? false;

  return {
    requirement,
    selectedLabel,
    selectedChoice,
    labelValidation,
    choiceValidation,
    isSelectedLegal,
    resolvedChoice: choiceValidation?.matchedByValue ?? labelValidation?.matchedChoice ?? null,
  };
}
