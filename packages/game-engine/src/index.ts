import { setup } from 'xstate';
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

export const dimadongMachine = setup({}).createMachine({
  id: 'dimadong-match',
  initial: 'lobby',
  states: {
    lobby: {},
    ready_check: {},
    dealing: {},
    action_turn: {},
    canto_pending: {},
    response_pending: {},
    wildcard_selection: {},
    trick_resolution: {},
    hand_scoring: {},
    reconnect_hold: {},
    match_end: {},
    post_match_summary: {},
  },
});
