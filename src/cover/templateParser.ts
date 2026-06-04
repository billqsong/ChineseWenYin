import type { CoverTemplate, LexiconItem, SlotName, StyleLexicon } from './core/coverTypes';

type TemplatePart =
  | { kind: 'literal'; text: string }
  | { kind: 'slot'; slot: SlotName };

const partCache = new Map<string, TemplatePart[]>();
const valueMapCache = new Map<string, Map<string, LexiconItem[]>>();

export function renderTemplate(template: CoverTemplate, values: Record<SlotName, LexiconItem>): string {
  return template.pattern.replace(/\{([a-z]+)\}/g, (_, slot: SlotName) => values[slot].text);
}

export type ParsedSentence = {
  templateValue: number;
  values: number[];
};

type ParsedSentenceMatch = ParsedSentence & {
  style: string;
  templateId: string;
};

export function parseSentence(sentence: string, lexicons: StyleLexicon[]): ParsedSentence | undefined {
  return parseSentenceMatches(sentence, lexicons)[0];
}

export function parseSentenceMatches(sentence: string, lexicons: StyleLexicon[]): ParsedSentenceMatch[] {
  const matches: ParsedSentenceMatch[] = [];
  for (const lexicon of lexicons) {
    for (const template of lexicon.templates) {
      for (const values of parseWithTemplate(sentence, template, lexicon)) {
        matches.push({ style: lexicon.style, templateId: template.id, templateValue: template.value, values });
      }
    }
  }
  return matches;
}

function parseWithTemplate(sentence: string, template: CoverTemplate, lexicon: StyleLexicon): number[][] {
  const parts = getTemplateParts(template);
  const matches: number[][] = [];

  function walk(index: number, offset: number, values: number[]): void {
    if (matches.length >= 16) {
      return;
    }
    if (index === parts.length) {
      if (offset === sentence.length) {
        const signature = values.join(',');
        if (!matches.some((match) => match.join(',') === signature)) {
          matches.push([...values]);
        }
      }
      return;
    }
    const part = parts[index];
    if (part.kind === 'literal') {
      if (!sentence.startsWith(part.text, offset)) {
        return;
      }
      walk(index + 1, offset + part.text.length, values);
      return;
    }

    const firstChar = Array.from(sentence.slice(offset))[0];
    if (!firstChar) {
      return;
    }
    for (const item of getSlotItemsByFirstChar(lexicon, part.slot).get(firstChar) ?? []) {
      if (!sentence.startsWith(item.text, offset)) {
        continue;
      }
      values.push(item.value);
      walk(index + 1, offset + item.text.length, values);
      values.pop();
    }
  }

  walk(0, 0, []);
  return matches;
}

function getTemplateParts(template: CoverTemplate): TemplatePart[] {
  const cached = partCache.get(template.id);
  if (cached) {
    return cached;
  }
  const parts: TemplatePart[] = [];
  let lastIndex = 0;
  for (const match of template.pattern.matchAll(/\{([a-z]+)\}/g)) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'literal', text: template.pattern.slice(lastIndex, match.index) });
    }
    parts.push({ kind: 'slot', slot: match[1] as SlotName });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.pattern.length) {
    parts.push({ kind: 'literal', text: template.pattern.slice(lastIndex) });
  }
  partCache.set(template.id, parts);
  return parts;
}

function getSlotItemsByFirstChar(lexicon: StyleLexicon, slot: SlotName): Map<string, LexiconItem[]> {
  const cacheKey = `${lexicon.style}:${slot}`;
  const cached = valueMapCache.get(cacheKey) as Map<string, LexiconItem[]> | undefined;
  if (cached) {
    return cached;
  }
  const map = new Map<string, LexiconItem[]>();
  for (const item of lexicon.items) {
    if (item.slot === slot) {
      const firstChar = Array.from(item.text)[0];
      if (!firstChar) {
        continue;
      }
      const bucket = map.get(firstChar) ?? [];
      bucket.push(item);
      map.set(firstChar, bucket);
    }
  }
  for (const bucket of map.values()) {
    bucket.sort((left, right) => Array.from(right.text).length - Array.from(left.text).length);
  }
  valueMapCache.set(cacheKey, map);
  return map;
}
