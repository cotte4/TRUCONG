import { describe, expect, it } from 'vitest';
import { getTrucoCardStrength, getTrucoWinningCard } from './cards.js';
import { buildEnvidoHandAward, getEnvidoAcceptedPoints, getEnvidoScorePolicy, getEnvidoScoreDeltaByTeam, getEnvidoScoreSnapshot, resolveEnvidoResponse, resolveEnvidoScoring } from './envido.js';
import {
  applyPointsToTeam,
  buildEnvidoTeamScoreDelta,
  getCantoScoreSnapshot,
  getCantoScorePolicy,
  getCantoScoreDeltaByTeam,
  buildTrucoTeamScoreDelta,
  getEnvidoCantoScoreDelta,
  getTrucoCantoScoreDelta,
  mergeTeamScoreDeltas,
} from './canto.js';
import {
  buildHandFinalizationLifecycleBundle,
  buildResolvedTrickLifecycleBundle,
  buildHandFinalizationEventPayload,
  buildResolvedTrickEventPayload,
  getHandFinalizationSummary,
  getHandFinalizationPolicy,
  getHandFinalizationSnapshot,
  getHandScoreDeltaByTeam,
  getHandWinningTeam,
  getResolvedTrickLifecyclePolicy,
  getResolvedTrickSnapshot,
  getResolvedTrickSummary,
} from './lifecycle.js';
import {
  buildTrucoHandAward,
  getTrucoCallPoints,
  resolveAcceptedTrucoLadderState,
  getTrucoScoreDeltaByTeam,
  getTrucoScorePolicy,
  getTrucoScoreSnapshot,
  resolveTrucoResponse,
  resolveTrucoTimeout,
} from './truco.js';
import { createCardLabel, createCardSignature } from './cards.js';
import { countEffectiveBongs } from './bongs.js';
import type { WildcardChoice } from './types.js';
import {
  advanceMatchScore,
  buildHandMatchProgressionBundle,
  buildMatchFinalizationEventPayload,
  buildMatchLifecycleBundle,
  buildMatchProgressionBundle,
  getHandMatchProgressionSummary,
  getHandMatchProgressionDeltaByTeam,
  getHandMatchProgressionSnapshot,
  getHandMatchProgressionPolicy,
  getMatchFinalizationSnapshot,
  getMatchProgressionPolicy,
  getMatchProgressionScoreDeltaByTeam,
  getMatchProgressionSnapshot,
  getMatchProgressionSummary,
  getMatchFinalizationSummary,
  getMatchScoreDeltaByTeam,
  getMatchPointsNeededByTeam,
  getMatchScorePolicy,
  resolveMatchScore,
} from './match.js';
import {
  areWildcardsTied,
  createEmptyWildcardState,
  filterLegalWildcardChoices,
  getLegalWildcardChoicesForHand,
  getPendingWildcardSelectionRequirement,
  getPendingWildcardSelectionPolicy,
  getWildcardEnvidoChoice,
  getWildcardChoiceByLabel,
  getWildcardChoiceByValue,
  lockWildcardForEnvido,
  isSelectedWildcardLabelLegal,
  isSelectedWildcardChoiceLegal,
  requireLegalWildcardSelectionByLabel,
  requireLegalWildcardSelectionByChoice,
  resolveWildcardChoice,
  resolveWildcardSelectionByLabel,
  resolveWildcardSelectionByChoice,
  resolveWildcardTimeoutChoice,
  selectLegalWildcardChoicesForHand,
  validateSelectedWildcardLabel,
  validateSelectedWildcardChoice,
  getUndeclaredWildcardTimeoutChoice,
} from './wildcards.js';
import {
  createInitialRulesState,
  canPlayCardInCurrentState,
  getCardPlayPolicy,
  getPendingCantoDecision,
  getWindowPriorityTeam,
  getWindowResponderTeam,
  reduceRulesState,
} from './rules.js';
import { getHandAwardSources, getHandAwards, getHandScoreBreakdown, getHandScorePointsBySource, getHandScorePolicy, resolveHandScore } from './hand.js';
import { resolveTrickOutcome } from './tricks.js';

describe('game engine helpers', () => {
  it('ranks truco cards correctly', () => {
    expect(getTrucoCardStrength(createCardSignature(1, 'espada'))).toBeGreaterThan(
      getTrucoCardStrength(createCardSignature(7, 'oro')),
    );
    expect(createCardLabel(createCardSignature(4, 'copa'))).toBe('4 de copa');
    expect(
      getTrucoWinningCard([
        createCardSignature(4, 'copa'),
        createCardSignature(1, 'basto'),
      ]),
    ).toEqual(createCardSignature(1, 'basto'));
  });

  it('resolves truco ladder responses', () => {
    expect(getTrucoCallPoints('truco')).toEqual({
      call: 'truco',
      acceptedPoints: 2,
      declinedPoints: 1,
    });
    expect(resolveAcceptedTrucoLadderState('truco')).toMatchObject({
      call: 'truco',
      acceptedPoints: 2,
      nextCall: 'retruco',
      isTerminal: false,
      ladderIndex: 0,
    });
    expect(resolveAcceptedTrucoLadderState('retruco')).toMatchObject({
      call: 'retruco',
      acceptedPoints: 3,
      nextCall: 'vale_cuatro',
      isTerminal: false,
      ladderIndex: 1,
    });
    expect(resolveAcceptedTrucoLadderState('vale_cuatro')).toMatchObject({
      call: 'vale_cuatro',
      acceptedPoints: 4,
      nextCall: null,
      isTerminal: true,
      ladderIndex: 2,
    });
    expect(resolveTrucoResponse('retruco', 'quiero')).toMatchObject({
      accepted: true,
      pointsAwarded: 3,
    });
    expect(resolveTrucoTimeout('vale_cuatro')).toMatchObject({
      response: 'no_quiero',
      accepted: false,
      resolvedBy: 'timeout',
    });
    expect(getTrucoCantoScoreDelta(resolveTrucoResponse('truco', 'quiero'))).toMatchObject({
      accepted: true,
      points: 2,
      isFinished: false,
      resolvedBy: 'response',
    });
    expect(getTrucoCantoScoreDelta(resolveTrucoTimeout('retruco'))).toMatchObject({
      accepted: false,
      points: 2,
      isFinished: true,
      resolvedBy: 'timeout',
    });
    expect(buildTrucoTeamScoreDelta(resolveTrucoResponse('truco', 'quiero'), 'A')).toMatchObject({
      awardedTo: 'A',
      deltaByTeam: { A: 2, B: 0 },
    });
    expect(buildTrucoHandAward(resolveTrucoResponse('retruco', 'quiero'), 'B')).toEqual({
      team: 'B',
      points: 3,
      source: 'truco',
    });
    expect(getTrucoScoreDeltaByTeam(resolveTrucoResponse('retruco', 'quiero'), 'B')).toEqual({
      A: 0,
      B: 3,
    });
    expect(getTrucoScorePolicy(resolveTrucoResponse('retruco', 'quiero'), 'B')).toMatchObject({
      call: 'retruco',
      response: 'quiero',
      accepted: true,
      pointsAwarded: 3,
      awardedTo: 'B',
      award: {
        team: 'B',
        points: 3,
        source: 'truco',
      },
      scoreDeltaByTeam: {
        A: 0,
        B: 3,
      },
      nextCall: 'vale_cuatro',
      isFinished: false,
      resolvedBy: 'response',
    });
    expect(getTrucoScorePolicy(resolveTrucoTimeout('vale_cuatro'), 'A')).toMatchObject({
      call: 'vale_cuatro',
      response: 'no_quiero',
      accepted: false,
      pointsAwarded: 3,
      awardedTo: 'A',
      scoreDeltaByTeam: {
        A: 3,
        B: 0,
      },
      nextCall: null,
      isFinished: true,
      resolvedBy: 'timeout',
    });
    expect(getTrucoScoreSnapshot(resolveTrucoResponse('retruco', 'quiero'), 'B')).toMatchObject({
      resolution: {
        call: 'retruco',
        response: 'quiero',
        accepted: true,
      },
      call: 'retruco',
      response: 'quiero',
      accepted: true,
      pointsAwarded: 3,
      awardedTo: 'B',
      nextCall: 'vale_cuatro',
      isFinished: false,
      resolvedBy: 'response',
      scoreDeltaByTeam: {
        A: 0,
        B: 3,
      },
      policy: {
        awardedTo: 'B',
        pointsAwarded: 3,
        nextCall: 'vale_cuatro',
        isFinished: false,
      },
      award: {
        team: 'B',
        points: 3,
        source: 'truco',
      },
      payload: {
        call: 'retruco',
        response: 'quiero',
        accepted: true,
        pointsAwarded: 3,
        awardedTo: 'B',
        nextCall: 'vale_cuatro',
        isFinished: false,
        resolvedBy: 'response',
        scoreDeltaByTeam: { A: 0, B: 3 },
      },
    });
    expect(getCantoScoreSnapshot(getTrucoCantoScoreDelta(resolveTrucoResponse('truco', 'quiero')), 'A')).toMatchObject({
      resolution: {
        accepted: true,
        points: 2,
        isFinished: false,
        resolvedBy: 'response',
      },
      accepted: true,
      points: 2,
      isFinished: false,
      resolvedBy: 'response',
      awardedTo: 'A',
      scoreDeltaByTeam: { A: 2, B: 0 },
      teamDelta: {
        awardedTo: 'A',
        deltaByTeam: { A: 2, B: 0 },
      },
      payload: {
        accepted: true,
        points: 2,
        isFinished: false,
        resolvedBy: 'response',
        awardedTo: 'A',
        scoreDeltaByTeam: { A: 2, B: 0 },
      },
    });
    expect(getCantoScorePolicy(getTrucoCantoScoreDelta(resolveTrucoResponse('truco', 'quiero')), 'A')).toMatchObject({
      accepted: true,
      points: 2,
      isFinished: false,
      resolvedBy: 'response',
      awardedTo: 'A',
      deltaByTeam: { A: 2, B: 0 },
    });
    expect(getCantoScoreDeltaByTeam(getTrucoCantoScoreDelta(resolveTrucoResponse('truco', 'quiero')), 'A')).toEqual({
      A: 2,
      B: 0,
    });
  });

  it('resolves envido totals and declines', () => {
    const context = { targetScore: 30, teamScores: { A: 12, B: 14 } };

    expect(getEnvidoAcceptedPoints(['envido', 'real_envido'], context)).toBe(5);
    expect(resolveEnvidoResponse(['envido', 'real_envido'], 'no_quiero', context)).toMatchObject({
      accepted: false,
      pointsAwarded: 2,
    });
  });

  it('rejects invalid envido call chains', () => {
    const context = { targetScore: 30, teamScores: { A: 12, B: 14 } };
    expect(() =>
      resolveEnvidoResponse(['real_envido', 'envido'], 'quiero', context),
    ).toThrow('Only falta envido can follow real envido.');
    expect(() =>
      resolveEnvidoScoring({
        callChain: ['falta_envido', 'envido'],
        context,
        teamScores: { A: 20, B: 18 },
      }),
    ).toThrow('No Envido call is allowed after falta envido.');
  });

  it('uses falta envido against the target score', () => {
    const context = { targetScore: 30, teamScores: { A: 18, B: 26 } };

    expect(getEnvidoAcceptedPoints(['falta_envido'], context)).toBe(4);
  });

  it('resolves envido scoring by winner and tie state', () => {
    const scoring = resolveEnvidoScoring({
      callChain: ['envido', 'real_envido'],
      context: { targetScore: 30, teamScores: { A: 12, B: 14 } },
      teamScores: { A: 28, B: 31 },
    });

    expect(scoring).toMatchObject({
      winnerTeam: 'B',
      isTie: false,
      pointsAwarded: 5,
    });

    const tie = resolveEnvidoScoring({
      callChain: ['envido'],
      context: { targetScore: 30, teamScores: { A: 10, B: 10 } },
      teamScores: { A: 28, B: 28 },
    });

    expect(tie).toMatchObject({
      winnerTeam: null,
      isTie: true,
      pointsAwarded: 2,
    });
    expect(buildEnvidoTeamScoreDelta(resolveEnvidoResponse(['envido'], 'quiero', {
      targetScore: 30,
      teamScores: { A: 12, B: 14 },
    }), 'B')).toMatchObject({
      awardedTo: 'B',
      deltaByTeam: { A: 0, B: 2 },
    });
    expect(buildEnvidoHandAward(scoring)).toEqual({
      team: 'B',
      points: 5,
      source: 'envido',
    });
    expect(getEnvidoScoreDeltaByTeam(scoring)).toEqual({
      A: 0,
      B: 5,
    });
    expect(getEnvidoScorePolicy(scoring)).toMatchObject({
      winnerTeam: 'B',
      isTie: false,
      pointsAwarded: 5,
      shouldAward: true,
      award: {
        team: 'B',
        points: 5,
        source: 'envido',
      },
      scoreDeltaByTeam: {
        A: 0,
        B: 5,
      },
    });
    expect(getEnvidoScoreSnapshot(scoring)).toMatchObject({
      scoring: {
        callChain: ['envido', 'real_envido'],
        winnerTeam: 'B',
        isTie: false,
        pointsAwarded: 5,
      },
      callChain: ['envido', 'real_envido'],
      teamScores: { A: 28, B: 31 },
      winnerTeam: 'B',
      isTie: false,
      pointsAwarded: 5,
      shouldAward: true,
      awardedTo: 'B',
      scoreDeltaByTeam: {
        A: 0,
        B: 5,
      },
      policy: {
        winnerTeam: 'B',
        isTie: false,
        pointsAwarded: 5,
        shouldAward: true,
      },
      award: {
        team: 'B',
        points: 5,
        source: 'envido',
      },
      payload: {
        callChain: ['envido', 'real_envido'],
        teamScores: { A: 28, B: 31 },
        winnerTeam: 'B',
        isTie: false,
        pointsAwarded: 5,
        shouldAward: true,
        awardedTo: 'B',
        scoreDeltaByTeam: { A: 0, B: 5 },
      },
    });

    const tiePolicy = getEnvidoScorePolicy(tie);
    expect(tiePolicy).toMatchObject({
      winnerTeam: null,
      isTie: true,
      pointsAwarded: 2,
      shouldAward: false,
      award: null,
      scoreDeltaByTeam: {
        A: 0,
        B: 0,
      },
    });
  });

  it('filters illegal wildcard choices and locks the envido choice', () => {
    const choiceOne: WildcardChoice = {
      rank: 1,
      suit: 'espada',
      label: '1 de espada',
    };
    const choiceTwo: WildcardChoice = {
      rank: 4,
      suit: 'copa',
      label: '4 de copa',
    };

    const legal = filterLegalWildcardChoices({
      candidateChoices: [choiceOne, choiceTwo],
      playedCards: [createCardSignature(1, 'espada')],
    });

    expect(legal).toEqual([choiceTwo]);

    const locked = lockWildcardForEnvido(createEmptyWildcardState(), 'wild-1', choiceTwo);
    expect(getWildcardEnvidoChoice(locked, 'wild-1')).toEqual(choiceTwo);
    expect(() =>
      resolveWildcardChoice(locked, 'wild-1', choiceOne),
    ).toThrow('This wildcard is locked for the hand.');
  });

  it('validates wildcard selections by label against the legal set', () => {
    const legalChoices: WildcardChoice[] = [
      {
        rank: 4,
        suit: 'copa',
        label: '4 de copa',
      },
      {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
    ];

    expect(
      validateSelectedWildcardLabel({
        selectedLabel: '7 de oro',
        legalChoices,
      }),
    ).toMatchObject({
      selectedLabel: '7 de oro',
      isLegal: true,
      matchedChoice: {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
    });
    expect(
      isSelectedWildcardLabelLegal({
        selectedLabel: '4 de copa',
        legalChoices,
      }),
    ).toBe(true);
    expect(
      validateSelectedWildcardChoice({
        selectedChoice: {
          rank: 7,
          suit: 'oro',
          label: '7 de oro',
        },
        legalChoices,
      }),
    ).toMatchObject({
      selectedChoice: {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
      matchedByLabel: {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
      matchedByValue: {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
      labelMatchesValue: true,
      isLegal: true,
    });
    expect(
      isSelectedWildcardChoiceLegal({
        selectedChoice: {
          rank: 4,
          suit: 'copa',
          label: '7 de oro',
        },
        legalChoices,
      }),
    ).toBe(false);
    expect(
      getWildcardChoiceByValue(legalChoices, {
        rank: 4,
        suit: 'copa',
        label: '4 de copa',
      }),
    ).toEqual({
      rank: 4,
      suit: 'copa',
      label: '4 de copa',
    });
    expect(
      getWildcardChoiceByLabel(legalChoices, '4 de copa'),
    ).toEqual({
      rank: 4,
      suit: 'copa',
      label: '4 de copa',
    });
    expect(
      resolveWildcardSelectionByLabel({
        selectedLabel: '7 de oro',
        legalChoices,
      }),
    ).toMatchObject({
      selectedLabel: '7 de oro',
      isLegal: true,
      selectedChoice: {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
    });
    expect(
      requireLegalWildcardSelectionByLabel({
        selectedLabel: '4 de copa',
        legalChoices,
      }),
    ).toEqual({
      rank: 4,
      suit: 'copa',
      label: '4 de copa',
    });
    expect(
      resolveWildcardSelectionByChoice({
        selectedChoice: {
          rank: 7,
          suit: 'oro',
          label: '7 de oro',
        },
        legalChoices,
      }),
    ).toMatchObject({
      isLegal: true,
      labelMatchesValue: true,
    });
    expect(
      requireLegalWildcardSelectionByChoice({
        selectedChoice: {
          rank: 7,
          suit: 'oro',
          label: '7 de oro',
        },
        legalChoices,
      }),
    ).toEqual({
      rank: 7,
      suit: 'oro',
      label: '7 de oro',
    });
  });

  it('selects legal wildcard options from already played cards', () => {
    const choiceOne: WildcardChoice = {
      rank: 4,
      suit: 'copa',
      label: '4 de copa',
    };
    const choiceTwo: WildcardChoice = {
      rank: 7,
      suit: 'oro',
      label: '7 de oro',
    };

    expect(
      getLegalWildcardChoicesForHand({
        candidateChoices: [choiceOne, choiceTwo],
        playedCards: [createCardSignature(4, 'copa')],
      }),
    ).toEqual([choiceTwo]);
    expect(
      selectLegalWildcardChoicesForHand({
        candidateChoices: [choiceOne, choiceTwo],
        playedCards: [createCardSignature(4, 'copa')],
      }),
    ).toEqual([choiceTwo]);
    expect(
      mergeTeamScoreDeltas(
        applyPointsToTeam(2, 'A'),
        applyPointsToTeam(3, 'B'),
      ),
    ).toEqual({ A: 2, B: 3 });
  });

  it('defaults undeclared wildcard timeouts to four of cups', () => {
    const timeoutChoice = resolveWildcardTimeoutChoice({
      candidateChoices: [
        {
          rank: 4,
          suit: 'copa',
          label: '4 de copa',
        },
        {
          rank: 7,
          suit: 'oro',
          label: '7 de oro',
        },
      ],
      playedCards: [createCardSignature(1, 'espada')],
    });

    expect(timeoutChoice).toEqual(getUndeclaredWildcardTimeoutChoice());
  });

  it('summarizes pending wildcard selection requirements', () => {
    const requirement = getPendingWildcardSelectionRequirement({
      wildcardId: 'wild-9',
      candidateChoices: [
        {
          rank: 4,
          suit: 'copa',
          label: '4 de copa',
        },
        {
          rank: 7,
          suit: 'oro',
          label: '7 de oro',
        },
      ],
      playedCards: [createCardSignature(4, 'copa')],
    });

    expect(requirement).toMatchObject({
      wildcardId: 'wild-9',
      legalChoices: [
        {
          rank: 7,
          suit: 'oro',
          label: '7 de oro',
        },
      ],
      timeoutChoice: {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
      needsSelection: true,
    });
    expect(
      getPendingWildcardSelectionRequirement({
        wildcardId: 'wild-10',
        candidateChoices: [
          {
            rank: 4,
            suit: 'copa',
            label: '4 de copa',
          },
        ],
        playedCards: [createCardSignature(4, 'copa')],
      }),
    ).toMatchObject({
      wildcardId: 'wild-10',
      legalChoices: [],
      needsSelection: false,
    });
    expect(
      getPendingWildcardSelectionPolicy({
        wildcardId: 'wild-9',
        candidateChoices: [
          {
            rank: 4,
            suit: 'copa',
            label: '4 de copa',
          },
          {
            rank: 7,
            suit: 'oro',
            label: '7 de oro',
          },
        ],
        playedCards: [createCardSignature(4, 'copa')],
        selectedChoice: {
          rank: 7,
          suit: 'oro',
          label: '7 de oro',
        },
      }),
    ).toMatchObject({
      requirement: {
        wildcardId: 'wild-9',
        legalChoices: [
          {
            rank: 7,
            suit: 'oro',
            label: '7 de oro',
          },
        ],
        needsSelection: true,
      },
      selectedLabel: '7 de oro',
      selectedChoice: {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
      isSelectedLegal: true,
      resolvedChoice: {
        rank: 7,
        suit: 'oro',
        label: '7 de oro',
      },
    });
  });

  it('identifies wildcard-vs-wildcard ties', () => {
    expect(
      areWildcardsTied(
        { isWildcard: true, choice: createCardSignature(3, 'espada') },
        { isWildcard: true, choice: createCardSignature(3, 'basto') },
      ),
    ).toBe(true);
  });

  it('counts bongs once per hand', () => {
    expect(
      countEffectiveBongs([
        { handId: 'h1', called: true },
        { handId: 'h1', called: true },
        { handId: 'h2', called: true },
      ]),
    ).toBe(2);
  });

  it('models canto priority windows and wildcard fixation in the reducer', () => {
    const trucoOpened = reduceRulesState(createInitialRulesState(), {
      type: 'truco/open',
      call: 'truco',
      initiatorTeam: 'A',
    });

    expect(getWindowPriorityTeam(trucoOpened.truco.window!)).toBe('A');
    expect(getWindowResponderTeam(trucoOpened.truco.window!)).toBe('B');

    const trucoResolved = reduceRulesState(trucoOpened, {
      type: 'truco/respond',
      response: 'quiero',
    });

    expect(trucoResolved.truco.lastResolution).toMatchObject({
      accepted: true,
      pointsAwarded: 2,
    });

    const wildcardFixed = reduceRulesState(trucoResolved, {
      type: 'wildcard/fix-envido',
      wildcardId: 'wild-1',
      choice: {
        ...createCardSignature(1, 'espada'),
        label: '1 de espada',
      },
      legalChoices: [
        {
          ...createCardSignature(1, 'espada'),
          label: '1 de espada',
        },
      ],
    });

    const activated = reduceRulesState(wildcardFixed, {
      type: 'wildcard/activate',
      handId: 'hand-1',
      wildcardId: 'wild-1',
      choice: {
        ...createCardSignature(1, 'espada'),
        label: '1 de espada',
      },
      legalChoices: [
        {
          ...createCardSignature(1, 'espada'),
          label: '1 de espada',
        },
      ],
    });

    expect(activated.wildcards.activeWildcardByHandId['hand-1']).toBe('wild-1');
    expect(activated.wildcards.envidoFixedChoicesByWildcardId['wild-1']).toMatchObject({
      ...createCardSignature(1, 'espada'),
      label: '1 de espada',
    });
  });

  it('blocks card play while a canto response is pending', () => {
    const trucoPending = reduceRulesState(createInitialRulesState(), {
      type: 'truco/open',
      call: 'truco',
      initiatorTeam: 'A',
    });

    expect(getPendingCantoDecision(trucoPending)).toMatchObject({
      kind: 'truco',
      call: 'truco',
      initiatorTeam: 'A',
      responderTeam: 'B',
    });
    expect(canPlayCardInCurrentState(trucoPending)).toBe(false);
    expect(getCardPlayPolicy(trucoPending)).toMatchObject({
      canPlayCard: false,
      reason: 'pending_canto',
      blockedByPendingCanto: {
        kind: 'truco',
      },
    });

    const trucoCleared = reduceRulesState(trucoPending, {
      type: 'truco/respond',
      response: 'quiero',
    });

    expect(getPendingCantoDecision(trucoCleared)).toBeNull();
    expect(canPlayCardInCurrentState(trucoCleared)).toBe(true);
  });

  it('rejects invalid truco escalations and cross-canto openings', () => {
    expect(() =>
      reduceRulesState(createInitialRulesState(), {
        type: 'truco/open',
        call: 'retruco',
        initiatorTeam: 'A',
      }),
    ).toThrow('Invalid Truco escalation.');

    const trucoPending = reduceRulesState(createInitialRulesState(), {
      type: 'truco/open',
      call: 'truco',
      initiatorTeam: 'A',
    });
    expect(() =>
      reduceRulesState(trucoPending, {
        type: 'envido/open',
        callChain: ['envido'],
        initiatorTeam: 'B',
      }),
    ).toThrow('Cannot open Envido while Truco is pending.');

    const envidoPending = reduceRulesState(createInitialRulesState(), {
      type: 'envido/open',
      callChain: ['envido'],
      initiatorTeam: 'A',
    });
    expect(() =>
      reduceRulesState(envidoPending, {
        type: 'truco/open',
        call: 'truco',
        initiatorTeam: 'B',
      }),
    ).toThrow('Cannot open Truco while Envido is pending.');
  });

  it('maps envido canto results into score deltas', () => {
    const accepted = getEnvidoCantoScoreDelta(
      resolveEnvidoResponse(['envido', 'real_envido'], 'quiero', {
        targetScore: 30,
        teamScores: { A: 12, B: 14 },
      }),
    );

    expect(accepted).toMatchObject({
      accepted: true,
      points: 5,
      isFinished: true,
      resolvedBy: 'response',
    });

    const declined = getEnvidoCantoScoreDelta(
      resolveEnvidoResponse(['envido', 'real_envido'], 'no_quiero', {
        targetScore: 30,
        teamScores: { A: 18, B: 26 },
      }),
    );

    expect(declined).toMatchObject({
      accepted: false,
      points: 2,
      isFinished: true,
      resolvedBy: 'response',
    });
  });

  it('resolves trick outcomes with wildcard ties and active wildcard choices', () => {
    const outcome = resolveTrickOutcome({
      handId: 'hand-1',
      wildcards: {
        activeWildcardByHandId: {
          'hand-1': 'wild-1',
        },
        commitments: {
          'wild-1': {
            wildcardId: 'wild-1',
            choice: {
              ...createCardSignature(1, 'espada'),
              label: '1 de espada',
            },
            lockedForEnvido: false,
          },
        },
      },
      plays: [
        {
          seatId: 'seat-a',
          team: 'A',
          card: createCardSignature(4, 'copa'),
          isWildcard: true,
          wildcardId: 'wild-1',
        },
        {
          seatId: 'seat-b',
          team: 'B',
          card: createCardSignature(7, 'oro'),
        },
      ],
    });

    expect(outcome.winnerTeam).toBe('A');
    expect(outcome.winningPlay?.effectiveCard).toMatchObject(createCardSignature(1, 'espada'));
  });

  it('rejects trick plays that include wildcardId without isWildcard=true', () => {
    expect(() =>
      resolveTrickOutcome({
        handId: 'hand-1',
        wildcards: {
          activeWildcardByHandId: {
            'hand-1': 'wild-1',
          },
          commitments: {
            'wild-1': {
              wildcardId: 'wild-1',
              choice: {
                ...createCardSignature(1, 'espada'),
                label: '1 de espada',
              },
              lockedForEnvido: false,
            },
          },
        },
        plays: [
          {
            seatId: 'seat-a',
            team: 'A',
            card: createCardSignature(4, 'copa'),
            wildcardId: 'wild-1',
          },
          {
            seatId: 'seat-b',
            team: 'B',
            card: createCardSignature(7, 'oro'),
          },
        ],
      }),
    ).toThrow('Wildcard play must set isWildcard=true when wildcardId is provided.');
  });

  it('keeps wildcard-vs-wildcard ties deterministic', () => {
    const outcome = resolveTrickOutcome({
      handId: 'hand-2',
      wildcards: {
        activeWildcardByHandId: {
          'hand-2': 'wild-a',
        },
        commitments: {
          'wild-a': {
            wildcardId: 'wild-a',
            choice: {
              ...createCardSignature(1, 'espada'),
              label: '1 de espada',
            },
            lockedForEnvido: false,
          },
          'wild-b': {
            wildcardId: 'wild-b',
            choice: {
              ...createCardSignature(4, 'copa'),
              label: '4 de copa',
            },
            lockedForEnvido: false,
          },
        },
      },
      plays: [
        {
          seatId: 'seat-a',
          team: 'A',
          card: createCardSignature(3, 'espada'),
          isWildcard: true,
          wildcardId: 'wild-a',
        },
        {
          seatId: 'seat-b',
          team: 'B',
          card: createCardSignature(3, 'basto'),
          isWildcard: true,
          wildcardId: 'wild-a',
        },
      ],
    });

    expect(outcome.isTie).toBe(true);
    expect(outcome.tieReason).toBe('wildcard_tie');
    expect(outcome.winnerTeam).toBeNull();
  });

  it('scores a hand after a fold using the current canto and bong summary', () => {
    const trucoOpened = reduceRulesState(createInitialRulesState(), {
      type: 'truco/open',
      call: 'truco',
      initiatorTeam: 'A',
    });
    const trucoAccepted = reduceRulesState(trucoOpened, {
      type: 'truco/respond',
      response: 'quiero',
    });
    const retrucoOpened = reduceRulesState(trucoAccepted, {
      type: 'truco/open',
      call: 'retruco',
      initiatorTeam: 'B',
    });
    const retrucoAccepted = reduceRulesState(retrucoOpened, {
      type: 'truco/respond',
      response: 'quiero',
    });

    const score = resolveHandScore({
      trickOutcome: null,
      truco: retrucoAccepted.truco,
      endedByFold: 'B',
      envidoAward: {
        team: 'B',
        points: 2,
        source: 'envido',
      },
      bongs: [
        { handId: 'hand-1', called: true },
        { handId: 'hand-1', called: true },
        { handId: 'hand-2', called: true },
      ],
    });

    expect(score.trucoAward).toMatchObject({
      team: 'A',
      points: 3,
      source: 'truco',
    });
    expect(score.totalPointsByTeam).toEqual({ A: 3, B: 2 });
    expect(score.bongSummary).toEqual({ effectiveBongs: 2, rawCalls: 3 });
  });

  it('builds resolved trick and hand finalization summaries', () => {
    const trickOutcome = resolveTrickOutcome({
      handId: 'hand-77',
      wildcards: {
        activeWildcardByHandId: {
          'hand-77': 'wild-77',
        },
        commitments: {
          'wild-77': {
            wildcardId: 'wild-77',
            choice: {
              ...createCardSignature(1, 'espada'),
              label: '1 de espada',
            },
            lockedForEnvido: false,
          },
        },
      },
      plays: [
        {
          seatId: 'seat-a',
          team: 'A',
          card: createCardSignature(4, 'copa'),
          isWildcard: true,
          wildcardId: 'wild-77',
        },
        {
          seatId: 'seat-b',
          team: 'B',
          card: createCardSignature(7, 'oro'),
        },
      ],
    });

    const trickSummary = getResolvedTrickSummary(trickOutcome);

    expect(trickSummary).toMatchObject({
      handId: 'hand-77',
      playCount: 2,
      winnerTeam: 'A',
      winningSeatId: 'seat-a',
      isTie: false,
      tieReason: null,
    });

    const handScore = resolveHandScore({
      trickOutcome,
      truco: reduceRulesState(
        reduceRulesState(
          reduceRulesState(createInitialRulesState(), {
            type: 'truco/open',
            call: 'truco',
            initiatorTeam: 'A',
          }),
          {
            type: 'truco/respond',
            response: 'quiero',
          },
        ),
        {
          type: 'wildcard/activate',
          handId: 'hand-77',
          wildcardId: 'wild-77',
          choice: {
            ...createCardSignature(1, 'espada'),
            label: '1 de espada',
          },
          legalChoices: [
            {
              ...createCardSignature(1, 'espada'),
              label: '1 de espada',
            },
          ],
        },
      ).truco,
      endedByFold: null,
      envidoAward: {
        team: 'A',
        points: 2,
        source: 'envido',
      },
      bongs: [{ handId: 'hand-77', called: true }],
    });

    expect(getHandScoreDeltaByTeam(handScore)).toEqual({ A: 4, B: 0 });
    expect(getHandWinningTeam(handScore)).toBe('A');
    expect(getHandFinalizationSummary(handScore)).toMatchObject({
      handId: 'hand-77',
      winningTeam: 'A',
      isTie: false,
      awardSources: ['truco', 'envido'],
      totalPointsByTeam: { A: 4, B: 0 },
      scoreDeltaByTeam: { A: 4, B: 0 },
      bongSummary: { effectiveBongs: 1, rawCalls: 1 },
    });
    expect(buildResolvedTrickEventPayload(trickOutcome)).toMatchObject({
      type: 'trick/resolved',
      phase: 'trick_resolution',
      handId: 'hand-77',
      playCount: 2,
      winnerTeam: 'A',
      winningSeatId: 'seat-a',
      isTie: false,
      tieReason: null,
      winningCard: createCardSignature(1, 'espada'),
      winningStrength: 14,
      wildcardPlayCount: 1,
      summary: {
        handId: 'hand-77',
        winnerTeam: 'A',
      },
    });
    expect(buildResolvedTrickLifecycleBundle(trickOutcome)).toMatchObject({
      type: 'trick/resolved',
      phase: 'trick_resolution',
      summary: {
        handId: 'hand-77',
        winnerTeam: 'A',
      },
      handId: 'hand-77',
      playCount: 2,
      winnerTeam: 'A',
      winningSeatId: 'seat-a',
      isTie: false,
      tieReason: null,
      winningCard: createCardSignature(1, 'espada'),
      winningStrength: 14,
      wildcardPlayCount: 1,
      wildcardIds: ['wild-77'],
      policy: {
        handId: 'hand-77',
        nextPhase: 'hand_scoring',
        shouldFinalizeHand: true,
        isTerminal: false,
      },
      payload: {
        type: 'trick/resolved',
        handId: 'hand-77',
      },
    });
    expect(getResolvedTrickSnapshot(trickOutcome)).toMatchObject({
      summary: {
        handId: 'hand-77',
        winnerTeam: 'A',
      },
      handId: 'hand-77',
      playCount: 2,
      winnerTeam: 'A',
      winningSeatId: 'seat-a',
      isTie: false,
      tieReason: null,
      winningCard: createCardSignature(1, 'espada'),
      winningStrength: 14,
      wildcardPlayCount: 1,
      wildcardIds: ['wild-77'],
      policy: {
        handId: 'hand-77',
        nextPhase: 'hand_scoring',
        shouldFinalizeHand: true,
        isTerminal: false,
      },
      payload: {
        type: 'trick/resolved',
        phase: 'trick_resolution',
      },
    });
    expect(getResolvedTrickLifecyclePolicy(trickOutcome)).toMatchObject({
      handId: 'hand-77',
      nextPhase: 'hand_scoring',
      shouldFinalizeHand: true,
      isTerminal: false,
      winnerTeam: 'A',
      isTie: false,
      tieReason: null,
      winningSeatId: 'seat-a',
      playCount: 2,
      wildcardPlayCount: 1,
    });
    expect(buildHandFinalizationEventPayload(handScore)).toMatchObject({
      type: 'hand/finalized',
      phase: 'hand_scoring',
      handId: 'hand-77',
      winningTeam: 'A',
      isTie: false,
      endedByFold: null,
      pointsBySource: {
        truco: 2,
        envido: 2,
        total: 4,
      },
      awards: [
        {
          team: 'A',
          points: 2,
          source: 'truco',
        },
        {
          team: 'A',
          points: 2,
          source: 'envido',
        },
      ],
      summary: {
        handId: 'hand-77',
        winningTeam: 'A',
      },
    });
    expect(buildHandFinalizationLifecycleBundle(handScore)).toMatchObject({
      type: 'hand/finalized',
      phase: 'hand_scoring',
      summary: {
        handId: 'hand-77',
        winningTeam: 'A',
      },
      handId: 'hand-77',
      winningTeam: 'A',
      isTie: false,
      endedByFold: null,
      scoreDeltaByTeam: { A: 4, B: 0 },
      totalPointsByTeam: { A: 4, B: 0 },
      awardSources: ['truco', 'envido'],
      pointsBySource: { truco: 2, envido: 2, total: 4 },
      policy: {
        handId: 'hand-77',
        nextPhase: 'action_turn',
        shouldAdvanceToNextHand: true,
        isTerminal: false,
        awardCount: 2,
      },
      payload: {
        type: 'hand/finalized',
        handId: 'hand-77',
        winningTeam: 'A',
      },
    });
    expect(getHandFinalizationPolicy(handScore)).toMatchObject({
      handId: 'hand-77',
      nextPhase: 'action_turn',
      shouldAdvanceToNextHand: true,
      isTerminal: false,
      winningTeam: 'A',
      isTie: false,
      awardCount: 2,
      awardSources: ['truco', 'envido'],
      pointsBySource: {
        truco: 2,
        envido: 2,
        total: 4,
      },
      scoreDeltaByTeam: { A: 4, B: 0 },
      scoreByTeam: { A: 4, B: 0 },
      endedByFold: null,
    });
    expect(getHandAwardSources(handScore)).toEqual(['truco', 'envido']);
    expect(getHandScorePointsBySource(handScore)).toEqual({
      truco: 2,
      envido: 2,
      total: 4,
    });
    expect(getHandScorePolicy(handScore)).toMatchObject({
      hasTrucoAward: true,
      hasEnvidoAward: true,
      hasAnyAward: true,
      awardCount: 2,
      awardSources: ['truco', 'envido'],
      totalPoints: 4,
      winningTeam: 'A',
      isTie: false,
      endedByFold: null,
      scoreByTeam: { A: 4, B: 0 },
      bongSummary: { effectiveBongs: 1, rawCalls: 1 },
    });
    expect(getHandScoreBreakdown(handScore)).toMatchObject({
      awardCount: 2,
      awardSources: ['truco', 'envido'],
      pointsBySource: { truco: 2, envido: 2, total: 4 },
      scoreByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      endedByFold: null,
      bongSummary: { effectiveBongs: 1, rawCalls: 1 },
    });
    expect(getHandAwards(handScore)).toEqual([
      {
        team: 'A',
        points: 2,
        source: 'truco',
      },
      {
        team: 'A',
        points: 2,
        source: 'envido',
      },
    ]);
  });

  it('resolves match scoring from a finalized hand summary', () => {
    const trucoOpened = reduceRulesState(createInitialRulesState(), {
      type: 'truco/open',
      call: 'truco',
      initiatorTeam: 'A',
    });
    const trucoAccepted = reduceRulesState(trucoOpened, {
      type: 'truco/respond',
      response: 'quiero',
    });
    const retrucoOpened = reduceRulesState(trucoAccepted, {
      type: 'truco/open',
      call: 'retruco',
      initiatorTeam: 'B',
    });
    const retrucoAccepted = reduceRulesState(retrucoOpened, {
      type: 'truco/respond',
      response: 'quiero',
    });

    const trickOutcome = resolveTrickOutcome({
      handId: 'hand-200',
      wildcards: {
        activeWildcardByHandId: {},
        commitments: {},
      },
      plays: [
        {
          seatId: 'seat-a',
          team: 'A',
          card: createCardSignature(1, 'espada'),
        },
        {
          seatId: 'seat-b',
          team: 'B',
          card: createCardSignature(7, 'oro'),
        },
      ],
    });

    const handScore = resolveHandScore({
      trickOutcome,
      truco: retrucoAccepted.truco,
      endedByFold: 'B',
      envidoAward: {
        team: 'A',
        points: 1,
        source: 'envido',
      },
      bongs: [{ handId: 'hand-200', called: true }],
    });

    const matchState = resolveMatchScore({
      targetScore: 15,
      scoreByTeam: { A: 12, B: 10 },
      handSummary: getHandFinalizationSummary(handScore),
      handCount: 4,
    });

    expect(getMatchPointsNeededByTeam({ A: 12, B: 10 }, 15)).toEqual({ A: 3, B: 5 });

    expect(matchState).toMatchObject({
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      handId: 'hand-200',
      handCount: 4,
      lastHandDelta: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      isComplete: true,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
    });
    expect(getMatchScorePolicy(matchState)).toMatchObject({
      handId: 'hand-200',
      targetScore: 15,
      nextPhase: 'match_end',
      shouldFinalizeMatch: true,
      isTerminal: true,
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      scoreDeltaByTeam: { A: 4, B: 0 },
      scoreByTeam: { A: 16, B: 10 },
      handCount: 4,
    });
    expect(getMatchFinalizationSummary(matchState)).toMatchObject({
      handId: 'hand-200',
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      scoreDeltaByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      handCount: 4,
    });
    expect(getMatchScoreDeltaByTeam(matchState)).toEqual({ A: 4, B: 0 });
    expect(buildMatchFinalizationEventPayload(matchState)).toMatchObject({
      type: 'match/finalized',
      phase: 'match_end',
      summary: {
        handId: 'hand-200',
        winningTeam: 'A',
      },
    });
    expect(buildMatchLifecycleBundle(matchState)).toMatchObject({
      type: 'match/finalized',
      phase: 'match_end',
      summary: {
        handId: 'hand-200',
        winningTeam: 'A',
      },
      handId: 'hand-200',
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      scoreDeltaByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      handCount: 4,
      policy: {
        nextPhase: 'match_end',
        shouldFinalizeMatch: true,
      },
      payload: {
        type: 'match/finalized',
      },
    });
    expect(getMatchFinalizationSnapshot(matchState)).toMatchObject({
      summary: {
        handId: 'hand-200',
        winningTeam: 'A',
      },
      handId: 'hand-200',
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      scoreDeltaByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      handCount: 4,
      policy: {
        nextPhase: 'match_end',
        shouldFinalizeMatch: true,
        isTerminal: true,
      },
      payload: {
        type: 'match/finalized',
        phase: 'match_end',
      },
    });
    expect(buildHandMatchProgressionBundle({
      matchState: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      type: 'match/finalized',
      phase: 'match_end',
      state: {
        scoreByTeam: { A: 16, B: 10 },
        handCount: 4,
        winningTeam: 'A',
      },
      handId: 'hand-200',
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      scoreDeltaByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      handCount: 4,
      payload: {
        type: 'match/finalized',
        phase: 'match_end',
      },
      policy: {
        nextPhase: 'match_end',
        shouldFinalizeMatch: true,
        isTerminal: true,
        scoreDeltaByTeam: { A: 4, B: 0 },
      },
    });
    expect(getHandMatchProgressionPolicy({
      matchState: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      handId: 'hand-200',
      nextPhase: 'match_end',
      shouldFinalizeMatch: true,
      isTerminal: true,
      winningTeam: 'A',
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreByTeam: { A: 16, B: 10 },
    });
    expect(getHandMatchProgressionSummary({
      matchState: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      handId: 'hand-200',
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      scoreDeltaByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      handCount: 4,
    });
    expect(getHandMatchProgressionSnapshot({
      matchState: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      handId: 'hand-200',
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      scoreDeltaByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      handCount: 4,
      summary: {
        handId: 'hand-200',
        winningTeam: 'A',
      },
      policy: {
        nextPhase: 'match_end',
        shouldFinalizeMatch: true,
        isTerminal: true,
        winningTeam: 'A',
        scoreDeltaByTeam: { A: 4, B: 0 },
      },
      payload: {
        type: 'match/finalized',
        phase: 'match_end',
      },
    });
    expect(getHandFinalizationSnapshot(handScore)).toMatchObject({
      summary: {
        handId: 'hand-200',
        winningTeam: 'A',
      },
      handId: 'hand-200',
      winningTeam: 'A',
      isTie: false,
      endedByFold: 'B',
      scoreDeltaByTeam: { A: 4, B: 0 },
      totalPointsByTeam: { A: 4, B: 0 },
      awardSources: ['truco', 'envido'],
      pointsBySource: { truco: 3, envido: 1, total: 4 },
      policy: {
        handId: 'hand-200',
        nextPhase: 'action_turn',
        shouldAdvanceToNextHand: true,
        isTerminal: false,
        awardCount: 2,
        awardSources: ['truco', 'envido'],
        scoreByTeam: { A: 4, B: 0 },
      },
      payload: {
        type: 'hand/finalized',
        phase: 'hand_scoring',
      },
    });
    expect(advanceMatchScore({
      state: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      scoreByTeam: { A: 16, B: 10 },
      handCount: 4,
      winningTeam: 'A',
      pointsNeededByTeam: { A: 0, B: 5 },
    });
    expect(buildMatchProgressionBundle({
      state: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
    handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      type: 'match/finalized',
      phase: 'match_end',
      summary: {
        handId: 'hand-200',
        winningTeam: 'A',
      },
      state: {
        scoreByTeam: { A: 16, B: 10 },
        handCount: 4,
        winningTeam: 'A',
      },
      handId: 'hand-200',
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      policy: {
        nextPhase: 'match_end',
        shouldFinalizeMatch: true,
        isTerminal: true,
      },
      payload: {
        type: 'match/finalized',
        phase: 'match_end',
      },
      scoreDeltaByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      handCount: 4,
    });
    expect(getMatchProgressionSnapshot({
      state: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      state: {
        scoreByTeam: { A: 16, B: 10 },
        handCount: 4,
        winningTeam: 'A',
      },
      handId: 'hand-200',
      targetScore: 15,
      scoreByTeam: { A: 16, B: 10 },
      scoreDeltaByTeam: { A: 4, B: 0 },
      winningTeam: 'A',
      isTie: false,
      leadingTeam: 'A',
      pointsToWin: 0,
      pointsNeededByTeam: { A: 0, B: 5 },
      scoreMargin: 6,
      handCount: 4,
      isComplete: true,
      summary: {
        handId: 'hand-200',
        winningTeam: 'A',
      },
      policy: {
        nextPhase: 'match_end',
        shouldFinalizeMatch: true,
        isTerminal: true,
      },
      payload: {
        type: 'match/finalized',
        phase: 'match_end',
      },
    });
    expect(getMatchProgressionSummary({
      state: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      handId: 'hand-200',
      winningTeam: 'A',
    });
    expect(getHandMatchProgressionDeltaByTeam({
      matchState: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toEqual({ A: 4, B: 0 });
    expect(getMatchProgressionPolicy({
      state: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toMatchObject({
      nextPhase: 'match_end',
      shouldFinalizeMatch: true,
      isTerminal: true,
      winningTeam: 'A',
      scoreDeltaByTeam: { A: 4, B: 0 },
      scoreByTeam: { A: 16, B: 10 },
    });
    expect(getMatchProgressionScoreDeltaByTeam({
      state: {
        targetScore: 15,
        scoreByTeam: { A: 12, B: 10 },
        handId: 'hand-199',
        handCount: 3,
        lastHandDelta: { A: 0, B: 0 },
        winningTeam: null,
        isTie: false,
        isComplete: false,
        leadingTeam: 'A',
        pointsToWin: 3,
        pointsNeededByTeam: { A: 3, B: 5 },
        scoreMargin: 2,
      },
      handSummary: getHandFinalizationSummary(handScore),
    })).toEqual({ A: 4, B: 0 });
  });

  it('stores trick and hand snapshots through the reducer', () => {
    const trickState = reduceRulesState(createInitialRulesState(), {
      type: 'trick/resolve',
      input: {
        handId: 'hand-9',
        wildcards: {
          activeWildcardByHandId: {},
          commitments: {},
        },
        plays: [
          {
            seatId: 'seat-a',
            team: 'A',
            card: createCardSignature(1, 'espada'),
          },
          {
            seatId: 'seat-b',
            team: 'B',
            card: createCardSignature(7, 'oro'),
          },
        ],
      },
    });

    expect(trickState.tricks.lastOutcome?.winnerTeam).toBe('A');

    const handState = reduceRulesState(trickState, {
      type: 'hand/score',
      input: {
        trickOutcome: trickState.tricks.lastOutcome,
        truco: trickState.truco,
        bongs: [{ handId: 'hand-9', called: true }],
      },
    });

    expect(handState.hand.totalPointsByTeam.A).toBe(1);
    expect(handState.hand.bongSummary.effectiveBongs).toBe(1);
  });
});
