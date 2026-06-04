import { normalizePassword } from '../password/normalizePassword';
import { sha256Bytes } from '../utils/hash';
import { honeyTemplates, honeyWords } from './honeyTemplates';

function pick<T>(items: T[], byte: number): T {
  return items[byte % items.length];
}

export async function generateHoneyFakePlaintext(wrongPassword: string, coverFingerprint: string): Promise<string> {
  const seed = await sha256Bytes(`WENYIN-HONEY-V1${normalizePassword(wrongPassword)}${coverFingerprint}`);
  const sentenceCount = 1 + (seed[0] % 3);
  const sentences: string[] = [];
  for (let index = 0; index < sentenceCount; index += 1) {
    const base = honeyTemplates[seed[1 + index] % honeyTemplates.length];
    const offset = 4 + index * 4;
    sentences.push(
      base
        .replace('{place}', pick(honeyWords.place, seed[offset]))
        .replace('{drink}', pick(honeyWords.drink, seed[offset + 1]))
        .replace('{object}', pick(honeyWords.object, seed[offset + 2]))
        .replace('{food}', pick(honeyWords.food, seed[offset + 3]))
    );
  }
  sentences.push(
    `后来我把${pick(honeyWords.object, seed[28])}放在${pick(honeyWords.place, seed[29])}，又喝了点${pick(honeyWords.drink, seed[30])}。`
  );
  return sentences.join('');
}
