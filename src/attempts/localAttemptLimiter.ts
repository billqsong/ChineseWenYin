import { normalizeForFingerprint } from '../utils/bytes';
import { WenyinError } from '../utils/errors';
import { sha256Hex } from '../utils/hash';

export type AttemptState = {
  failedAttempts: number;
  lockUntil: number;
  lastFailedAt: number;
};

const PREFIX = 'wenyin-attempt:';

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export async function getAttemptKey(coverText: string): Promise<string> {
  return `${PREFIX}${await sha256Hex(normalizeForFingerprint(coverText))}`;
}

export async function getAttemptState(coverText: string): Promise<AttemptState> {
  const key = await getAttemptKey(coverText);
  const value = storage()?.getItem(key);
  if (!value) {
    return { failedAttempts: 0, lockUntil: 0, lastFailedAt: 0 };
  }
  try {
    return JSON.parse(value) as AttemptState;
  } catch {
    return { failedAttempts: 0, lockUntil: 0, lastFailedAt: 0 };
  }
}

export async function assertNotLocked(coverText: string, now = Date.now()): Promise<void> {
  const state = await getAttemptState(coverText);
  if (state.lockUntil > now) {
    throw new WenyinError('LOCAL_ATTEMPT_LOCKED', 'Local attempt limiter is locked.');
  }
}

export async function recordDecryptFailure(coverText: string, now = Date.now()): Promise<AttemptState> {
  const key = await getAttemptKey(coverText);
  const previous = await getAttemptState(coverText);
  const failedAttempts = previous.failedAttempts + 1;
  let lockUntil = 0;
  if (failedAttempts >= 10) {
    lockUntil = now + 10 * 60 * 1000;
  } else if (failedAttempts >= 5) {
    lockUntil = now + 60 * 1000;
  }
  const next = { failedAttempts, lockUntil, lastFailedAt: now };
  storage()?.setItem(key, JSON.stringify(next));
  return next;
}

export async function recordDecryptSuccess(coverText: string): Promise<void> {
  const key = await getAttemptKey(coverText);
  storage()?.removeItem(key);
}
