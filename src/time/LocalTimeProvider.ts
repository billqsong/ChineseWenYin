import type { TimeProvider, TimeProviderResult } from '../payload/payloadTypes';

export class LocalTimeProvider implements TimeProvider {
  async now(): Promise<TimeProviderResult> {
    return { unixSeconds: Math.floor(Date.now() / 1000), source: 'local' };
  }
}
