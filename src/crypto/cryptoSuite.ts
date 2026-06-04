import { randomBytes } from './random';
import { argonCodeForSecurityLevel, deriveKey } from './kdf';
import { decryptAead, encryptAead } from './cryptoCore';
import { encodePayload, getPayloadAad } from '../payload/payloadCodec';
import type { HoneyMode, Payload, PayloadHeader, SecurityLevel, TimePolicy } from '../payload/payloadTypes';
import { DEFAULT_ALLOWED_DRIFT_SECONDS } from '../payload/payloadTypes';
import { utf8Decode, utf8Encode } from '../utils/bytes';

export type BuildEncryptedPayloadInput = {
  plainText: string;
  password: string;
  securityLevel: SecurityLevel;
  honeyMode: HoneyMode;
  timePolicy: Required<TimePolicy>;
};

export async function buildEncryptedPayload(input: BuildEncryptedPayloadInput): Promise<Payload> {
  const salt = randomBytes(16);
  const nonce = randomBytes(24);
  const argonParamCode = argonCodeForSecurityLevel(input.securityLevel);
  const key = await deriveKey(input.password, salt, argonParamCode);
  const plainBytes = utf8Encode(input.plainText);
  const compressedText = await maybeCompressToBase64(plainBytes);
  const message = compressedText ?? input.plainText;
  const compression = compressedText ? 'deflate_raw' : 'none';
  const messageLength = compression === 'deflate_raw' ? message.length : plainBytes.length;
  const headerBase: PayloadHeader = {
    version: 2,
    coverVersion: 2,
    compression,
    kdf: 'argon2id',
    cipher: 'xchacha20-poly1305',
    cryptoSuite: 'ARGON2ID_XCHACHA20POLY1305',
    securityLevel: input.securityLevel,
    honeyMode: input.honeyMode,
    timeMode: input.timePolicy.mode,
    notBefore: input.timePolicy.notBefore ?? 0,
    expiresAt: input.timePolicy.expiresAt ?? 0,
    allowedDriftSeconds: input.timePolicy.allowedDriftSeconds ?? DEFAULT_ALLOWED_DRIFT_SECONDS,
    argonParamCode,
    saltLength: 16,
    nonceLength: 24,
    ciphertextLength: messageLength + 16
  };
  const aadPayload: Payload = { header: headerBase, salt, nonce, ciphertextWithTag: new Uint8Array() };
  const aad = getPayloadAad(encodePayload(aadPayload));
  const ciphertextWithTag = await encryptAead(message, aad, nonce, key);
  return {
    header: { ...headerBase, ciphertextLength: ciphertextWithTag.length },
    salt,
    nonce,
    ciphertextWithTag
  };
}

export async function decryptPayload(payload: Payload, password: string, payloadBytes: Uint8Array): Promise<string> {
  const key = await deriveKey(password, payload.salt, payload.header.argonParamCode);
  const aad = getPayloadAad(payloadBytes);
  const plainBytes = await decryptAead(payload.ciphertextWithTag, aad, payload.nonce, key);
  const decodedBytes = payload.header.compression === 'deflate_raw' ? await decompress(base64ToBytes(utf8Decode(plainBytes))) : plainBytes;
  return utf8Decode(decodedBytes);
}

async function maybeCompressToBase64(bytes: Uint8Array): Promise<string | undefined> {
  if (bytes.length < 96 || typeof CompressionStream === 'undefined') {
    return undefined;
  }
  const compressed = await compress(bytes);
  const encoded = bytesToBase64(compressed);
  return encoded.length + 1 < bytes.length ? encoded : undefined;
}

async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(toArrayBuffer(bytes)).body!.pipeThrough(new CompressionStream('deflate-raw'));
  return streamToBytes(stream);
}

async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('deflate_raw decompression is not available in this runtime.');
  }
  const stream = new Response(toArrayBuffer(bytes)).body!.pipeThrough(new DecompressionStream('deflate-raw'));
  return streamToBytes(stream);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    length += value.length;
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
