import { COVER_HEADER } from '../payload/payloadTypes';
import { readUint32be } from '../utils/bytes';
import { WenyinError } from '../utils/errors';
import { loadAllStyleLexicons } from './core/coverLexiconLoader';
import { COVER_VALUE_BITS } from './core/coverTypes';
import { BitWriter } from './bitWriter';
import { parseSentenceMatches, type ParsedSentence } from './templateParser';

const MAX_COVER_UNIT_PARTS = 6;

export async function decodeCoverText(coverText: string): Promise<Uint8Array> {
  const normalized = coverText.trim();
  const body = (normalized.startsWith(COVER_HEADER) ? normalized.slice(COVER_HEADER.length) : normalized).replace(/[\r\n\t]+/g, '');
  if (!body) {
    throw new WenyinError('INVALID_COVER_TEXT', 'Cover body is empty.');
  }
  const parts = body.match(/[^。！？]+[。！？]/g);
  if (!parts || parts.join('') !== body) {
    throw new WenyinError('INVALID_COVER_TEXT', 'Cover sentences cannot be split.');
  }

  const writer = new BitWriter();
  const lexicons = await loadAllStyleLexicons();
  const parsedUnits = parseCoverUnits(parts, lexicons);
  if (!parsedUnits) {
    throw new WenyinError('INVALID_COVER_TEXT', 'Cover sentence cannot be parsed.');
  }
  for (const parsed of parsedUnits) {
    writer.write(parsed.templateValue, COVER_VALUE_BITS);
    for (const value of parsed.values) {
      writer.write(value, COVER_VALUE_BITS);
    }
  }
  const bytes = writer.toBytes();
  if (bytes.length < 4) {
    throw new WenyinError('INVALID_COVER_TEXT', 'Cover payload length missing.');
  }
  const payloadLength = readUint32be(bytes, 0);
  if (payloadLength <= 0 || bytes.length < 4 + payloadLength) {
    throw new WenyinError('INVALID_COVER_TEXT', 'Cover payload length mismatch.');
  }
  return bytes.slice(4, 4 + payloadLength);
}

function parseCoverUnits(parts: string[], lexicons: Awaited<ReturnType<typeof loadAllStyleLexicons>>): ParsedSentence[] | undefined {
  const memo = new Map<number, ParsedSentence[] | undefined>();

  function walk(start: number): ParsedSentence[] | undefined {
    if (start === parts.length) {
      return [];
    }
    if (memo.has(start)) {
      return memo.get(start);
    }

    let text = '';
    for (let end = start; end < Math.min(parts.length, start + MAX_COVER_UNIT_PARTS); end += 1) {
      text += parts[end];
      const matches = parseSentenceMatches(text, lexicons);
      for (const match of matches) {
        const rest = walk(end + 1);
        if (rest) {
          const result = [{ templateValue: match.templateValue, values: match.values }, ...rest];
          memo.set(start, result);
          return result;
        }
      }
    }

    memo.set(start, undefined);
    return undefined;
  }

  return walk(0);
}
