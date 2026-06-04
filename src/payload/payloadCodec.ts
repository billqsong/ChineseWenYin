import { readUint64be, writeUint64be } from '../utils/bytes';
import { WenyinError } from '../utils/errors';
import type { HoneyMode, Payload, PayloadHeader, PayloadSecurityLevel, TimeMode } from './payloadTypes';

const MAGIC = [0x57, 0x59, 0x49, 0x4e]; // WYIN
export const PAYLOAD_HEADER_LENGTH = 40;
const AAD_START = 4;
export const AAD_LENGTH = PAYLOAD_HEADER_LENGTH - AAD_START;

const securityToByte: Record<PayloadSecurityLevel, number> = { standard: 0, legacy_middle: 1, extreme: 2 };
const byteToSecurity: Record<number, PayloadSecurityLevel> = { 0: 'standard', 1: 'legacy_middle', 2: 'extreme' };
const honeyToByte: Record<HoneyMode, number> = { off: 0, unrelated_fake_on_failure: 1 };
const byteToHoney: Record<number, HoneyMode> = { 0: 'off', 1: 'unrelated_fake_on_failure' };
const compressionToByte: Record<PayloadHeader['compression'], number> = { none: 0, deflate_raw: 1 };
const byteToCompression: Record<number, PayloadHeader['compression']> = { 0: 'none', 1: 'deflate_raw' };
const timeToByte: Record<TimeMode, number> = {
  none: 0,
  local_soft: 1,
  online_time_preferred: 2,
  online_time_required: 3
};
const byteToTime: Record<number, TimeMode> = {
  0: 'none',
  1: 'local_soft',
  2: 'online_time_preferred',
  3: 'online_time_required'
};

export function encodePayload(payload: Payload): Uint8Array {
  const { header, salt, nonce, ciphertextWithTag } = payload;
  const output = new Uint8Array(PAYLOAD_HEADER_LENGTH + salt.length + nonce.length + ciphertextWithTag.length);
  output.set(MAGIC, 0);
  const view = new DataView(output.buffer);
  let offset = 4;
  output[offset++] = 0x02;
  output[offset++] = 0x02;
  output[offset++] = compressionToByte[header.compression];
  output[offset++] = 0x01;
  output[offset++] = 0x01;
  output[offset++] = 0x01;
  output[offset++] = securityToByte[header.securityLevel];
  output[offset++] = honeyToByte[header.honeyMode];
  output[offset++] = timeToByte[header.timeMode];
  writeUint64be(view, offset, header.notBefore);
  offset += 8;
  writeUint64be(view, offset, header.expiresAt);
  offset += 8;
  view.setUint32(offset, header.allowedDriftSeconds, false);
  offset += 4;
  output[offset++] = header.argonParamCode;
  output[offset++] = salt.length;
  output[offset++] = nonce.length;
  view.setUint32(offset, header.ciphertextLength, false);
  offset += 4;
  output.set(salt, offset);
  offset += salt.length;
  output.set(nonce, offset);
  offset += nonce.length;
  output.set(ciphertextWithTag, offset);
  return output;
}

export function decodePayload(bytes: Uint8Array): Payload {
  if (bytes.length < PAYLOAD_HEADER_LENGTH) {
    throw new WenyinError('INVALID_HEADER', 'Payload too short.');
  }
  for (let index = 0; index < MAGIC.length; index += 1) {
    if (bytes[index] !== MAGIC[index]) {
      throw new WenyinError('INVALID_HEADER', 'Invalid magic.');
    }
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 4;
  const version = bytes[offset++];
  if (version !== 0x02) {
    throw new WenyinError('UNSUPPORTED_VERSION', 'Unsupported payload version.');
  }
  const coverVersion = bytes[offset++];
  const compression = byteToCompression[bytes[offset++]];
  const kdf = bytes[offset++];
  const cipher = bytes[offset++];
  const cryptoSuite = bytes[offset++];
  const securityLevel = byteToSecurity[bytes[offset++]];
  const honeyMode = byteToHoney[bytes[offset++]];
  const timeMode = byteToTime[bytes[offset++]];
  const notBefore = readUint64be(view, offset);
  offset += 8;
  const expiresAt = readUint64be(view, offset);
  offset += 8;
  const allowedDriftSeconds = view.getUint32(offset, false);
  offset += 4;
  const argonParamCode = bytes[offset++] as PayloadHeader['argonParamCode'];
  const saltLength = bytes[offset++];
  const nonceLength = bytes[offset++];
  const ciphertextLength = view.getUint32(offset, false);
  offset += 4;

  if (
    coverVersion !== 0x02 ||
    !compression ||
    kdf !== 0x01 ||
    cipher !== 0x01 ||
    cryptoSuite !== 0x01 ||
    !securityLevel ||
    !honeyMode ||
    !timeMode ||
    ![1, 2, 3].includes(argonParamCode) ||
    saltLength !== 16 ||
    nonceLength !== 24
  ) {
    throw new WenyinError('INVALID_HEADER', 'Invalid payload header.');
  }

  const expectedLength = PAYLOAD_HEADER_LENGTH + saltLength + nonceLength + ciphertextLength;
  if (bytes.length !== expectedLength) {
    throw new WenyinError('INVALID_HEADER', 'Payload length mismatch.');
  }

  const salt = bytes.slice(offset, offset + saltLength);
  offset += saltLength;
  const nonce = bytes.slice(offset, offset + nonceLength);
  offset += nonceLength;
  const ciphertextWithTag = bytes.slice(offset, offset + ciphertextLength);

  return {
    header: {
      version: 2,
      coverVersion: 2,
      compression,
      kdf: 'argon2id',
      cipher: 'xchacha20-poly1305',
      cryptoSuite: 'ARGON2ID_XCHACHA20POLY1305',
      securityLevel,
      honeyMode,
      timeMode,
      notBefore,
      expiresAt,
      allowedDriftSeconds,
      argonParamCode,
      saltLength: 16,
      nonceLength: 24,
      ciphertextLength
    },
    salt,
    nonce,
    ciphertextWithTag
  };
}

export function getPayloadAad(payloadBytes: Uint8Array): Uint8Array {
  if (payloadBytes.length < PAYLOAD_HEADER_LENGTH) {
    throw new WenyinError('INVALID_HEADER', 'Payload too short for AAD.');
  }
  return payloadBytes.slice(AAD_START, PAYLOAD_HEADER_LENGTH);
}
