export interface BongCall {
  handId: string;
  called: boolean;
}

export interface BongSummary {
  effectiveBongs: number;
  rawCalls: number;
}

export function countEffectiveBongs(calls: BongCall[]) {
  return new Set(calls.filter((call) => call.called).map((call) => call.handId)).size;
}

export function summarizeBongs(calls: BongCall[]): BongSummary {
  return {
    effectiveBongs: countEffectiveBongs(calls),
    rawCalls: calls.length,
  };
}

export function hasEffectiveBong(calls: BongCall[]) {
  return countEffectiveBongs(calls) > 0;
}
