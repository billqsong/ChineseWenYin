import { encodePayload, getPayloadAad } from './payloadCodec';
import type { Payload } from './payloadTypes';

export function aadFromPayload(payload: Payload): Uint8Array {
  return getPayloadAad(encodePayload(payload));
}

export function aadFromPayloadBytes(payloadBytes: Uint8Array): Uint8Array {
  return getPayloadAad(payloadBytes);
}
