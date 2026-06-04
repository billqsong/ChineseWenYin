import { getAttemptState, recordDecryptFailure, recordDecryptSuccess } from './attempts/localAttemptLimiter';
import { buildEncryptedPayload, decryptPayload } from './crypto/cryptoSuite';
import { decodeCoverText } from './cover/coverDecoder';
import { encodeCoverText } from './cover/coverEncoder';
import { generateHoneyFakePlaintext } from './honey/honeyFakePlaintext';
import { decodePayload, encodePayload } from './payload/payloadCodec';
import {
  MAX_PLAIN_TEXT_LENGTH,
  type DecryptOptions,
  type DecryptResult,
  type EncryptOptions,
  type HoneyMode,
  type SecurityLevel
} from './payload/payloadTypes';
import { assertPasswordAllowedForSecurityLevel } from './password/passwordStrength';
import { normalizeTimePolicy } from './time/timePolicy';
import { resolveTimeForHeader, validateTimeWindow } from './time/timeValidator';
import { WenyinError } from './utils/errors';
import { fingerprint } from './utils/hash';

export * from './payload/payloadTypes';
export * from './password/normalizePassword';
export * from './password/passwordStrength';
export * from './password/generateStrongPassword';
export * from './time/LocalTimeProvider';
export * from './time/MockTimeProvider';
export * from './cover/coverEncoder';
export * from './cover/coverDecoder';
export * from './payload/payloadCodec';
export * from './honey/honeyFakePlaintext';

function normalizeSecurityLevel(value?: SecurityLevel): SecurityLevel {
  return value ?? 'standard';
}

function normalizeHoneyMode(value?: HoneyMode): HoneyMode {
  return value ?? 'off';
}

export async function encryptToChineseCover(plainText: string, password: string, options: EncryptOptions = {}): Promise<string> {
  if (!plainText) {
    throw new WenyinError('INVALID_INPUT', '请输入需要加密的原文');
  }
  if (Array.from(plainText).length > MAX_PLAIN_TEXT_LENGTH) {
    throw new WenyinError('INVALID_INPUT', '原文最多支持 5000 字符');
  }
  if (!password.trim()) {
    throw new WenyinError('INVALID_INPUT', '请输入密钥');
  }
  const securityLevel = normalizeSecurityLevel(options.securityLevel);
  const honeyMode = normalizeHoneyMode(options.honeyMode);
  assertPasswordAllowedForSecurityLevel(password, securityLevel);
  if (honeyMode !== 'off' && securityLevel !== 'extreme') {
    throw new WenyinError('INVALID_PASSWORD_STRENGTH', '蜜罐假明文只能在极高安全模式下开启。');
  }

  const payload = await buildEncryptedPayload({
    plainText,
    password,
    securityLevel,
    honeyMode,
    timePolicy: normalizeTimePolicy(options.timePolicy)
  });
  return encodeCoverText(encodePayload(payload), options.coverStyle ?? 'novel', false, options.coverMode ?? 'compact');
}

export async function decryptFromChineseCover(
  coverText: string,
  password: string,
  options: DecryptOptions = {}
): Promise<DecryptResult> {
  if (!coverText.trim() || !password.trim()) {
    throw new WenyinError('INVALID_INPUT', '请输入中文密文和密钥');
  }
  const payloadBytes = await decodeCoverText(coverText);
  const payload = decodePayload(payloadBytes);
  const coverFingerprint = await fingerprint(payloadBytes);
  const time = await resolveTimeForHeader(payload.header, options.timeProvider);
  validateTimeWindow(payload.header, time);
  const attemptState = options.skipAttemptLimiter ? { lockUntil: 0 } : await getAttemptState(coverText);

  try {
    const plainText = await decryptPayload(payload, password, payloadBytes);
    if (!options.skipAttemptLimiter) {
      await recordDecryptSuccess(coverText);
    }
    return { plainText, status: 'success', fingerprint: coverFingerprint, timeSource: time?.source, header: payload.header };
  } catch {
    if (attemptState.lockUntil > Date.now()) {
      throw new WenyinError('LOCAL_ATTEMPT_LOCKED', 'Local attempt limiter is locked.');
    }
    if (!options.skipAttemptLimiter) {
      await recordDecryptFailure(coverText);
    }
    if (payload.header.honeyMode === 'unrelated_fake_on_failure') {
      return {
        plainText: await generateHoneyFakePlaintext(password, coverFingerprint),
        status: 'honey_fake',
        fingerprint: coverFingerprint,
        timeSource: time?.source,
        header: payload.header
      };
    }
    throw new WenyinError('DECRYPT_FAILED', 'Decrypt failed.');
  }
}
