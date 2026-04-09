export type TeamSide = 'A' | 'B';

export type TrucoCall = 'truco' | 'retruco' | 'vale_cuatro';

export type EnvidoCall = 'envido' | 'real_envido' | 'falta_envido';

export type EnvidoResponse = 'quiero' | 'no_quiero';

export type TrucoResponse = 'quiero' | 'no_quiero';

export type CardSuit = 'espada' | 'basto' | 'oro' | 'copa';

export interface CardSignature {
  suit: CardSuit;
  rank: number;
}

export interface CardView extends CardSignature {
  id: string;
  label: string;
  isWildcard: boolean;
}

export interface TeamScore {
  A: number;
  B: number;
}

export interface EnvidoScoreContext {
  targetScore: number;
  teamScores: TeamScore;
}

export interface WildcardChoice extends CardSignature {
  label: string;
}

export interface WildcardCommitment {
  wildcardId: string;
  choice: WildcardChoice;
  lockedForEnvido: boolean;
}

export interface HandWildcardState {
  commitments: Record<string, WildcardCommitment>;
}
