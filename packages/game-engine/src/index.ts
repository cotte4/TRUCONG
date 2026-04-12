import { setup, createActor } from 'xstate';
export * from './bongs.js';
export * from './canto.js';
export * from './cards.js';
export * from './envido.js';
export * from './hand.js';
export * from './match.js';
export * from './lifecycle.js';
export * from './rules.js';
export * from './truco.js';
export * from './tricks.js';
export * from './types.js';
export * from './wildcards.js';

// ---------------------------------------------------------------------------
// Phase event types — every event that can drive a phase transition
// ---------------------------------------------------------------------------
export type DimadongPhaseEvent =
  | { type: 'MATCH_START' }
  | { type: 'NEXT_HAND' }
  | { type: 'PLAYER_DISCONNECT' }
  | { type: 'PLAYER_RECONNECT' }
  | { type: 'RECONNECT_TIMEOUT' }
  | { type: 'CANTO_OPEN' }
  | { type: 'CANTO_RESOLVE'; outcome: 'action_turn' | 'match_end' | 'envido_wildcard_commit' }
  | { type: 'NESTED_CANTO' }
  | { type: 'WILDCARD_REQUEST' }
  | { type: 'WILDCARD_SELECT' }
  | { type: 'ENVIDO_WILDCARD_COMMIT'; outcome: 'action_turn' | 'match_end' | 'response_pending' }
  | { type: 'MATCH_END' }
  | { type: 'SUMMARY_START' };

// ---------------------------------------------------------------------------
// State machine — reflects the actual phase transitions in RoomStoreService.
// This is the authoritative spec; the service drives transitions imperatively
// and this machine validates that every transition is legal.
//
// Phases that are defined in MatchPhase but not yet active on the server
// (ready_check, dealing, canto_pending, trick_resolution, hand_scoring,
// envido_singing) are kept as placeholder states for future implementation.
// ---------------------------------------------------------------------------
export const dimadongMachine = setup({
  types: {
    events: {} as DimadongPhaseEvent,
  },
  guards: {
    outcomIsMatchEnd: (_, params: { outcome: string }) => params.outcome === 'match_end',
    outcomeIsEnvidoWildcard: (_, params: { outcome: string }) => params.outcome === 'envido_wildcard_commit',
    outcomeIsResponsePending: (_, params: { outcome: string }) => params.outcome === 'response_pending',
  },
}).createMachine({
  id: 'dimadong-match',
  initial: 'lobby',
  states: {
    // ── Active phases ────────────────────────────────────────────────────────

    lobby: {
      on: {
        MATCH_START: { target: 'action_turn' },
      },
    },

    action_turn: {
      on: {
        // New hand starts — stays in action_turn but resets hand state
        NEXT_HAND: { target: 'action_turn' },
        // Active-turn player dropped connection
        PLAYER_DISCONNECT: { target: 'reconnect_hold' },
        // Player called truco / envido / etc.
        CANTO_OPEN: { target: 'response_pending' },
        // Player requested a wildcard card mid-turn
        WILDCARD_REQUEST: { target: 'wildcard_selection' },
        // Score limit reached (e.g. truco auto-won, last card)
        MATCH_END: { target: 'match_end' },
      },
    },

    reconnect_hold: {
      on: {
        // Player came back within the grace window
        PLAYER_RECONNECT: { target: 'action_turn' },
        // Grace window expired — resume without the player
        RECONNECT_TIMEOUT: { target: 'action_turn' },
      },
    },

    response_pending: {
      on: {
        // Nested canto within an existing canto (e.g. truco → retruco)
        NESTED_CANTO: { target: 'response_pending' },
        // Canto resolved — target depends on outcome
        CANTO_RESOLVE: [
          {
            target: 'match_end',
            guard: { type: 'outcomIsMatchEnd', params: ({ event }) => ({ outcome: event.outcome }) },
          },
          {
            target: 'envido_wildcard_commit',
            guard: { type: 'outcomeIsEnvidoWildcard', params: ({ event }) => ({ outcome: event.outcome }) },
          },
          { target: 'action_turn' },
        ],
        MATCH_END: { target: 'match_end' },
      },
    },

    envido_wildcard_commit: {
      on: {
        // Envido wildcard committed — target depends on what comes next
        ENVIDO_WILDCARD_COMMIT: [
          {
            target: 'match_end',
            guard: { type: 'outcomIsMatchEnd', params: ({ event }) => ({ outcome: event.outcome }) },
          },
          {
            target: 'response_pending',
            guard: { type: 'outcomeIsResponsePending', params: ({ event }) => ({ outcome: event.outcome }) },
          },
          { target: 'action_turn' },
        ],
        MATCH_END: { target: 'match_end' },
      },
    },

    wildcard_selection: {
      on: {
        WILDCARD_SELECT: { target: 'action_turn' },
      },
    },

    match_end: {
      on: {
        SUMMARY_START: { target: 'post_match_summary' },
      },
    },

    post_match_summary: {
      // Terminal state — no outbound transitions
      type: 'final',
    },

    // ── Placeholder phases (defined in MatchPhase, not yet server-driven) ──

    ready_check: {},   // planned: lobby → ready_check → dealing
    dealing: {},       // planned: ready_check → dealing → action_turn
    canto_pending: {}, // planned: reserved for optimistic canto display
    envido_singing: {}, // planned: envido score reveal sequence
    trick_resolution: {}, // planned: trick animation hold state
    hand_scoring: {},  // planned: hand score reveal hold state
  },
});

// ---------------------------------------------------------------------------
// canTransition — guard utility for RoomStoreService.
// Returns true if the given event is a legal transition from `currentPhase`.
//
// Usage:
//   if (!canTransition(room.phase, { type: 'CANTO_OPEN' })) {
//     throw new BadRequestException('Cannot open canto in this phase.');
//   }
// ---------------------------------------------------------------------------
export function canTransition(
  currentPhase: string,
  event: DimadongPhaseEvent,
): boolean {
  try {
    const actor = createPhaseActor(currentPhase);
    actor.start();
    return actor.getSnapshot().can(event);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// createPhaseActor — creates a running actor for a room, starting at the
// given phase. Use this when you want reactive phase tracking per room.
//
// Usage:
//   const actor = createPhaseActor('action_turn');
//   actor.send({ type: 'CANTO_OPEN' });
//   actor.getSnapshot().value // → 'response_pending'
// ---------------------------------------------------------------------------
export function createPhaseActor(initialPhase: string) {
  const resolvedSnapshot = dimadongMachine.resolveState({
    value: initialPhase,
    context: undefined,
  });
  return createActor(dimadongMachine, { snapshot: resolvedSnapshot });
}
