import type { CoverMode, CoverStyle } from '../../payload/payloadTypes';
import type { CoverRule, CoverTemplate, LexiconItem, SlotName, StyleLexicon } from './coverTypes';
import { COVER_VALUE_SPACE, slotOrder } from './coverTypes';

type SlotSeeds = Partial<Record<SlotName, string[]>>;

const markerParts: Record<CoverStyle, [string[], string[]]> = {
  daily: [
    ['顺手', '回头', '今天', '晚点', '先把', '慢慢', '刚好', '照常'],
    ['记下', '收好', '放着', '看过', '整理', '确认', '停住', '放稳']
  ],
  chat: [
    ['对了', '还有', '先说', '等下', '回头', '晚点', '别急', '就先'],
    ['记着', '看看', '确认', '放着', '这样', '没事', '慢来', '说定']
  ],
  novel: [
    ['微光', '旧影', '风声', '雨声', '门外', '窗下', '街角', '夜色'],
    ['未远', '渐低', '停住', '暗下', '无声', '仍在', '轻过', '收住']
  ],
  classical: [
    ['既', '乃', '遂', '因', '复', '旋', '方', '聊'],
    ['记', '书', '省', '悟', '候', '止', '观', '藏']
  ]
};

const compactTemplateBases: Record<CoverStyle, string[]> = {
  daily: [
    '{time}在{place}，{environment}，{object}{action}，{feeling}。',
    '{place}{environment}，{time}把{object}{action}，{result}。',
    '{time}{environment}，{object}{action}，{place}{feeling}。',
    '{object}{action}，{place}{environment}，{time}{result}。'
  ],
  chat: [
    '{opener}，{subject}{tone}，{action}，{status}，{ending}。',
    '{time}{opener}，{subject}{status}，{action}，{tone}{ending}。',
    '{subject}{tone}，{opener}{action}，{status}，{ending}。',
    '{opener}{subject}，{action}，{status}，{tone}，{ending}。'
  ],
  novel: [
    '{time}{place}，{character}{motion}，{object}{action}，{inner}。',
    '{character}在{place}{motion}，{object}{action}，{time}{inner}。',
    '{object}{action}，{character}{motion}，{place}{time}，{inner}。',
    '{time}{character}{motion}，{object}{action}，{place}{inner}。'
  ],
  classical: [
    '{time}{place}，{scene}，{person}{action}，{object}{connector}{ending}。',
    '{person}在{place}{action}，{object}{scene}，{feeling}{connector}{ending}。',
    '{time}{scene}，{person}{action}，{object}在{place}{connector}{ending}。',
    '{place}{scene}，{object}{action}，{person}{feeling}{connector}{ending}。'
  ]
};

function buildMarkers(style: CoverStyle): string[] {
  const [heads, tails] = markerParts[style];
  return heads.flatMap((head) => tails.map((tail) => `${head}${tail}`));
}

function uniqueText(text: string): string {
  return text;
}

export function buildItems(style: CoverStyle, seeds: SlotSeeds, topics: string[], tone: string): LexiconItem[] {
  const items: LexiconItem[] = [];
  for (const slot of slotOrder) {
    const phrases = seeds[slot];
    if (!phrases || phrases.length === 0) continue;
    const valueByText = buildShortPhraseValueMap(phrases);
    for (let index = 0; index < phrases.length; index += 1) {
      items.push({
        text: uniqueText(phrases[index]),
        slot,
        style,
        value: valueByText.get(phrases[index]) ?? index % COVER_VALUE_SPACE,
        topics: [topics[index % topics.length]],
        weight: 12 - (index % 4),
        tone,
        maxPerParagraph: slot === 'object' || slot === 'weather' ? 2 : 3
      });
    }
  }
  return items;
}

function buildShortPhraseValueMap(phrases: string[]): Map<string, number> {
  const uniquePhrases = Array.from(new Set(phrases));
  const shortPhrases = uniquePhrases
    .sort((left, right) => Array.from(left).length - Array.from(right).length || left.localeCompare(right))
    .slice(0, COVER_VALUE_SPACE * 2);
  const valueByText = new Map<string, number>();
  shortPhrases.forEach((phrase, index) => {
    valueByText.set(phrase, index % COVER_VALUE_SPACE);
  });
  return valueByText;
}

export function expandPhrases(bases: string[], variants: string[]): string[] {
  return variants.flatMap((variant) => bases.map((base) => variant.replace('{}', base).replace(/[，。！？、]/gu, '')));
}

export function buildTemplates(style: CoverStyle, bases: string[]): CoverTemplate[] {
  return [...buildTemplateSet(style, bases, 'balanced'), ...buildTemplateSet(style, compactTemplateBases[style], 'compact')];
}

function buildTemplateSet(style: CoverStyle, bases: string[], mode: CoverMode): CoverTemplate[] {
  const templates: CoverTemplate[] = [];
  const markers = buildMarkers(style);
  for (let value = 0; value < COVER_VALUE_SPACE; value += 1) {
    for (let index = 0; index < bases.length; index += 1) {
      const slots = Array.from(bases[index].matchAll(/\{([a-z]+)\}/g), (match) => match[1] as SlotName);
      const markedPattern = /[。！？]/u.test(bases[index])
        ? bases[index].replace('。', `，${markers[value]}。`)
        : `${bases[index]}，${markers[value]}。`;
      templates.push({
        id: `${style}-${mode}-${value}-${index}`,
        style,
        value,
        lengthTier: mode === 'compact' ? 'short' : index % 5 === 0 ? 'medium' : 'short',
        slots,
        pattern: markedPattern,
        weight: mode === 'compact' ? 20 : 10 - (index % 3),
        mode,
        maxUsePerOutput: 1
      });
    }
  }
  return templates;
}

export function buildRules(style: CoverStyle, blockPatterns: string[], topics: string[], usedSlots: SlotName[]): { allowRules: CoverRule[]; blockRules: CoverRule[] } {
  const allowRules: CoverRule[] = topics.flatMap((topic, topicIndex) =>
    usedSlots.map((slot, slotIndex) => ({
      id: `${style}-allow-${topicIndex}-${slotIndex}`,
      style,
      kind: 'allow' as const,
      slots: [slot],
      topics: [topic],
      reason: 'slot-topic pairing is suitable for this style'
    }))
  );
  const patternBlockRules: CoverRule[] = blockPatterns.map((pattern, index) => ({
    id: `${style}-block-${index}`,
    style,
    kind: 'block',
    pattern,
    reason: 'avoid awkward or revealing phrase combination'
  }));
  const generatedBlockRules: CoverRule[] = topics.flatMap((topic, topicIndex) =>
    usedSlots.map((slot, slotIndex) => ({
      id: `${style}-block-topic-${topicIndex}-${slotIndex}`,
      style,
      kind: 'block' as const,
      slots: [slot],
      topics: [topic],
      reason: 'limit repeated high-frequency phrase use and awkward topic drift'
    }))
  );
  return { allowRules, blockRules: [...patternBlockRules, ...generatedBlockRules.slice(0, Math.max(0, 400 - patternBlockRules.length))] };
}

export function makeStyleLexicon(
  style: CoverStyle,
  seeds: SlotSeeds,
  topics: string[],
  tone: string,
  templateBases: string[],
  blockPatterns: string[]
): StyleLexicon {
  const usedSlots = slotOrder.filter((slot) => seeds[slot] && seeds[slot]!.length > 0);
  const templates = buildTemplates(style, templateBases);
  const rules = buildRules(style, blockPatterns, topics, usedSlots);
  return {
    style,
    items: buildItems(style, seeds, topics, tone),
    templates,
    ...rules,
    fallbackTemplate: templates[0]
  };
}
