import type { CoverMode, CoverStyle } from '../payload/payloadTypes';
import { COVER_HEADER } from '../payload/payloadTypes';
import { concatBytes, uint32be } from '../utils/bytes';
import { WenyinError } from '../utils/errors';
import { BitReader } from './bitReader';
import { decodeCoverText } from './coverDecoder';
import { loadAllStyleLexicons, loadStyleLexicon } from './core/coverLexiconLoader';
import {
  createCoverGenerationState,
  hasRepeatedLongFragment,
  overusesPhrase,
  rememberLongFragments,
  rememberPhrases,
  violatesBlockRules
} from './core/coverQualityGuard';
import type { CoverTemplate, LexiconItem, SlotName, StyleLexicon } from './core/coverTypes';
import { COVER_VALUE_BITS, COVER_VALUE_SPACE, slotOrder } from './core/coverTypes';
import { weightedPick } from './core/weightedPicker';
import { parseSentenceMatches, renderTemplate } from './templateParser';

export async function encodeCoverText(payload: Uint8Array, style: CoverStyle = 'novel', includeHeader = false, coverMode: CoverMode = 'compact'): Promise<string> {
  const input = concatBytes([uint32be(payload.length), payload]);
  const reader = new BitReader(input);
  const lexicon = await loadStyleLexicon(style);
  const sentences: string[] = [];
  const state = createCoverGenerationState();
  const longFragments = new Set<string>();

  while (reader.remaining() > 0) {
    const templateValue = reader.read(COVER_VALUE_BITS);
    const template = pickTemplate(lexicon, templateValue, state.previousTemplateId, coverMode);
    const numericValues = {} as Record<SlotName, number>;
    for (const slot of template.slots) {
      numericValues[slot] = reader.read(COVER_VALUE_BITS);
    }
    for (const slot of slotOrder) {
      numericValues[slot] ??= 0;
    }
    const sentence = buildSentence(lexicon, template, numericValues, state, longFragments, coverMode);
    state.previousTemplateId = template.id;
    sentences.push(sentence);
  }
  const body = sentences.join('');
  return includeHeader ? `${COVER_HEADER}${body}` : body;
}

function pickTemplate(lexicon: StyleLexicon, value: number, previousTemplateId: string | undefined, coverMode: CoverMode): CoverTemplate {
  const candidates = lexicon.templates.filter((template) => template.value === value && (template.mode ?? 'balanced') === coverMode);
  const filtered = candidates.filter((template) => template.id !== previousTemplateId);
  return weightedPick(filtered.length > 0 ? filtered : candidates, new Map());
}

function pickItem(lexicon: StyleLexicon, slot: SlotName, value: number, phraseCounts: Map<string, number>, coverMode: CoverMode): LexiconItem {
  const candidates = lexicon.items.filter((item) => item.slot === slot && item.value === value);
  if (coverMode === 'compact') {
    const minLength = Math.min(...candidates.map((item) => Array.from(item.text).length));
    const shortest = candidates.filter((item) => Array.from(item.text).length === minLength);
    return weightedPick(shortest, phraseCounts);
  }
  return weightedPick(candidates, phraseCounts);
}

function buildSentence(
  lexicon: StyleLexicon,
  template: CoverTemplate,
  numericValues: Record<SlotName, number>,
  state: ReturnType<typeof createCoverGenerationState>,
  longFragments: Set<string>,
  coverMode: CoverMode
): string {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const picked = {} as Record<SlotName, LexiconItem>;
    const phrases: string[] = [];
    for (const slot of template.slots) {
      const item = pickItem(lexicon, slot, numericValues[slot], state.phraseCounts, coverMode);
      picked[slot] = item;
      phrases.push(item.text);
    }
    const sentence = renderTemplate(template, picked);
    if (
      !state.sentenceTexts.has(sentence) &&
      parsesBackToExpectedBits(sentence, lexicon, template, numericValues) &&
      !hasRepeatedLongFragment(sentence, longFragments) &&
      !overusesPhrase(phrases, state.phraseCounts) &&
      !violatesBlockRules(sentence, lexicon.blockRules)
    ) {
      state.sentenceTexts.add(sentence);
      rememberLongFragments(sentence, longFragments);
      rememberPhrases(phrases, state.phraseCounts);
      return sentence;
    }
  }
  const fallback = {} as Record<SlotName, LexiconItem>;
  for (const slot of template.slots) {
    fallback[slot] = lexicon.items.find((item) => item.slot === slot && item.value === numericValues[slot])!;
  }
  const sentence = renderTemplate(template, fallback);
  if (parsesBackToExpectedBits(sentence, lexicon, template, numericValues)) {
    return sentence;
  }
  throw new WenyinError('INVALID_COVER_TEXT', 'Generated cover sentence is ambiguous.');
}

function parsesBackToExpectedBits(
  sentence: string,
  lexicon: StyleLexicon,
  template: CoverTemplate,
  numericValues: Record<SlotName, number>
): boolean {
  const expected = `${template.value}:${template.slots.map((slot) => numericValues[slot]).join(',')}`;
  const signatures = new Set(parseSentenceMatches(sentence, [lexicon]).map((match) => `${match.templateValue}:${match.values.join(',')}`));
  return signatures.size === 1 && signatures.has(expected);
}

export function getCoverCapacityBitsPerSentence(): number {
  return COVER_VALUE_BITS * 7;
}

export async function validateCoverDictionary(): Promise<string[]> {
  const issues: string[] = [];
  const lexicons = await loadAllStyleLexicons();
  for (const lexicon of lexicons) {
    const usedSlots = new Set(lexicon.items.map((item) => item.slot));
    for (const slot of usedSlots) {
      const valuesByText = new Map<string, Set<number>>();
      for (const item of lexicon.items.filter((candidate) => candidate.slot === slot)) {
        if (!item.text.trim()) {
          issues.push(`${lexicon.style}.${slot} contains empty phrase.`);
        }
        if (/[{}]/u.test(item.text)) {
          issues.push(`${lexicon.style}.${slot}.${item.text} contains template reserved characters.`);
        }
        const values = valuesByText.get(item.text) ?? new Set<number>();
        values.add(item.value);
        valuesByText.set(item.text, values);
      }
      for (const [text, values] of valuesByText) {
        if (values.size > 1) {
          issues.push(`${lexicon.style}.${slot}.${text} maps to multiple values: ${Array.from(values).join(', ')}.`);
        }
      }
      for (let value = 0; value < COVER_VALUE_SPACE; value += 1) {
        const items = lexicon.items.filter((item) => item.slot === slot && item.value === value);
        if (items.length < 2) {
          issues.push(`${lexicon.style}.${slot}.${value} must contain at least 2 phrases.`);
        }
        const texts = items.map((item) => item.text);
        if (new Set(texts).size !== texts.length) {
          issues.push(`${lexicon.style}.${slot}.${value} contains duplicate phrases.`);
        }
      }
    }
    for (let value = 0; value < COVER_VALUE_SPACE; value += 1) {
      const templates = lexicon.templates.filter((template) => template.value === value);
      if (templates.length < 8) {
        issues.push(`${lexicon.style}.template.${value} must contain at least 8 templates.`);
      }
      const compactTemplates = templates.filter((template) => template.mode === 'compact');
      if (compactTemplates.length < 4) {
        issues.push(`${lexicon.style}.template.${value} must contain at least 4 compact templates.`);
      }
      const parseCheckTemplates = [
        ...compactTemplates.slice(0, 1),
        ...templates.filter((template) => (template.mode ?? 'balanced') === 'balanced').slice(0, value % 8 === 0 ? 1 : 0)
      ];
      for (const template of templates) {
        const hasAllSlotItems = template.slots.every((slot) => usedSlots.has(slot));
        if (!hasAllSlotItems) {
          const missing = template.slots.filter((slot) => !usedSlots.has(slot));
          issues.push(`${template.id} references unused slots: ${missing.join(', ')}.`);
          continue;
        }
        const sample = renderSampleTemplate(lexicon, template);
        if (!/[。！？]/u.test(sample)) {
          issues.push(`${template.id} renders without terminal punctuation.`);
        }
        if (parseCheckTemplates.includes(template)) {
          const signatures = new Set(parseSentenceMatches(sample, lexicons).map((match) => `${match.templateValue}:${match.values.join(',')}`));
          if (signatures.size === 0) {
            issues.push(`${template.id} sample cannot be parsed.`);
          }
          if (signatures.size > 1) {
            issues.push(`${template.id} sample has ambiguous bit mappings.`);
          }
        }
        if (template.mode === 'compact') {
          const bits = COVER_VALUE_BITS * (template.slots.length + 1);
          const charsPerBit = Array.from(sample).length / bits;
          if (template.slots.length < 5) {
            issues.push(`${template.id} compact template must contain at least 5 slots.`);
          }
          if (charsPerBit > 1) {
            issues.push(`${template.id} compact template is too long: ${charsPerBit.toFixed(2)} chars/bit.`);
          }
        }
      }
    }
  }
  const payloads = [
    new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
    new Uint8Array([15, 240, 85, 170, 51, 204, 17, 238]),
    new Uint8Array([255, 0, 127, 128, 64, 32, 16, 8, 4])
  ];
  for (const lexicon of lexicons) {
    for (const payload of payloads) {
      const cover = await encodeCoverText(payload, lexicon.style);
      const decoded = await decodeCoverText(cover);
      if (!bytesEqual(decoded, payload)) {
        issues.push(`${lexicon.style} round-trip failed for payload ${Array.from(payload).join(',')}.`);
      }
    }
  }
  return issues;
}

function renderSampleTemplate(lexicon: StyleLexicon, template: CoverTemplate): string {
  const picked = {} as Record<SlotName, LexiconItem>;
  for (const slot of template.slots) {
    const item = lexicon.items.find((candidate) => candidate.slot === slot && candidate.value === 0) ?? lexicon.items.find((candidate) => candidate.slot === slot);
    if (item) {
      picked[slot] = item;
    }
  }
  return renderTemplate(template, picked);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}
