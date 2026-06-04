import { WenyinError } from '../utils/errors';
import type { PayloadHeader, TimeProviderResult } from '../payload/payloadTypes';
import { LocalTimeProvider } from './LocalTimeProvider';

export async function resolveTimeForHeader(
  header: PayloadHeader,
  timeProvider = new LocalTimeProvider()
): Promise<TimeProviderResult | undefined> {
  if (header.timeMode === 'none') {
    return undefined;
  }
  try {
    return await timeProvider.now();
  } catch {
    throw new WenyinError('TIME_CHECK_FAILED', '本地时间读取失败。');
  }
}

export function validateTimeWindow(header: PayloadHeader, now?: TimeProviderResult): void {
  if (header.timeMode === 'none') {
    return;
  }
  if (!now) {
    throw new WenyinError('TIME_CHECK_FAILED', 'Time value missing.');
  }
  if (header.notBefore > 0 && now.unixSeconds < header.notBefore) {
    throw new WenyinError('TIME_NOT_YET_VALID', 'Not before time has not arrived.');
  }
  if (header.expiresAt > 0 && now.unixSeconds > header.expiresAt) {
    throw new WenyinError('TIME_EXPIRED', 'Payload has expired.');
  }
}
