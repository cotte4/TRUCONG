import type {
  EnvidoCall,
  EnvidoResponse,
  EnvidoScoreContext,
  HandWildcardState,
  TeamSide,
  TrucoCall,
  TrucoResponse,
  WildcardChoice,
  WildcardCommitment,
} from './types.js';
import type { BongCall } from './bongs.js';
import type { EnvidoResolution, EnvidoScoringResolution } from './envido.js';
import { resolveEnvidoResponse, resolveEnvidoScoring } from './envido.js';
import type { TrucoResolution } from './truco.js';
import { resolveTrucoResponse } from './truco.js';
import { countEffectiveBongs } from './bongs.js';
import { lockWildcardForEnvido, registerWildcardCommitment, resolveWildcardChoice } from './wildcards.js';
import type { HandScoreInput, HandScoreState } from './hand.js';
import { createEmptyHandScoreState, resolveHandScore } from './hand.js';
import type { TrickResolutionInput, TrickRulesState } from './tricks.js';
import { createEmptyTrickRulesState, resolveTrickOutcome } from './tricks.js';

export interface ResponseWindow<TCall extends string, TResponse extends string> {
  call: TCall;
  initiatorTeam: TeamSide;
  responderTeam: TeamSide;
  response: TResponse | null;
  accepted: boolean | null;
  status: 'open' | 'resolved';
}

export interface TrucoRulesState {
  callChain: TrucoCall[];
  window: ResponseWindow<TrucoCall, TrucoResponse> | null;
  lastResolution: TrucoResolution | null;
}

export interface EnvidoRulesState {
  callChain: EnvidoCall[];
  window: ResponseWindow<EnvidoCall, EnvidoResponse> | null;
  lastResolution: EnvidoResolution | null;
  lastScoring: EnvidoScoringResolution | null;
}

export interface WildcardRulesState {
  commitments: HandWildcardState['commitments'];
  activeWildcardByHandId: Record<string, string>;
  envidoFixedChoicesByWildcardId: Record<string, WildcardChoice>;
}

export interface BongRulesState {
  calls: BongCall[];
  effectiveCount: number;
}

export interface DimadongRulesState {
  truco: TrucoRulesState;
  envido: EnvidoRulesState;
  wildcards: WildcardRulesState;
  bongs: BongRulesState;
  tricks: TrickRulesState;
  hand: HandScoreState;
}

export interface PendingCantoDecision {
  kind: 'truco' | 'envido';
  call: TrucoCall | EnvidoCall;
  initiatorTeam: TeamSide;
  responderTeam: TeamSide;
}

export interface CardPlayPolicy {
  canPlayCard: boolean;
  blockedByPendingCanto: PendingCantoDecision | null;
  reason: 'pending_canto' | null;
}

export type RulesAction =
  | { type: 'truco/open'; call: TrucoCall; initiatorTeam: TeamSide }
  | { type: 'truco/respond'; response: TrucoResponse }
  | { type: 'envido/open'; callChain: EnvidoCall[]; initiatorTeam: TeamSide }
  | { type: 'envido/respond'; response: EnvidoResponse; context: EnvidoScoreContext }
  | { type: 'wildcard/register'; commitment: WildcardCommitment }
  | { type: 'wildcard/activate'; handId: string; wildcardId: string; choice: WildcardChoice }
  | { type: 'wildcard/fix-envido'; wildcardId: string; choice: WildcardChoice }
  | { type: 'bong/record'; call: BongCall }
  | { type: 'trick/resolve'; input: TrickResolutionInput }
  | { type: 'hand/score'; input: HandScoreInput };

export function getOpponentTeam(team: TeamSide): TeamSide {
  return team === 'A' ? 'B' : 'A';
}

export function createResponseWindow<TCall extends string, TResponse extends string>(
  call: TCall,
  initiatorTeam: TeamSide,
): ResponseWindow<TCall, TResponse> {
  return {
    call,
    initiatorTeam,
    responderTeam: getOpponentTeam(initiatorTeam),
    response: null,
    accepted: null,
    status: 'open',
  };
}

export function createInitialRulesState(): DimadongRulesState {
  return {
    truco: {
      callChain: [],
      window: null,
      lastResolution: null,
    },
    envido: {
      callChain: [],
      window: null,
      lastResolution: null,
      lastScoring: null,
    },
    wildcards: {
      commitments: {},
      activeWildcardByHandId: {},
      envidoFixedChoicesByWildcardId: {},
    },
    bongs: {
      calls: [],
      effectiveCount: 0,
    },
    tricks: createEmptyTrickRulesState(),
    hand: createEmptyHandScoreState(),
  };
}

export function getWindowPriorityTeam<TCall extends string, TResponse extends string>(
  window: ResponseWindow<TCall, TResponse>,
) {
  return window.initiatorTeam;
}

export function getWindowResponderTeam<TCall extends string, TResponse extends string>(
  window: ResponseWindow<TCall, TResponse>,
) {
  return window.responderTeam;
}

export function getPendingCantoDecision(state: DimadongRulesState): PendingCantoDecision | null {
  if (state.truco.window?.status === 'open') {
    return {
      kind: 'truco',
      call: state.truco.window.call,
      initiatorTeam: state.truco.window.initiatorTeam,
      responderTeam: state.truco.window.responderTeam,
    };
  }

  if (state.envido.window?.status === 'open') {
    return {
      kind: 'envido',
      call: state.envido.window.call,
      initiatorTeam: state.envido.window.initiatorTeam,
      responderTeam: state.envido.window.responderTeam,
    };
  }

  return null;
}

export function isCardPlayBlockedByPendingCanto(state: DimadongRulesState) {
  return getPendingCantoDecision(state) !== null;
}

export function canPlayCardInCurrentState(state: DimadongRulesState) {
  return getCardPlayPolicy(state).canPlayCard;
}

export function getCardPlayPolicy(state: DimadongRulesState): CardPlayPolicy {
  const blockedByPendingCanto = getPendingCantoDecision(state);

  return {
    canPlayCard: blockedByPendingCanto === null,
    blockedByPendingCanto,
    reason: blockedByPendingCanto ? 'pending_canto' : null,
  };
}

function ensureOpenWindow<TCall extends string, TResponse extends string>(
  window: ResponseWindow<TCall, TResponse> | null,
  label: string,
) {
  if (window?.status === 'open') {
    throw new Error(`${label} response window is already open.`);
  }
}

function appendUniqueCall<TCall extends string>(existing: TCall[], call: TCall) {
  return existing[existing.length - 1] === call ? existing : [...existing, call];
}

export function reduceRulesState(state: DimadongRulesState, action: RulesAction): DimadongRulesState {
  switch (action.type) {
    case 'truco/open': {
      ensureOpenWindow(state.truco.window, 'Truco');

      return {
        ...state,
        truco: {
          callChain: appendUniqueCall(state.truco.callChain, action.call),
          window: createResponseWindow<TrucoCall, TrucoResponse>(action.call, action.initiatorTeam),
          lastResolution: state.truco.lastResolution,
        },
      };
    }

    case 'truco/respond': {
      if (!state.truco.window || state.truco.window.status !== 'open') {
        throw new Error('No open Truco response window.');
      }

      const resolution = resolveTrucoResponse(state.truco.window.call, action.response);

      return {
        ...state,
        truco: {
          callChain: state.truco.callChain,
          window: {
            ...state.truco.window,
            response: action.response,
            accepted: resolution.accepted,
            status: 'resolved',
          },
          lastResolution: resolution,
        },
      };
    }

    case 'envido/open': {
      ensureOpenWindow(state.envido.window, 'Envido');

      if (action.callChain.length === 0) {
        throw new Error('At least one Envido call is required.');
      }

      return {
        ...state,
        envido: {
          callChain: action.callChain,
          window: createResponseWindow<EnvidoCall, EnvidoResponse>(
            action.callChain[action.callChain.length - 1],
            action.initiatorTeam,
          ),
          lastResolution: state.envido.lastResolution,
          lastScoring: state.envido.lastScoring,
        },
      };
    }

    case 'envido/respond': {
      if (!state.envido.window || state.envido.window.status !== 'open') {
        throw new Error('No open Envido response window.');
      }

      const resolution = resolveEnvidoResponse(state.envido.callChain, action.response, action.context);
      const scoring = resolution.accepted
        ? resolveEnvidoScoring({
            callChain: state.envido.callChain,
            context: action.context,
            teamScores: action.context.teamScores,
          })
        : null;

      return {
        ...state,
        envido: {
          callChain: state.envido.callChain,
          window: {
            ...state.envido.window,
            response: action.response,
            accepted: resolution.accepted,
            status: 'resolved',
          },
          lastResolution: resolution,
          lastScoring: scoring,
        },
      };
    }

    case 'wildcard/register': {
      const registered = registerWildcardCommitment(
        { commitments: state.wildcards.commitments },
        action.commitment,
      );

      return {
        ...state,
        wildcards: {
          ...state.wildcards,
          commitments: registered.commitments,
          envidoFixedChoicesByWildcardId: action.commitment.lockedForEnvido
            ? {
                ...state.wildcards.envidoFixedChoicesByWildcardId,
                [action.commitment.wildcardId]: action.commitment.choice,
              }
            : state.wildcards.envidoFixedChoicesByWildcardId,
        },
      };
    }

    case 'wildcard/activate': {
      const resolved = resolveWildcardChoice(
        { commitments: state.wildcards.commitments },
        action.wildcardId,
        action.choice,
      );

      return {
        ...state,
        wildcards: {
          ...state.wildcards,
          commitments: {
            ...state.wildcards.commitments,
            [action.wildcardId]: {
              wildcardId: action.wildcardId,
              choice: resolved.choice,
              lockedForEnvido: resolved.lockedForEnvido,
            },
          },
          activeWildcardByHandId: {
            ...state.wildcards.activeWildcardByHandId,
            [action.handId]: action.wildcardId,
          },
        },
      };
    }

    case 'wildcard/fix-envido': {
      const fixed = lockWildcardForEnvido(
        { commitments: state.wildcards.commitments },
        action.wildcardId,
        action.choice,
      );

      return {
        ...state,
        wildcards: {
          ...state.wildcards,
          commitments: fixed.commitments,
          envidoFixedChoicesByWildcardId: {
            ...state.wildcards.envidoFixedChoicesByWildcardId,
            [action.wildcardId]: action.choice,
          },
        },
      };
    }

    case 'bong/record': {
      const calls = [...state.bongs.calls, action.call];

      return {
        ...state,
        bongs: {
          calls,
          effectiveCount: countEffectiveBongs(calls),
        },
      };
    }

    case 'trick/resolve': {
      const outcome = resolveTrickOutcome(action.input);

      return {
        ...state,
        tricks: {
          handId: outcome.handId,
          lastOutcome: outcome,
        },
      };
    }

    case 'hand/score': {
      const score = resolveHandScore(action.input);

      return {
        ...state,
        hand: score,
      };
    }

    default: {
      return state;
    }
  }
}
