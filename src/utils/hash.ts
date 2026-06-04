import { bytesToHex, utf8Encode } from './bytes';

export async function sha256Bytes(input: Uint8Array | string): Promise<Uint8Array> {
  const bytes = typeof input === 'string' ? utf8Encode(input) : input;
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return new Uint8Array(digest);
}

export async function sha256Hex(input: Uint8Array | string): Promise<string> {
  return bytesToHex(await sha256Bytes(input));
}

export async function fingerprint(input: Uint8Array | string): Promise<string> {
  const hex = (await sha256Hex(input)).slice(0, 8).toUpperCase();
  return `WY-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}
