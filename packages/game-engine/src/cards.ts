import type { CardSignature, CardView, NormalCardSuit } from './types.js';

const TRUCO_STRENGTHS: Record<string, number> = {
  '1-espada': 14,
  '1-basto': 13,
  '7-espada': 12,
  '7-oro': 11,
  '3-espada': 10,
  '3-basto': 10,
  '3-oro': 10,
  '3-copa': 10,
  '2-espada': 9,
  '2-basto': 9,
  '2-oro': 9,
  '2-copa': 9,
  '1-oro': 8,
  '1-copa': 8,
  '12-espada': 7,
  '12-basto': 7,
  '12-oro': 7,
  '12-copa': 7,
  '11-espada': 6,
  '11-basto': 6,
  '11-oro': 6,
  '11-copa': 6,
  '10-espada': 5,
  '10-basto': 5,
  '10-oro': 5,
  '10-copa': 5,
  '7-basto': 4,
  '7-copa': 4,
  '6-espada': 3,
  '6-basto': 3,
  '6-oro': 3,
  '6-copa': 3,
  '5-espada': 2,
  '5-basto': 2,
  '5-oro': 2,
  '5-copa': 2,
  '4-espada': 1,
  '4-basto': 1,
  '4-oro': 1,
  '4-copa': 1,
};

export function getCardSignature(card: CardSignature) {
  return `${card.rank}-${card.suit}`;
}

export function createCardLabel(card: CardSignature) {
  return `${card.rank} de ${card.suit}`;
}

export function getTrucoCardStrength(card: CardSignature) {
  return TRUCO_STRENGTHS[getCardSignature(card)] ?? 0;
}

export function compareTrucoCards(left: CardSignature, right: CardSignature) {
  return getTrucoCardStrength(left) - getTrucoCardStrength(right);
}

export function areSameTrucoCards(left: CardSignature, right: CardSignature) {
  return getCardSignature(left) === getCardSignature(right);
}

export function resolveCardView(
  card: CardSignature & Partial<Pick<CardView, 'id' | 'label' | 'isWildcard'>>,
): CardView {
  return {
    id: card.id ?? getCardSignature(card),
    suit: card.suit,
    rank: card.rank,
    label: card.label ?? createCardLabel(card),
    isWildcard: card.isWildcard ?? false,
  };
}

export function getTrucoWinningCard(cards: CardSignature[]) {
  if (cards.length === 0) {
    return null;
  }

  let currentWinner = cards[0];
  let currentStrength = getTrucoCardStrength(currentWinner);
  let isTie = false;

  for (let index = 1; index < cards.length; index += 1) {
    const card = cards[index];
    const strength = getTrucoCardStrength(card);

    if (strength > currentStrength) {
      currentWinner = card;
      currentStrength = strength;
      isTie = false;
    } else if (strength === currentStrength) {
      isTie = true;
    }
  }

  return isTie ? null : currentWinner;
}

export function createCardSignature(rank: number, suit: NormalCardSuit): CardSignature {
  return { rank, suit };
}
