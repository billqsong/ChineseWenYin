import type { CoverRule } from './coverTypes';

export type CoverGenerationState = {
  previousTemplateId?: string;
  sentenceTexts: Set<string>;
  phraseCounts: Map<string, number>;
};

export function createCoverGenerationState(): CoverGenerationState {
  return {
    sentenceTexts: new Set(),
    phraseCounts: new Map()
  };
}

export function hasRepeatedLongFragment(sentence: string, seen: Set<string>): boolean {
  const chars = Array.from(sentence.replace(/[，。！？、\s]/g, ''));
  for (let index = 0; index + 8 <= chars.length; index += 1) {
    const fragment = chars.slice(index, index + 8).join('');
    if (seen.has(fragment)) {
      return true;
    }
  }
  return false;
}

export function rememberLongFragments(sentence: string, seen: Set<string>): void {
  const chars = Array.from(sentence.replace(/[，。！？、\s]/g, ''));
  for (let index = 0; index + 8 <= chars.length; index += 1) {
    seen.add(chars.slice(index, index + 8).join(''));
  }
}

export function violatesBlockRules(sentence: string, rules: CoverRule[]): boolean {
  return rules.some((rule) => rule.pattern && new RegExp(rule.pattern, 'u').test(sentence));
}

export function overusesPhrase(phrases: string[], counts: Map<string, number>): boolean {
  return phrases.some((phrase) => Array.from(phrase).length >= 2 && (counts.get(phrase) ?? 0) >= 3);
}

export function rememberPhrases(phrases: string[], counts: Map<string, number>): void {
  for (const phrase of phrases) {
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
}
