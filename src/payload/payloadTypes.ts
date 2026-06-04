export type TimeMode = 'none' | 'local_soft' | 'online_time_preferred' | 'online_time_required';
export type SecurityLevel = 'standard' | 'extreme';
export type PayloadSecurityLevel = SecurityLevel | 'legacy_middle';
export type HoneyMode = 'off' | 'unrelated_fake_on_failure';
export type CoverStyle = 'daily' | 'chat' | 'novel' | 'classical';
export type CoverMode = 'compact' | 'balanced';
export type CompressionMode = 'none' | 'deflate_raw';

export type TimePolicy = {
  mode?: TimeMode;
  notBefore?: number;
  expiresAt?: number;
  allowedDriftSeconds?: number;
};

export type EncryptOptions = {
  coverStyle?: CoverStyle;
  coverMode?: CoverMode;
  compression?: CompressionMode;
  timePolicy?: TimePolicy;
  securityLevel?: SecurityLevel;
  honeyMode?: HoneyMode;
};

export type TimeProviderResult = {
  unixSeconds: number;
  source: 'local' | 'mock';
};

export interface TimeProvider {
  now(): Promise<TimeProviderResult>;
}

export type DecryptOptions = {
  timeProvider?: TimeProvider;
  skipAttemptLimiter?: boolean;
};

export type DecryptResult = {
  plainText: string;
  status: 'success' | 'honey_fake';
  fingerprint: string;
  timeSource?: TimeProviderResult['source'];
  header: PayloadHeader;
};

export type PayloadHeader = {
  version: 2;
  coverVersion: 2;
  compression: CompressionMode;
  kdf: 'argon2id';
  cipher: 'xchacha20-poly1305';
  cryptoSuite: 'ARGON2ID_XCHACHA20POLY1305';
  securityLevel: PayloadSecurityLevel;
  honeyMode: HoneyMode;
  timeMode: TimeMode;
  notBefore: number;
  expiresAt: number;
  allowedDriftSeconds: number;
  argonParamCode: 1 | 2 | 3;
  saltLength: 16;
  nonceLength: 24;
  ciphertextLength: number;
};

export type Payload = {
  header: PayloadHeader;
  salt: Uint8Array;
  nonce: Uint8Array;
  ciphertextWithTag: Uint8Array;
};

export const DEFAULT_ALLOWED_DRIFT_SECONDS = 300;
export const COVER_HEADER = '【文隐2】';
export const MAX_PLAIN_TEXT_LENGTH = 5000;
