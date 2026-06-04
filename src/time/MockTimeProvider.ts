import type { TimeProvider, TimeProviderResult } from '../payload/payloadTypes';

export class MockTimeProvider implements TimeProvider {
  constructor(private readonly unixSeconds: number, private readonly shouldFail = false) {}

  async now(): Promise<TimeProviderResult> {
    if (this.shouldFail) {
      throw new Error('Mock time provider failed.');
    }
    return { unixSeconds: this.unixSeconds, source: 'mock' };
  }
}
