import type { SecurityLevel } from '../payload/payloadTypes';
import { normalizePassword } from './normalizePassword';
import { WenyinError } from '../utils/errors';

export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong' | 'very_strong';

export type PasswordStrength = {
  level: PasswordStrengthLevel;
  score: number;
  label: string;
  suggestion: string;
};

const weakPasswords = new Set([
  'password',
  '123456',
  '12345678',
  'abc123456',
  'qwerty',
  '床前明月光',
  '生日快乐',
  '我爱你',
  'iloveyou'
]);

const commonPhrases = ['床前明月光', '疑是地上霜', '春眠不觉晓', '海内存知己', '天涯若比邻'];

function charClasses(value: string): number {
  const classes = [
    /[\p{Script=Han}]/u,
    /[A-Za-z]/,
    /\d/,
    /[^\p{Script=Han}A-Za-z0-9\s]/u
  ];
  return classes.filter((pattern) => pattern.test(value)).length;
}

export function getPasswordStrength(input: string): PasswordStrength {
  const value = normalizePassword(input);
  const length = Array.from(value).length;
  const classes = charClasses(value);
  const repeated = /^(.)\1+$/u.test(value);
  const phoneOrBirthday = /(\d{11})|((19|20)\d{2}[-年/]?\d{1,2}[-月/]?\d{1,2})/.test(value);
  const weak =
    length < 8 ||
    /^\d+$/.test(value) ||
    repeated ||
    phoneOrBirthday ||
    weakPasswords.has(value.toLowerCase()) ||
    commonPhrases.some((phrase) => value.includes(phrase));

  if (weak) {
    return {
      level: 'weak',
      score: 1,
      label: '弱',
      suggestion: '当前密钥较弱，容易被猜测。请避免使用常见诗句、生日、手机号、简单数字或过短短语。'
    };
  }

  const hasHanText = /[\p{Script=Han}]/u.test(value);
  const longReadablePhrase = hasHanText && length >= 28;
  const mixedLongPhrase = hasHanText && length >= 28 && classes >= 2;

  if ((length >= 24 && classes >= 3) || longReadablePhrase || mixedLongPhrase) {
    return {
      level: 'very_strong',
      score: 4,
      label: '极强',
      suggestion: '当前密钥强度很高，请妥善保存。'
    };
  }

  if (length >= 16 && classes >= 3) {
    return {
      level: 'strong',
      score: 3,
      label: '强',
      suggestion: '当前密钥较强。'
    };
  }

  return {
    level: 'medium',
    score: 2,
    label: '中',
    suggestion: '当前密钥强度一般。中文短语可以使用，建议增加长度，并混合中文、数字、英文字母和符号。'
  };
}

export function assertPasswordAllowedForSecurityLevel(password: string, securityLevel: SecurityLevel): void {
  const strength = getPasswordStrength(password);
  if (securityLevel === 'extreme' && strength.score < 4) {
    throw new WenyinError(
      'INVALID_PASSWORD_STRENGTH',
      '当前密钥强度不足，无法使用极高安全模式。请使用更长的现代中文短语，或混合中文、数字、英文字母和符号，也可以使用生成强密钥。'
    );
  }
}
