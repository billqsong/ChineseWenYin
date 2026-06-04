import { getPasswordStrength } from './passwordStrength';

const phraseA = [
  '窗前月光',
  '青山热汤',
  '秋天桥边',
  '雨后书店',
  '晚风茶馆',
  '河岸灯火',
  '旧巷晴光',
  '松间清露',
  '午后竹影',
  '长街微风',
  '茶馆旧书',
  '云边小院',
  '灯下车票',
  '桥头晚霞',
  '树旁纸伞',
  '清晨花香'
];
const phraseB = [
  '橘子慢行',
  '纸伞轻响',
  '木桌新茶',
  '风铃远路',
  '星光便签',
  '竹影车票',
  '云边小院',
  '花香长椅',
  '热茶安放',
  '旧书翻开',
  '台灯亮起',
  '围巾收好',
  '相机靠窗',
  '面包醒来',
  '信封落下',
  '钥匙归来'
];
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const digits = '23456789';
const symbols = '!#%+_-=';

function randomIndex(length: number): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % length;
}

function randomFrom(source: string, count: number): string {
  let output = '';
  for (let index = 0; index < count; index += 1) {
    output += source[randomIndex(source.length)];
  }
  return output;
}

export function generateStrongPassword(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const firstPhrase = phraseA[randomIndex(phraseA.length)];
    const secondPhrase = phraseB[randomIndex(phraseB.length)];
    const digitPart = randomFrom(digits, 5);
    const letterPart = randomFrom(letters, 7);
    const symbolPart = randomFrom(symbols, 2);
    const patterns = [
      `${firstPhrase}-${secondPhrase}-${digitPart}-${letterPart}${symbolPart}`,
      `${letterPart}-${firstPhrase}-${digitPart}-${secondPhrase}${symbolPart}`,
      `${digitPart}${symbolPart}-${firstPhrase}-${letterPart}-${secondPhrase}`,
      `${secondPhrase}-${letterPart}${symbolPart}-${digitPart}-${firstPhrase}`
    ];
    const candidate = patterns[randomIndex(patterns.length)];
    if (getPasswordStrength(candidate).score === 4) {
      return candidate;
    }
  }
  return `${randomFrom(letters, 8)}-${phraseA[randomIndex(phraseA.length)]}-${randomFrom(digits, 6)}-${phraseB[randomIndex(phraseB.length)]}${randomFrom(symbols, 3)}`;
}
